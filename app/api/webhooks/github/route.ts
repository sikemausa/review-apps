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
    
    // TODO: Check if this repository has a project configured
    // For now, we'll just log the webhook data
    
    const webhookData = {
      action,
      prNumber: pr.number,
      prTitle: pr.title,
      branch: pr.head.ref,
      commitSha: pr.head.sha,
      repository: {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        cloneUrl: pr.head.repo.clone_url
      },
      installationId: installation?.id,
      user: {
        login: pr.user.login,
        id: pr.user.id
      }
    };
    
    // Handle different PR actions
    if (shouldTriggerDeployment(action)) {
      console.log(`PR ${action} - would create/update deployment preview`);
      // TODO: Create or update deployment job
      // For now, we'll prepare the deployment data structure
      const deploymentData = {
        action,
        prNumber: pr.number,
        prTitle: pr.title,
        branch: pr.head.ref,
        commitSha: pr.head.sha,
        repository: repo.full_name,
        installationId: installation?.id,
        timestamp: new Date().toISOString()
      };
      console.log('Deployment data:', deploymentData);
    } else if (shouldCleanupDeployment(action)) {
      console.log('PR closed - would cleanup deployment preview');
      // TODO: Cleanup deployment job
      const cleanupData = {
        action,
        prNumber: pr.number,
        repository: repo.full_name,
        timestamp: new Date().toISOString()
      };
      console.log('Cleanup data:', cleanupData);
    }
    
    // For now, just acknowledge the webhook
    return NextResponse.json({
      message: 'Webhook received',
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