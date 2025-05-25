import 'dotenv/config';
import { DeploymentService } from '../src/lib/fly/deployment-service';
import { db } from '../src/db';
import { project, deployment } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function testDeployment() {
  console.log('Testing deployment service...\n');
  
  try {
    // Get the first project from the database
    const [testProject] = await db
      .select()
      .from(project)
      .limit(1);
    
    if (!testProject) {
      console.error('No projects found in database. Please add a project first.');
      process.exit(1);
    }
    
    console.log(`Using project: ${testProject.githubRepoFullName}`);
    
    const deploymentService = new DeploymentService();
    
    // Test deployment configuration
    const testConfig = {
      projectId: testProject.id,
      prNumber: 999, // Test PR number
      prTitle: 'Test Deployment',
      prAuthor: 'test-user',
      commitSha: 'abc123def456',
      repoFullName: testProject.githubRepoFullName,
      installationId: testProject.githubInstallationId,
    };
    
    console.log('\nStarting test deployment...');
    const deploymentId = await deploymentService.deployPullRequest(testConfig);
    
    console.log(`\nDeployment ID: ${deploymentId}`);
    
    // Get deployment details
    const [deploymentData] = await db
      .select()
      .from(deployment)
      .where(eq(deployment.id, deploymentId))
      .limit(1);
    
    if (deploymentData) {
      console.log('Deployment Status:', deploymentData.status);
      console.log('Fly App Name:', deploymentData.flyAppName);
      console.log('Fly App URL:', deploymentData.flyAppUrl);
    }
    
    // Clean up - optional
    console.log('\nWould you like to destroy this test deployment? (y/n)');
    process.stdin.once('data', async (data) => {
      if (data.toString().trim().toLowerCase() === 'y') {
        console.log('Destroying deployment...');
        await deploymentService.destroyDeployment(deploymentId);
        console.log('Deployment destroyed.');
      }
      process.exit(0);
    });
    
  } catch (error: any) {
    console.error('\n❌ Deployment test failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testDeployment();