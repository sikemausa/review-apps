import { db } from '@/src/db';
import { session as sessionTable } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

export async function getGitHubAccessToken(userId: string): Promise<string | null> {
  try {
    // Use the token refresh logic
    const { getGitHubAccessTokenWithRefresh } = await import('./auth/token-refresh');
    return await getGitHubAccessTokenWithRefresh(userId);
  } catch (error) {
    console.error('Error fetching GitHub access token:', error);
    return null;
  }
}

export async function getSessionFromHeaders(request: Request) {
  // Better Auth uses 'better-auth-session' as the default cookie name
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = cookieHeader?.match(/better-auth-session=([^;]+)/)?.[1] ||
                       request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return null;
  }

  const sessions = await db
    .select()
    .from(sessionTable)
    .where(eq(sessionTable.token, sessionToken))
    .limit(1);

  if (!sessions[0] || new Date(sessions[0].expiresAt) < new Date()) {
    return null;
  }

  return sessions[0];
}

export async function getCurrentUserGitHubToken(request: Request): Promise<string | null> {
  const session = await getSessionFromHeaders(request);
  if (!session?.userId) {
    return null;
  }
  
  return getGitHubAccessToken(session.userId);
}