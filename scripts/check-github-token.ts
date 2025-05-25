import 'dotenv/config';
import { db } from '../src/db';
import { account, session as sessionTable, user } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function checkGitHubTokens() {
  console.log('Checking GitHub tokens in database...\n');
  
  try {
    // Get all users
    const users = await db.select().from(user);
    console.log(`Found ${users.length} users:\n`);
    
    for (const u of users) {
      console.log(`User: ${u.email} (${u.id})`);
      
      // Check accounts
      const accounts = await db
        .select()
        .from(account)
        .where(eq(account.userId, u.id));
      
      const githubAccount = accounts.find(a => a.providerId === 'github');
      if (githubAccount) {
        console.log(`  ✅ Has GitHub account`);
        console.log(`  - Account ID: ${githubAccount.accountId}`);
        console.log(`  - Has access token: ${!!githubAccount.accessToken}`);
        console.log(`  - Has refresh token: ${!!githubAccount.refreshToken}`);
      } else {
        console.log(`  ❌ No GitHub account found`);
      }
      
      // Check active sessions
      const sessions = await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.userId, u.id));
      
      const activeSessions = sessions.filter(s => new Date(s.expiresAt) > new Date());
      console.log(`  - Active sessions: ${activeSessions.length}`);
      
      console.log();
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkGitHubTokens();