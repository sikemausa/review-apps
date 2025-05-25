import { db } from '@/src/db';
import { project, deployment, envVar } from '@/src/db/schema/projects';
import { eq, and, or, ne, inArray, lt, isNotNull, sql, desc } from 'drizzle-orm';

/**
 * Check if a project still exists and is active
 */
export async function verifyProjectActive(projectId: string): Promise<boolean> {
  const projects = await db
    .select({ isActive: project.isActive })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  
  return projects.length > 0 && projects[0].isActive;
}

/**
 * Handle orphaned deployments (where project was deleted)
 */
export async function cleanupOrphanedDeployments(): Promise<number> {
  const orphaned = await db
    .select({ id: deployment.id, projectId: deployment.projectId })
    .from(deployment)
    .leftJoin(project, eq(deployment.projectId, project.id))
    .where(
      and(
        inArray(deployment.status, ['ready', 'pending', 'building', 'deploying']),
        sql`${project.id} IS NULL` // Project doesn't exist
      )
    );

  if (orphaned.length === 0) return 0;

  // Mark orphaned deployments as destroyed
  await db
    .update(deployment)
    .set({ 
      status: 'destroyed',
      destroyedAt: new Date(),
      errorMessage: 'Project was deleted'
    })
    .where(
      inArray(deployment.id, orphaned.map(d => d.id))
    );

  return orphaned.length;
}

/**
 * Prevent duplicate Fly app names across projects
 */
export async function generateUniqueFlyAppName(
  basePrefix: string,
  prNumber: number,
  projectId: string
): Promise<string> {
  const baseName = `${basePrefix}-pr-${prNumber}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 25); // Leave room for suffix

  // Check if this name already exists
  const existing = await db
    .select({ id: deployment.id })
    .from(deployment)
    .where(
      and(
        eq(deployment.flyAppName, baseName),
        ne(deployment.projectId, projectId),
        or(
          eq(deployment.status, 'ready'),
          eq(deployment.status, 'pending'),
          eq(deployment.status, 'building'),
          eq(deployment.status, 'deploying')
        )
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return baseName;
  }

  // Add random suffix if name exists
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${baseName}-${suffix}`.substring(0, 30);
}

/**
 * Handle concurrent PR events (rapid open/close/reopen)
 */
export async function handleConcurrentPREvents(
  projectId: string,
  prNumber: number,
  action: 'open' | 'close' | 'reopen'
): Promise<{ shouldProcess: boolean; existingDeployment?: any }> {
  // Get the latest deployment for this PR
  const deployments = await db
    .select()
    .from(deployment)
    .where(
      and(
        eq(deployment.projectId, projectId),
        eq(deployment.prNumber, prNumber)
      )
    )
    .orderBy(desc(deployment.createdAt))
    .limit(1);

  const latest = deployments[0];

  // Handle based on action and current state
  if (action === 'open' || action === 'reopen') {
    // Don't create if already pending/building/deploying
    if (latest && ['pending', 'building', 'deploying'].includes(latest.status)) {
      return { shouldProcess: false, existingDeployment: latest };
    }
    
    // Don't create if ready and created recently (within 5 minutes)
    if (latest && latest.status === 'ready') {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (latest.createdAt > fiveMinutesAgo) {
        return { shouldProcess: false, existingDeployment: latest };
      }
    }
    
    return { shouldProcess: true, existingDeployment: latest };
  } else if (action === 'close') {
    // Only cleanup if deployment exists and is not already being destroyed
    if (latest && !['destroying', 'destroyed'].includes(latest.status)) {
      return { shouldProcess: true, existingDeployment: latest };
    }
    
    return { shouldProcess: false };
  }

  return { shouldProcess: false };
}

/**
 * Validate and sanitize Fly app configuration
 */
export function sanitizeFlyConfig(config: {
  flyAppNamePrefix?: string;
  flyRegion?: string;
  flyOrgSlug?: string;
}): {
  flyAppNamePrefix: string;
  flyRegion: string;
  flyOrgSlug: string;
} {
  return {
    flyAppNamePrefix: (config.flyAppNamePrefix || 'app')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20) || 'app',
    flyRegion: ['iad', 'ord', 'lax', 'sea', 'lhr', 'ams', 'fra', 'sin', 'syd']
      .includes(config.flyRegion || '') ? config.flyRegion! : 'iad',
    flyOrgSlug: (config.flyOrgSlug || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 30) || 'personal'
  };
}

/**
 * Handle repository rename/transfer
 */
export async function updateProjectRepository(
  projectId: string,
  newRepoFullName: string,
  newRepoOwner: string,
  newRepoName: string
): Promise<void> {
  await db
    .update(project)
    .set({
      repoFullName: newRepoFullName,
      repoOwner: newRepoOwner,
      repoName: newRepoName,
      updatedAt: new Date()
    })
    .where(eq(project.id, projectId));
}

/**
 * Ensure environment variable limits
 */
export async function checkEnvVarLimits(
  projectId: string,
  additionalCount: number = 1
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limit = 100; // Max env vars per project
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(envVar)
    .where(eq(envVar.projectId, projectId));
  
  const current = Number(result[0]?.count || 0);
  
  return {
    allowed: current + additionalCount <= limit,
    current,
    limit
  };
}

/**
 * Handle missing or corrupted encryption keys
 */
export async function handleDecryptionFailure(
  envVarId: string,
  projectId: string
): Promise<void> {
  // Mark the env var as needing re-encryption
  await db
    .update(envVar)
    .set({
      value: '[DECRYPTION_FAILED]',
      updatedAt: new Date()
    })
    .where(
      and(
        eq(envVar.id, envVarId),
        eq(envVar.projectId, projectId)
      )
    );
  
  // TODO: Notify project owner
}

/**
 * Cleanup old deployments to prevent resource exhaustion
 */
export async function cleanupOldDeployments(
  daysToKeep: number = 30
): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  const old = await db
    .select({ id: deployment.id })
    .from(deployment)
    .where(
      and(
        eq(deployment.status, 'destroyed'),
        isNotNull(deployment.destroyedAt),
        lt(deployment.destroyedAt, cutoffDate)
      )
    );

  if (old.length === 0) return 0;

  // Delete old destroyed deployments
  await db
    .delete(deployment)
    .where(
      inArray(deployment.id, old.map(d => d.id))
    );

  return old.length;
}

/**
 * Validate GitHub webhook payload size and structure
 */
export function validateWebhookPayload(payload: any): {
  isValid: boolean;
  error?: string;
} {
  // Check required fields
  if (!payload?.pull_request?.number || 
      !payload?.repository?.full_name ||
      !payload?.action) {
    return {
      isValid: false,
      error: 'Missing required webhook fields'
    };
  }

  // Check PR number is reasonable
  if (payload.pull_request.number < 1 || 
      payload.pull_request.number > 999999) {
    return {
      isValid: false,
      error: 'Invalid PR number'
    };
  }

  // Check repository name format
  if (!/^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/.test(payload.repository.full_name)) {
    return {
      isValid: false,
      error: 'Invalid repository name format'
    };
  }

  return { isValid: true };
}