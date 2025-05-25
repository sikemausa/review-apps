import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders } from '@/src/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters from GitHub
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');
    const state = searchParams.get('state');
    
    // Log the callback for debugging
    console.log('GitHub App installation callback:', {
      installationId,
      setupAction,
      state
    });

    // Check if user is authenticated
    const session = await getSessionFromHeaders(request);
    
    if (setupAction === 'install' || setupAction === 'update') {
      // App was installed or updated
      if (session) {
        // TODO: Store installation ID with user
        console.log(`GitHub App installed for user ${session.userId}, installation ID: ${installationId}`);
      }
      
      // Redirect to success page
      return NextResponse.redirect(new URL('/dashboard?github_app_installed=true', request.url));
    } else if (setupAction === 'request') {
      // Installation was requested but not completed
      return NextResponse.redirect(new URL('/dashboard?github_app_requested=true', request.url));
    }

    // Default redirect
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling GitHub App callback:', error);
    return NextResponse.redirect(new URL('/dashboard?error=github_app_install_failed', request.url));
  }
}

// Handle POST for webhook-style callbacks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('GitHub App installation webhook:', body);
    
    // Handle installation created/deleted events
    if (body.action === 'created' || body.action === 'deleted') {
      const { installation, sender } = body;
      
      // TODO: Update database with installation status
      console.log(`Installation ${body.action}:`, {
        installationId: installation.id,
        account: installation.account.login,
        sender: sender.login
      });
    }
    
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling GitHub App webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}