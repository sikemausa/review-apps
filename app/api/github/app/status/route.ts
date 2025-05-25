import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/src/lib/auth-server';
import { getGitHubAccessToken } from '@/src/lib/auth-utils';
import { getUserInstallations } from '@/src/lib/github';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json({
        hasGitHubConnection: false,
        hasAppInstallations: false,
        message: 'GitHub account not connected'
      });
    }

    // Check for app installations
    try {
      const installations = await getUserInstallations(accessToken);
      
      return NextResponse.json({
        hasGitHubConnection: true,
        hasAppInstallations: installations.length > 0,
        installationCount: installations.length,
        installations: installations.map(inst => ({
          id: inst.id,
          account: inst.account.login,
          type: inst.account.type,
          repositorySelection: inst.repositorySelection
        }))
      });
    } catch (error) {
      // User has GitHub connection but no app access
      return NextResponse.json({
        hasGitHubConnection: true,
        hasAppInstallations: false,
        message: 'GitHub App not installed'
      });
    }
  } catch (error) {
    console.error('Error checking GitHub App status:', error);
    return NextResponse.json(
      { error: 'Failed to check GitHub App status' },
      { status: 500 }
    );
  }
}