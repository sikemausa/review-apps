import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/src/lib/auth-server';
import { getGitHubAccessToken } from '@/src/lib/auth-utils';
import { getUserRepositories } from '@/src/lib/github';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '30');
    const sort = searchParams.get('sort') as 'created' | 'updated' | 'pushed' | 'full_name' || 'updated';

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

    return NextResponse.json({
      repositories,
      pagination: {
        page,
        perPage,
        hasMore: repositories.length === perPage,
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