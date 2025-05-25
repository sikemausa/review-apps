import { 
  cleanupOrphanedDeployments, 
  cleanupOldDeployments 
} from '@/src/lib/utils/edge-case-handlers';

/**
 * Run periodic cleanup jobs
 * In production, this should be run via cron job or scheduled function
 */
export async function runCleanupJobs(): Promise<{
  orphaned: number;
  old: number;
  errors: string[];
}> {
  const results = {
    orphaned: 0,
    old: 0,
    errors: [] as string[]
  };

  try {
    // Cleanup orphaned deployments (where project was deleted)
    console.log('Running orphaned deployment cleanup...');
    results.orphaned = await cleanupOrphanedDeployments();
    console.log(`Cleaned up ${results.orphaned} orphaned deployments`);
  } catch (error) {
    const message = `Failed to cleanup orphaned deployments: ${error}`;
    console.error(message);
    results.errors.push(message);
  }

  try {
    // Cleanup old destroyed deployments (30+ days)
    console.log('Running old deployment cleanup...');
    results.old = await cleanupOldDeployments(30);
    console.log(`Cleaned up ${results.old} old deployments`);
  } catch (error) {
    const message = `Failed to cleanup old deployments: ${error}`;
    console.error(message);
    results.errors.push(message);
  }

  // TODO: Add more cleanup jobs:
  // - Remove expired webhook delivery IDs from cache
  // - Clean up failed deployment attempts
  // - Archive old project activity logs

  return results;
}

/**
 * Check system health and alert on issues
 */
export async function runHealthChecks(): Promise<{
  healthy: boolean;
  checks: Record<string, boolean>;
  errors: string[];
}> {
  const results = {
    healthy: true,
    checks: {} as Record<string, boolean>,
    errors: [] as string[]
  };

  // Check database connectivity
  try {
    const { db } = await import('@/src/db');
    await db.execute`SELECT 1`;
    results.checks.database = true;
  } catch (error) {
    results.healthy = false;
    results.checks.database = false;
    results.errors.push('Database connection failed');
  }

  // Check GitHub API connectivity
  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `token ${process.env.GITHUB_APP_PRIVATE_KEY ? 'app' : 'none'}`
      }
    });
    results.checks.githubApi = response.ok;
    if (!response.ok) {
      results.healthy = false;
      results.errors.push('GitHub API check failed');
    }
  } catch (error) {
    results.healthy = false;
    results.checks.githubApi = false;
    results.errors.push('GitHub API unreachable');
  }

  // Check encryption key
  try {
    if (!process.env.ENCRYPTION_SECRET) {
      throw new Error('ENCRYPTION_SECRET not configured');
    }
    results.checks.encryption = true;
  } catch (error) {
    results.healthy = false;
    results.checks.encryption = false;
    results.errors.push('Encryption not configured');
  }

  return results;
}