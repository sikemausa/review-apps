import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/src/lib/auth-server';
import { getGitHubAccessToken } from '@/src/lib/auth-utils';
import { getUserInstallations, getInstallationRepositories } from '@/src/lib/github';

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

    // Get GitHub access token from database
    const accessToken = await getGitHubAccessToken(session.user.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found. Please reconnect your GitHub account.' },
        { status: 400 }
      );
    }

    // Get user's installations
    const installations = await getUserInstallations(accessToken);

    // Get repositories for each installation
    const installationsWithRepos = await Promise.all(
      installations.map(async (installation) => {
        const repositories = await getInstallationRepositories(installation.id);
        return {
          ...installation,
          repositories,
        };
      })
    );

    return NextResponse.json({
      installations: installationsWithRepos,
    });
  } catch (error) {
    console.error('Error fetching installations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installations' },
      { status: 500 }
    );
  }
}