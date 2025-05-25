import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { getGitHubAccessToken } from '@/src/lib/auth-utils';
import { getUserRepositories } from '@/src/lib/github';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '30');
    const sort = searchParams.get('sort') as 'created' | 'updated' | 'pushed' | 'full_name' || 'updated';
    const installationId = searchParams.get('installationId');

    // Get GitHub access token from database
    const accessToken = await getGitHubAccessToken(session.user.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found. Please reconnect your GitHub account.' },
        { status: 400 }
      );
    }

    // Get user's repositories
    const repositories = await getUserRepositories(accessToken, {
      page,
      perPage,
      sort,
    });

    // If installation ID is provided, filter repositories by those accessible to the installation
    let filteredRepositories = repositories;
    if (installationId) {
      // For now, return all repositories since we're using "all" repository selection
      // In a production app, you'd want to filter based on the actual installation settings
      filteredRepositories = repositories;
    }

    return NextResponse.json({
      repositories: filteredRepositories,
      pagination: {
        page,
        perPage,
        hasMore: filteredRepositories.length === perPage,
      },
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}