import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { getGitHubAccessToken } from '@/src/lib/auth-utils';
import { getUserInstallations, getInstallationRepositories } from '@/src/lib/github';

export async function GET(request: NextRequest) {
  try {
    // Check authentication using better-auth's built-in method
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    
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
    console.log('Fetching installations for user:', session.user.id);
    const installations = await getUserInstallations(accessToken);
    console.log('Found installations:', installations.length);

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
      debug: {
        userHasToken: !!accessToken,
        installationCount: installations.length,
      }
    });
  } catch (error) {
    console.error('Error fetching installations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installations' },
      { status: 500 }
    );
  }
}