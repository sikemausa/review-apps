import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { project, envVar } from '@/src/db/schema/projects';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/src/lib/auth-server';
import { envVarsArraySchema } from '@/src/lib/validation/project-validation';
import { handleApiError, AuthorizationError, NotFoundError } from '@/src/lib/utils/error-handling';
import { withTransaction } from '@/src/lib/db/transactions';
import { encrypt, decrypt, maskSecret } from '@/src/lib/security/encryption';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/projects/[id]/env-vars - List environment variables
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return handleApiError(new AuthorizationError());
    }

    // Verify project ownership
    const projectData = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, id),
          eq(project.userId, session.user.id)
        )
      )
      .limit(1);

    if (projectData.length === 0) {
      return handleApiError(new NotFoundError('Project'));
    }

    // Get environment variables
    const envVars = await db
      .select({
        id: envVar.id,
        key: envVar.key,
        value: envVar.value,
        isSecret: envVar.isSecret,
        createdAt: envVar.createdAt
      })
      .from(envVar)
      .where(eq(envVar.projectId, id));

    // Decrypt and mask secret values
    const processedEnvVars = await Promise.all(
      envVars.map(async (env) => {
        if (env.isSecret) {
          try {
            // For display, we mask the value
            const decryptedValue = await decrypt(env.value);
            return {
              ...env,
              value: maskSecret(decryptedValue),
              isEncrypted: true
            };
          } catch (error) {
            console.error(`Failed to decrypt env var ${env.id}`, error);
            
            // Handle decryption failure
            const { handleDecryptionFailure } = await import('@/src/lib/utils/edge-case-handlers');
            await handleDecryptionFailure(env.id, id).catch(console.error);
            
            return {
              ...env,
              value: '[DECRYPTION_FAILED]',
              isEncrypted: true,
              decryptError: true,
              errorMessage: 'This secret needs to be re-entered'
            };
          }
        }
        return env;
      })
    );

    return NextResponse.json({ envVars: processedEnvVars });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/env-vars - Add environment variables
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return handleApiError(new AuthorizationError());
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = envVarsArraySchema.parse(body);
    
    // Check environment variable limits
    const { checkEnvVarLimits } = await import('@/src/lib/utils/edge-case-handlers');
    const limits = await checkEnvVarLimits(id, validatedData.variables.length);
    
    if (!limits.allowed) {
      return NextResponse.json(
        { 
          error: `Environment variable limit exceeded. Current: ${limits.current}, Limit: ${limits.limit}`,
          current: limits.current,
          limit: limits.limit
        },
        { status: 400 }
      );
    }

    await withTransaction(async (tx) => {
      // Verify project ownership within transaction
      const projectData = await tx
        .select()
        .from(project)
        .where(
          and(
            eq(project.id, id),
            eq(project.userId, session.user.id)
          )
        )
        .limit(1);

      if (projectData.length === 0) {
        throw new NotFoundError('Project');
      }

      // Check for duplicate keys
      const existingVars = await tx
        .select()
        .from(envVar)
        .where(eq(envVar.projectId, id));

      const existingKeys = new Set(existingVars.map(v => v.key));
      const duplicates = validatedData.variables.filter(v => existingKeys.has(v.key));

      if (duplicates.length > 0) {
        throw new Error(`Duplicate keys found: ${duplicates.map(d => d.key).join(', ')}`);
      }

      // Encrypt secret values and insert
      const processedVars = await Promise.all(
        validatedData.variables.map(async (v) => ({
          projectId: id,
          key: v.key,
          value: v.isSecret ? await encrypt(v.value) : v.value,
          isSecret: v.isSecret || false
        }))
      );

      await tx.insert(envVar).values(processedVars);
    });

    // Return success without exposing encrypted values
    return NextResponse.json(
      { 
        message: 'Environment variables added successfully',
        count: validatedData.variables.length 
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/projects/[id]/env-vars - Delete an environment variable
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return handleApiError(new AuthorizationError());
    }

    const { searchParams } = new URL(request.url);
    const varId = searchParams.get('varId');

    if (!varId) {
      return NextResponse.json(
        { error: 'Variable ID is required' },
        { status: 400 }
      );
    }

    const deletedCount = await withTransaction(async (tx) => {
      // Verify project ownership
      const projectData = await tx
        .select()
        .from(project)
        .where(
          and(
            eq(project.id, id),
            eq(project.userId, session.user.id)
          )
        )
        .limit(1);

      if (projectData.length === 0) {
        throw new NotFoundError('Project');
      }

      // Delete the variable
      const deleted = await tx
        .delete(envVar)
        .where(
          and(
            eq(envVar.id, varId),
            eq(envVar.projectId, id)
          )
        )
        .returning();

      return deleted.length;
    });

    if (deletedCount === 0) {
      return handleApiError(new NotFoundError('Environment variable'));
    }

    return NextResponse.json({ message: 'Environment variable deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}