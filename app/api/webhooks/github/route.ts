import { NextRequest, NextResponse } from 'next/server';
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
import { db } from '@/src/db';
import { project, deployment } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';
import { DeploymentService } from '@/src/lib/fly/deployment-service';
import { createCommentOnPR } from '@/src/lib/github';

export async function POST(request: NextRequest) {
  // Get webhook secret from environment
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('GITHUB_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  try {
    // Get the raw body for signature verification
    const body = await request.text();
    
    // Extract GitHub headers
    const headers = extractWebhookHeaders(request.headers);
    
    console.log(`Received GitHub webhook: ${headers.event} (delivery: ${headers.deliveryId})`);
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, headers.signature, webhookSecret);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Handle ping events (sent when webhook is first configured)
    if (headers.event === WEBHOOK_EVENTS.PING) {
      console.log('Received ping event');
      return NextResponse.json({ message: 'pong' });
    }
    
    // We only care about pull_request events
    if (headers.event !== WEBHOOK_EVENTS.PULL_REQUEST) {
      console.log(`Ignoring event type: ${headers.event}`);
      return NextResponse.json({ message: 'Event ignored' });
    }
    
    // Parse the webhook payload
    const payload = JSON.parse(body) as PullRequestWebhookEvent;
    
    // Only handle specific PR actions
    if (!SUPPORTED_PR_ACTIONS.includes(payload.action)) {
      console.log(`Ignoring PR action: ${payload.action}`);
      return NextResponse.json({ message: 'Action ignored' });
    }
    
    // Extract relevant information
    const {
      action,
      pull_request: pr,
      repository: repo,
      installation
    } = payload;
    
    console.log(`Processing PR #${pr.number} - ${action} on ${repo.full_name}`);
    
    // Check if this repository has a project configured
    const [projectData] = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.githubRepoId, repo.id),
          eq(project.isActive, true)
        )
      )
      .limit(1);
    
    if (!projectData) {
      console.log('No active project found for this repository');
      return NextResponse.json({
        message: 'No project configured for this repository',
        repository: repo.full_name
      });
    }
    
    const deploymentService = new DeploymentService();
    
    // Handle different PR actions
    if (shouldTriggerDeployment(action)) {
      console.log(`PR ${action} - creating/updating deployment preview`);
      
      try {
        // Post initial comment
        await createCommentOnPR(
          repo.owner.login,
          repo.name,
          pr.number,
          `🚀 **Deployment Preview**\n\nStarting deployment for commit \`${pr.head.sha.substring(0, 7)}\`...\n\nThis may take a few minutes.`
        );
        
        // Check if deployment already exists for this PR
        const [existingDeployment] = await db
          .select()
          .from(deployment)
          .where(
            and(
              eq(deployment.projectId, projectData.id),
              eq(deployment.prNumber, pr.number)
            )
          )
          .limit(1);
        
        if (existingDeployment && existingDeployment.status === 'active') {
          // Destroy existing deployment first
          await deploymentService.destroyDeployment(existingDeployment.id);
        }
        
        // Create new deployment
        const deploymentId = await deploymentService.deployPullRequest({
          projectId: projectData.id,
          prNumber: pr.number,
          prTitle: pr.title,
          prAuthor: pr.user.login,
          commitSha: pr.head.sha,
          repoFullName: repo.full_name,
          installationId: installation?.id || 0,
        });
        
        // Get deployment details
        const [newDeployment] = await db
          .select()
          .from(deployment)
          .where(eq(deployment.id, deploymentId))
          .limit(1);
        
        if (newDeployment?.flyAppUrl) {
          // Update PR comment with success
          await createCommentOnPR(
            repo.owner.login,
            repo.name,
            pr.number,
            `✅ **Deployment Preview Ready!**\n\n🔗 **Preview URL:** ${newDeployment.flyAppUrl}\n📝 **Commit:** \`${pr.head.sha.substring(0, 7)}\`\n🚀 **App Name:** \`${newDeployment.flyAppName}\`\n\nThe preview will be automatically updated when you push new commits.`
          );
        }
      } catch (error: any) {
        console.error('Deployment error:', error);
        
        // Post error comment
        await createCommentOnPR(
          repo.owner.login,
          repo.name,
          pr.number,
          `❌ **Deployment Failed**\n\nThere was an error deploying your preview:\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease check your build configuration and try again.`
        );
      }
    } else if (shouldCleanupDeployment(action)) {
      console.log('PR closed - cleaning up deployment preview');
      
      try {
        // Find active deployment for this PR
        const [activeDeployment] = await db
          .select()
          .from(deployment)
          .where(
            and(
              eq(deployment.projectId, projectData.id),
              eq(deployment.prNumber, pr.number),
              eq(deployment.status, 'active')
            )
          )
          .limit(1);
        
        if (activeDeployment) {
          await deploymentService.destroyDeployment(activeDeployment.id);
          
          // Post cleanup comment
          await createCommentOnPR(
            repo.owner.login,
            repo.name,
            pr.number,
            `🧹 **Deployment Preview Removed**\n\nThe preview environment has been cleaned up.`
          );
        }
      } catch (error: any) {
        console.error('Cleanup error:', error);
      }
    }
    
    return NextResponse.json({
      message: 'Webhook processed',
      action,
      prNumber: pr.number,
      repository: repo.full_name
    });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GitHub sends a ping event when setting up webhooks
export async function GET() {
  return NextResponse.json({
    message: 'GitHub webhook endpoint',
    status: 'ready'
  });
}