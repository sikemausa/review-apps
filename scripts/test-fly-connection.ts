import 'dotenv/config';
import { getFlyClient } from '../src/lib/fly/client';

async function testFlyConnection() {
  console.log('Testing Fly.io connection...\n');
  
  try {
    const client = getFlyClient();
    
    // Test 1: List apps
    console.log('Fetching apps in your organization...');
    const testAppName = 'review-apps-test-' + Date.now();
    
    // Test 2: Create a test app
    console.log(`\nCreating test app: ${testAppName}`);
    const app = await client.createApp(testAppName);
    console.log('✅ App created:', app.name);
    console.log('   URL:', `https://${app.hostname}`);
    
    // Test 3: Get app details
    console.log('\nFetching app details...');
    const appDetails = await client.getApp(testAppName);
    console.log('✅ App found:', appDetails?.name);
    
    // Test 4: Delete test app
    console.log('\nCleaning up test app...');
    await client.deleteApp(testAppName);
    console.log('✅ App deleted successfully');
    
    console.log('\n🎉 Fly.io connection test passed!');
    console.log('Organization:', process.env.FLY_ORG_SLUG || 'personal');
    
  } catch (error: any) {
    console.error('\n❌ Fly.io connection test failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('401')) {
      console.error('\nAuthentication failed. Please check your FLY_API_TOKEN');
    } else if (error.message.includes('organization')) {
      console.error('\nOrganization issue. Please check FLY_ORG_SLUG in your .env file');
    }
  } finally {
    process.exit(0);
  }
}

testFlyConnection();