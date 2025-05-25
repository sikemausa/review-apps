#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

async function testGitHubAppStatus() {
  console.log('=== GitHub App Status Test ===\n');

  // You'll need to get a valid session token first
  // For testing, you can get this from your browser's dev tools after logging in
  const SESSION_TOKEN = process.env.TEST_SESSION_TOKEN || 'your-session-token-here';
  
  if (SESSION_TOKEN === 'your-session-token-here') {
    console.log('⚠️  Please set a valid session token to test this endpoint.');
    console.log('\nTo get a session token:');
    console.log('1. Log in to the app at http://localhost:3000/login');
    console.log('2. Open browser dev tools > Application > Cookies');
    console.log('3. Copy the value of "better-auth-session" cookie');
    console.log('4. Run: TEST_SESSION_TOKEN=<token> npx tsx scripts/test-github-app-status.ts');
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/github/app/status', {
      headers: {
        'Cookie': `better-auth-session=${SESSION_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}`);
      const error = await response.json();
      console.error('Error:', error);
      return;
    }

    const data = await response.json();
    console.log('✅ GitHub App Status:');
    console.log(JSON.stringify(data, null, 2));

    // Interpret the results
    if (!data.hasGitHubConnection) {
      console.log('\n⚠️  GitHub account not connected. User needs to reconnect GitHub OAuth.');
    } else if (!data.hasAppInstallations) {
      console.log('\n⚠️  GitHub App not installed. Direct user to /setup/github');
    } else {
      console.log(`\n✅ GitHub App is installed on ${data.installationCount} account(s)`);
      data.installations?.forEach((inst: any) => {
        console.log(`   - ${inst.account} (${inst.type}) - ${inst.repositorySelection} repos`);
      });
    }
  } catch (error) {
    console.error('❌ Error testing GitHub App status:', error);
  }
}

// Run the test
testGitHubAppStatus().catch(console.error);