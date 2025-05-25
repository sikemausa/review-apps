import { auth } from './auth';
import { headers } from 'next/headers';
import type { Session, User } from 'better-auth';

export async function getSession(): Promise<{ user: User; session: Session } | null> {
  try {
    const sessionData = await auth.api.getSession({
      headers: await headers()
    });
    
    if (!sessionData?.user || !sessionData?.session) {
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  return session;
}