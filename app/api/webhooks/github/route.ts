import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { 
  PullRequestWebhookEvent, 
  SUPPORTED_PR_ACTIONS,
  shouldTriggerDeployment,
  shouldCleanupDeployment 
} from '@/src/lib/github/webhook-types';
import { 
  verifyWebhookSignature, 
  extractWebhookHeaders,
  WEBHOOK_EVENTS 
} from '@/src/lib/github/webhook-verification';
import { postDeploymentComment, postComment } from '@/src/lib/github/services/pr-comments';
import { 
  validateWebhookSecurity, 
  WebhookSecurityError,
  sanitizeWebhookPayload 
} from '@/src/lib/security/webhook-security';
import { handleApiError, withRetry, logError } from '@/src/lib/utils/error-handling';

// Queue for async processing (in production, use a proper queue like BullMQ)
const deploymentQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || deploymentQueue.length === 0) return;
  
  isProcessingQueue = true;
  while (deploymentQueue.length > 0) {
    const job = deploymentQueue.shift();
    if (job) {
      try {
        await job();
      } catch (error) {
        logError(error, { context: 'deployment_queue' });
      }
    }
  }
  isProcessingQueue = false;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestHeaders = await headers();
  const clientIp = requestHeaders.get('x-forwarded-for') || 
                   requestHeaders.get('x-real-ip') || 
                   'unknown';

  console.log('=== GitHub Webhook Received ===');
  
  // Get webhook secret from environment
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logError(new Error('GITHUB_WEBHOOK_SECRET not configured'), { 
      severity: 'critical' 
    });
    return NextResponse.json(
      { error: 'Webhook configuration error' },
      { status: 500 }
    );
  }

  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const bodySize = Buffer.byteLength(body, 'utf8');
    
    // Extract GitHub headers
    const githubHeaders = extractWebhookHeaders(request.headers);
    
    console.log(`Event: ${githubHeaders.event} | Delivery: ${githubHeaders.deliveryId}`);
    
    // Security validation
    try {
      await validateWebhookSecurity(
        githubHeaders.deliveryId,
        githubHeaders.event,
        clientIp,
        bodySize
      );
    } catch (error) {
      if (error instanceof WebhookSecurityError) {
        logError(error, { 
          ip: clientIp, 
          event: githubHeaders.event,
          deliveryId: githubHeaders.deliveryId 
        });
        return NextResponse.json(
          { error: error.message },
          { status: error.code === 'RATE_LIMIT' ? 429 : 400 }
        );
      }
      throw error;
    }
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(
      body, 
      githubHeaders.signature, 
      webhookSecret
    );
    
    if (!isValid) {
      logError(new Error('Invalid webhook signature'), {
        ip: clientIp,
        deliveryId: githubHeaders.deliveryId
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    console.log('✓ Security checks passed');
    
    // Handle ping events
    if (githubHeaders.event === WEBHOOK_EVENTS.PING) {
      console.log('Received ping event');
      return NextResponse.json({ 
        message: 'pong',
        timestamp: new Date().toISOString()
      });
    }
    
    // Only process pull_request events
    if (githubHeaders.event !== WEBHOOK_EVENTS.PULL_REQUEST) {
      console.log(`Ignoring event type: ${githubHeaders.event}`);
      return NextResponse.json({ message: 'Event ignored' });
    }
    
    // Parse and sanitize webhook payload
    const rawPayload = JSON.parse(body) as PullRequestWebhookEvent;
    const payload = sanitizeWebhookPayload(rawPayload);
    
    // Validate webhook payload structure
    const { validateWebhookPayload } = await import('@/src/lib/utils/edge-case-handlers');
    const validation = validateWebhookPayload(payload);
    if (!validation.isValid) {
      console.error('Invalid webhook payload:', validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    console.log(`PR #${payload.pull_request.number} - ${payload.action} on ${payload.repository.full_name}`);
    
    // Only handle specific PR actions
    if (!SUPPORTED_PR_ACTIONS.includes(payload.action)) {
      console.log(`Ignoring PR action: ${payload.action}`);
      return NextResponse.json({ message: 'Action ignored' });
    }
    
    // Extract relevant information
    const {
      action,
      pull_request: pr,
      repository: repo
    } = payload;
    
    // Import database and schema
    const { db } = await import('@/src/db');
    const { project } = await import('@/src/db/schema/projects');
    const { eq, and } = await import('drizzle-orm');
    
    // Check if this repository has an active project
    const projects = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.repoFullName, repo.full_name),
          eq(project.isActive, true)
        )
      )
      .limit(1);
    
    if (projects.length === 0) {
      console.log(`No active project for ${repo.full_name}`);
      return NextResponse.json({ 
        message: 'No active project configured' 
      });
    }
    
    const projectConfig = projects[0];
    console.log(`Found project ${projectConfig.id}`);
    
    // Queue deployment processing to avoid blocking webhook response
    const deploymentJob = async () => {
      if (shouldTriggerDeployment(action)) {
        await handleDeploymentCreation(
          projectConfig,
          pr,
          repo,
          action
        );
      } else if (shouldCleanupDeployment(action)) {
        await handleDeploymentCleanup(
          projectConfig,
          pr,
          repo
        );
      }
    };
    
    // Add to queue and process asynchronously
    deploymentQueue.push(deploymentJob);
    setImmediate(processQueue);
    
    const processingTime = Date.now() - startTime;
    console.log(`=== Webhook processed in ${processingTime}ms ===`);
    
    return NextResponse.json({
      message: 'Webhook accepted for processing',
      action,
      prNumber: pr.number,
      repository: repo.full_name,
      processingTime
    });
    
  } catch (error) {
    logError(error, {
      event: 'webhook_processing',
      ip: clientIp
    });
    return handleApiError(error);
  }
}

