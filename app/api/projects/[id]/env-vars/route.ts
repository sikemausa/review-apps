import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { project, envVar } from '@/src/db/schema/projects';
import { eq, and } from 'drizzle-orm';
import { getSessionFromHeaders } from '@/src/lib/auth-utils';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/projects/[id]/env-vars - List environment variables
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const projectData = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.userId)
        )
      )
      .limit(1);

    if (projectData.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
      .where(eq(envVar.projectId, params.id));

    // Mask secret values
    const maskedEnvVars = envVars.map(env => ({
      ...env,
      value: env.isSecret ? '********' : env.value
    }));

    return NextResponse.json({ envVars: maskedEnvVars });
  } catch (error) {
    console.error('Error fetching env vars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch environment variables' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/env-vars - Add environment variables
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const projectData = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.userId)
        )
      )
      .limit(1);

    if (projectData.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { variables } = body;

    if (!Array.isArray(variables) || variables.length === 0) {
      return NextResponse.json(
        { error: 'Variables array is required' },
        { status: 400 }
      );
    }

    // Validate variables
    for (const variable of variables) {
      if (!variable.key || !variable.value) {
        return NextResponse.json(
          { error: 'Each variable must have a key and value' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate keys
    const existingVars = await db
      .select()
      .from(envVar)
      .where(eq(envVar.projectId, params.id));

    const existingKeys = new Set(existingVars.map(v => v.key));
    const duplicates = variables.filter(v => existingKeys.has(v.key));

    if (duplicates.length > 0) {
      return NextResponse.json(
        { 
          error: 'Duplicate keys found', 
          duplicates: duplicates.map(d => d.key) 
        },
        { status: 409 }
      );
    }

    // Insert new variables
    const newVars = await db
      .insert(envVar)
      .values(
        variables.map(v => ({
          projectId: params.id,
          key: v.key,
          value: v.value,
          isSecret: v.isSecret || false
        }))
      )
      .returning();

    // Mask secrets in response
    const maskedVars = newVars.map(v => ({
      ...v,
      value: v.isSecret ? '********' : v.value
    }));

    return NextResponse.json({ envVars: maskedVars }, { status: 201 });
  } catch (error) {
    console.error('Error creating env vars:', error);
    return NextResponse.json(
      { error: 'Failed to create environment variables' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/env-vars/[varId] - Delete an environment variable
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const varId = searchParams.get('varId');

    if (!varId) {
      return NextResponse.json(
        { error: 'Variable ID is required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const projectData = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.userId)
        )
      )
      .limit(1);

    if (projectData.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete the variable
    const deleted = await db
      .delete(envVar)
      .where(
        and(
          eq(envVar.id, varId),
          eq(envVar.projectId, params.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Environment variable not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Environment variable deleted' });
  } catch (error) {
    console.error('Error deleting env var:', error);
    return NextResponse.json(
      { error: 'Failed to delete environment variable' },
      { status: 500 }
    );
  }
}