import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { db } from '@/src/db';
import { session as sessionTable } from '@/src/db/schema';

export async function GET(request: NextRequest) {
  try {
    // Log all headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Get cookie header specifically
    const cookieHeader = request.headers.get('cookie');
    const cookies = cookieHeader ? Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, value] = c.trim().split('=');
        return [key, value];
      })
    ) : {};
    
    // Get all sessions from database
    const sessions = await db.select().from(sessionTable).limit(5);
    
    // Try to get session using Better Auth's method
    let betterAuthSession = null;
    try {
      // Better Auth might have a different way to get sessions
      const sessionCookie = cookies['better-auth-session'];
      if (sessionCookie) {
        // Try to validate it
        betterAuthSession = { token: sessionCookie };
      }
    } catch (e) {
      console.error('Error getting Better Auth session:', e);
    }
    
    return NextResponse.json({
      headers,
      cookies,
      dbSessions: sessions.map(s => ({
        id: s.id,
        token: s.token.substring(0, 20) + '...',
        expiresAt: s.expiresAt,
        userId: s.userId
      })),
      betterAuthSession,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}