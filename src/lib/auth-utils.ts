import { db } from '@/src/db';
import { account, session as sessionTable } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getGitHubAccessToken(userId: string): Promise<string | null> {
  try {
    const accounts = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'github')
        )
      )
      .limit(1);

    return accounts[0]?.accessToken || null;
  } catch (error) {
    console.error('Error fetching GitHub access token:', error);
    return null;
  }
}

export async function getSessionFromHeaders(request: Request) {
  // Better Auth uses 'better-auth.session_token' as the cookie name
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = cookieHeader?.match(/better-auth\.session_token=([^;]+)/)?.[1] ||
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