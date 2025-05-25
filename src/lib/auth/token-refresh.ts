import { db } from '@/src/db';
import { account } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Check if GitHub access token is expired or about to expire
 * Note: GitHub OAuth tokens don't expire unless explicitly revoked
 */
export async function isTokenExpired(expiresAt: Date | null): boolean {
  // GitHub OAuth tokens don't have expiration by default
  // They're valid until revoked by the user
  return false;
}

/**
 * Refresh GitHub access token
 * Note: GitHub OAuth tokens don't support refresh tokens.
 * If a token is invalid, the user must re-authenticate.
 */
export async function refreshGitHubToken(userId: string): Promise<string | null> {
  // GitHub OAuth doesn't support refresh tokens
  // Just return the existing token or null if it doesn't exist
  return getGitHubAccessTokenWithRefresh(userId);
}

/**
 * Get GitHub access token
 * Note: GitHub OAuth tokens don't expire, so we just return the stored token
 */
export async function getGitHubAccessTokenWithRefresh(userId: string): Promise<string | null> {
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

    if (accounts.length === 0) {
      console.log('No GitHub account found for user');
      return null;
    }

    const userAccount = accounts[0];

    // GitHub OAuth tokens don't expire unless revoked
    // If we get a 401, it means the token was revoked and user needs to re-authenticate
    if (!userAccount.accessToken) {
      console.log('No access token found for user');
      return null;
    }

    // Return the access token directly without trying to refresh
    // GitHub OAuth tokens are valid until revoked
    return userAccount.accessToken;
  } catch (error) {
    console.error('Error getting GitHub access token:', error);
    return null;
  }
}

/**
 * Handle GitHub API errors
 * For GitHub OAuth, if we get a 401, the token was revoked and user needs to re-authenticate
 */
export async function handleGitHubApiError(
  error: any,
  userId: string
): Promise<never> {
  // Check if error is due to invalid/revoked token
  if (error.status === 401) {
    console.log('GitHub token was revoked, user needs to re-authenticate');
    
    // Mark the token as invalid in the database
    await db
      .update(account)
      .set({
        accessToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'github')
        )
      );
    
    throw new Error('GitHub authentication expired. Please sign in again.');
  }
  
  if (error.status === 403) {
    throw new Error('GitHub API rate limit exceeded or insufficient permissions.');
  }
  
  // Re-throw other errors
  throw error;
}