interface ProjectConfig {
  id: string;
  flyAppNamePrefix?: string;
  repoName: string;
}

interface PullRequest {
  number: number;
  title: string;
  head: {
    ref: string;
    sha: string;
  };
}

interface Repository {
  full_name: string;
  name: string;
  owner: {
    login: string;
  };
}

async function handleDeploymentCreation(
  projectConfig: ProjectConfig,
  pr: PullRequest,
  repo: Repository,
  action: string
) {
  console.log(`Creating/updating deployment for PR #${pr.number}`);
  
  try {
    // First check if project is still active
    const { verifyProjectActive, handleConcurrentPREvents, generateUniqueFlyAppName } = await import('@/src/lib/utils/edge-case-handlers');
    
    const projectActive = await verifyProjectActive(projectConfig.id);
    if (!projectActive) {
      console.log('Project is no longer active, skipping deployment');
      return;
    }
    
    // Handle concurrent PR events
    const { shouldProcess, existingDeployment } = await handleConcurrentPREvents(
      projectConfig.id,
      pr.number,
      action === 'opened' ? 'open' : 'reopen'
    );
    
    if (!shouldProcess) {
      console.log(`Skipping deployment creation - existing deployment in state: ${existingDeployment?.status}`);
      return;
    }
    
    const { db } = await import('@/src/db');
    const { deployment } = await import('@/src/db/schema/projects');
    const { eq, and } = await import('drizzle-orm');
    
    // Handle deployment creation/update
    let deploymentRecord;
    
    if (existingDeployment && existingDeployment.status === 'ready') {
      // Reset existing deployment for re-deployment
      console.log('Resetting existing deployment for re-deployment');
      await db
        .update(deployment)
        .set({
          commitSha: pr.head.sha,
          branch: pr.head.ref,
          status: 'pending',
          updatedAt: new Date(),
          startedAt: new Date(),
          completedAt: null,
          errorMessage: null
        })
        .where(eq(deployment.id, existingDeployment.id));
      
      deploymentRecord = existingDeployment;
    } else {
      // Generate unique Fly app name
      const flyAppName = await generateUniqueFlyAppName(
        projectConfig.flyAppNamePrefix || projectConfig.repoName,
        pr.number,
        projectConfig.id
      );
      
      // Create new deployment
      console.log(`Creating new deployment with app name: ${flyAppName}`);
      const [newDeployment] = await db
        .insert(deployment)
        .values({
          projectId: projectConfig.id,
          prNumber: pr.number,
          prTitle: pr.title,
          branch: pr.head.ref,
          commitSha: pr.head.sha,
          status: 'pending',
          flyAppName,
          metadata: {
            action,
            triggeredAt: new Date().toISOString()
          }
        })
        .returning();
      
      deploymentRecord = newDeployment;
    }
    
    console.log(`Deployment record ready: ${deploymentRecord.id}`);
    
    // Post deployment comment with retry
    await withRetry(
      () => postDeploymentComment(
        repo.owner.login,
        repo.name,
        pr.number,
        {
          status: 'pending',
          startedAt: new Date()
        }
      ),
      { maxAttempts: 2 }
    );
    
    console.log('✓ Posted PR comment');
    
    // TODO: Queue actual deployment to Fly.io
    console.log('TODO: Deploy to Fly.io');
    
  } catch (error) {
    logError(error, {
      context: 'deployment_creation',
      projectId: projectConfig.id,
      prNumber: pr.number
    });
    throw error;
  }
}

