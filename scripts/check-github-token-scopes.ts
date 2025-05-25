import 'dotenv/config';
import { db } from '../src/db';
import { account } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { createUserClient } from '../src/lib/github/client';

async function checkTokenScopes() {
  console.log('Checking GitHub token scopes...\n');
  
  try {
    // Get the first user's GitHub token
    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.providerId, 'github'))
      .limit(1);
    
    if (!accounts[0] || !accounts[0].accessToken) {
      console.log('No GitHub account with token found');
      return;
    }
    
    const accessToken = accounts[0].accessToken;
    console.log('Found GitHub token for account:', accounts[0].accountId);
    
    // Create a client and make a request to check scopes
    const client = createUserClient(accessToken);
    
    try {
      // Make a simple request to get rate limit (which includes scopes in headers)
      const { headers } = await client.rateLimit.get();
      console.log('\nToken scopes:', headers['x-oauth-scopes'] || 'No scopes header');
      
      // Test if we can access installations
      console.log('\nTesting installations access...');
      const { data } = await client.apps.listInstallationsAccessibleToUser();
      console.log('Installations accessible:', data.total_count);
      
    } catch (error: any) {
      console.error('\nError checking token:', error.message);
      if (error.status === 403) {
        console.log('\n⚠️  Token does not have permission to access installations');
        console.log('The GitHub OAuth app needs to request additional scopes');
      }
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    process.exit(0);
  }
}

checkTokenScopes();