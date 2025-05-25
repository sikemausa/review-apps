import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, getCurrentUserGitHubToken } from '@/src/lib/auth-utils';
import { isAppInstalledOnRepo, checkRepositoryAccess } from '@/src/lib/github';

interface Params {
  params: {
    owner: string;
    repo: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    // Check authentication
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { owner, repo } = params;

    // Get GitHub access token from database
    const accessToken = await getCurrentUserGitHubToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found. Please reconnect your GitHub account.' },
        { status: 400 }
      );
    }

    // Check if user has access to the repository
    const hasAccess = await checkRepositoryAccess(owner, repo, accessToken);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this repository' },
        { status: 403 }
      );
    }

    // Check if app is installed on the repository
    const isInstalled = await isAppInstalledOnRepo(owner, repo);

    return NextResponse.json({
      installed: isInstalled,
      repository: {
        owner,
        name: repo,
        fullName: `${owner}/${repo}`,
      },
    });
  } catch (error) {
    console.error('Error checking installation:', error);
    return NextResponse.json(
      { error: 'Failed to check installation status' },
      { status: 500 }
    );
  }
}