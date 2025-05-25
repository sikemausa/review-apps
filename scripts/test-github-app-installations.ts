import 'dotenv/config';
import { getGitHubAppClient } from '../src/lib/github/client';

async function testGitHubAppInstallations() {
  console.log('Testing GitHub App installations...\n');
  
  try {
    const client = getGitHubAppClient();
    
    // Test 1: Get app information
    console.log('1. Getting app info...');
    const { data: appInfo } = await client.apps.getAuthenticated();
    console.log(`✅ App Name: ${appInfo.name}`);
    console.log(`✅ App ID: ${appInfo.id}`);
    console.log(`✅ App Slug: ${appInfo.slug}\n`);
    
    // Test 2: List installations
    console.log('2. Listing installations...');
    const { data: installations } = await client.apps.listInstallations({
      per_page: 100,
    });
    
    if (installations.length === 0) {
      console.log('❌ No installations found!');
      console.log('Please install the app at: https://github.com/apps/' + appInfo.slug);
    } else {
      console.log(`✅ Found ${installations.length} installation(s):\n`);
      
      for (const installation of installations) {
        console.log(`Installation #${installation.id}:`);
        console.log(`  Account: ${installation.account?.login} (${installation.account?.type})`);
        console.log(`  Repository Selection: ${installation.repository_selection}`);
        
        // Get repositories for this installation
        try {
          const { data: repoData } = await client.apps.listReposAccessibleToInstallation({
            installation_id: installation.id,
            per_page: 10,
          });
          
          console.log(`  Repositories (${repoData.total_count} total):`);
          repoData.repositories.slice(0, 5).forEach(repo => {
            console.log(`    - ${repo.full_name} ${repo.private ? '(private)' : '(public)'}`);
          });
          if (repoData.total_count > 5) {
            console.log(`    ... and ${repoData.total_count - 5} more`);
          }
        } catch (error) {
          console.log('  ❌ Could not fetch repositories for this installation');
        }
        console.log();
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.status === 401) {
      console.error('\nAuthentication failed. Please check:');
      console.error('1. GITHUB_APP_ID is correct');
      console.error('2. GITHUB_APP_PRIVATE_KEY is properly formatted');
      console.error('3. The private key matches the app');
    }
  }
}

testGitHubAppInstallations();