async function handleDeploymentCleanup(
  projectConfig: ProjectConfig,
  pr: PullRequest,
  repo: Repository
) {
  console.log(`Cleaning up deployment for PR #${pr.number}`);
  
  try {
    // Check if project is still active
    const { verifyProjectActive, handleConcurrentPREvents } = await import('@/src/lib/utils/edge-case-handlers');
    
    const projectActive = await verifyProjectActive(projectConfig.id);
    if (!projectActive) {
      console.log('Project is no longer active, skipping cleanup');
      return;
    }
    
    // Handle concurrent PR events
    const { shouldProcess } = await handleConcurrentPREvents(
      projectConfig.id,
      pr.number,
      'close'
    );
    
    if (!shouldProcess) {
      console.log('Deployment already being cleaned up or does not exist');
      return;
    }
    
    const { db } = await import('@/src/db');
    const { deployment } = await import('@/src/db/schema/projects');
    const { eq, and, not, inArray } = await import('drizzle-orm');
    
    // Find all deployments for this PR (not just ready ones)
    const deployments = await db
      .select()
      .from(deployment)
      .where(
        and(
          eq(deployment.projectId, projectConfig.id),
          eq(deployment.prNumber, pr.number),
          not(inArray(deployment.status, ['destroyed', 'destroying']))
        )
      );
    
    if (deployments.length === 0) {
      console.log('No deployments to clean up');
      return;
    }
    
    // Mark deployments as destroying first
    await db
      .update(deployment)
      .set({ 
        status: 'destroying',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(deployment.projectId, projectConfig.id),
          eq(deployment.prNumber, pr.number),
          not(inArray(deployment.status, ['destroyed', 'destroying']))
        )
      );
    
    console.log(`Marked ${deployments.length} deployments for destruction`);
    
    // TODO: Actually destroy Fly.io apps here
    
    // After successful cleanup, mark as destroyed
    await db
      .update(deployment)
      .set({ 
        status: 'destroyed',
        destroyedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(deployment.projectId, projectConfig.id),
          eq(deployment.prNumber, pr.number),
          eq(deployment.status, 'destroying')
        )
      );
    
    // Post cleanup comment
    const message = `## 🧹 Deployment Preview Removed

The deployment preview has been removed as the PR was closed.

Thank you for your contribution! 👋`;

    await withRetry(
      () => postComment(
        repo.owner.login,
        repo.name,
        pr.number,
        message
      ),
      { maxAttempts: 2 }
    );
    
    console.log('✓ Posted cleanup comment');
    
    // TODO: Actually destroy Fly.io app
    console.log('TODO: Destroy Fly.io app');
    
  } catch (error) {
    logError(error, {
      context: 'deployment_cleanup',
      projectId: projectConfig.id,
      prNumber: pr.number
    });
    throw error;
  }
}


// Health check endpoint
export async function GET() {
  return NextResponse.json({
    message: 'GitHub webhook endpoint',
    status: 'ready',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
  });
}