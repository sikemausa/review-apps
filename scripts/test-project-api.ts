#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const API_URL = 'http://localhost:3000/api';

async function testProjectAPI(sessionToken: string) {
  console.log('=== Project API Test Suite ===\n');

  const headers = {
    'Cookie': `better-auth-session=${sessionToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. List projects
    console.log('1. Testing GET /api/projects...');
    const listResponse = await fetch(`${API_URL}/projects`, { headers });
    const listData = await listResponse.json();
    console.log('Projects:', listData);

    // 2. Create a test project
    console.log('\n2. Testing POST /api/projects...');
    const createResponse = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        repoOwner: 'test-owner',
        repoName: 'test-repo',
        dockerfilePath: './Dockerfile',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
        startCommand: 'npm start'
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.log('Create project response:', error);
    } else {
      const createData = await createResponse.json();
      console.log('Created project:', createData);

      if (createData.project) {
        const projectId = createData.project.id;

        // 3. Get project details
        console.log(`\n3. Testing GET /api/projects/${projectId}...`);
        const getResponse = await fetch(`${API_URL}/projects/${projectId}`, { headers });
        const getData = await getResponse.json();
        console.log('Project details:', getData);

        // 4. Update project
        console.log(`\n4. Testing PATCH /api/projects/${projectId}...`);
        const updateResponse = await fetch(`${API_URL}/projects/${projectId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            buildCommand: 'npm run build:prod',
            nodeVersion: '18'
          })
        });
        const updateData = await updateResponse.json();
        console.log('Updated project:', updateData);

        // 5. Add environment variables
        console.log(`\n5. Testing POST /api/projects/${projectId}/env-vars...`);
        const envResponse = await fetch(`${API_URL}/projects/${projectId}/env-vars`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            variables: [
              { key: 'API_URL', value: 'https://api.example.com', isSecret: false },
              { key: 'API_KEY', value: 'secret-key-123', isSecret: true }
            ]
          })
        });
        const envData = await envResponse.json();
        console.log('Added env vars:', envData);

        // 6. List environment variables
        console.log(`\n6. Testing GET /api/projects/${projectId}/env-vars...`);
        const listEnvResponse = await fetch(`${API_URL}/projects/${projectId}/env-vars`, { headers });
        const listEnvData = await listEnvResponse.json();
        console.log('Environment variables:', listEnvData);
      }
    }

    // 7. Check repository
    console.log('\n7. Testing GET /api/projects/check-repo...');
    const checkResponse = await fetch(`${API_URL}/projects/check-repo?owner=test-owner&repo=test-repo`, { headers });
    const checkData = await checkResponse.json();
    console.log('Repository check:', checkData);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Get session token from command line or environment
const SESSION_TOKEN = process.argv[2] || process.env.TEST_SESSION_TOKEN;

if (!SESSION_TOKEN || SESSION_TOKEN === 'your-session-token-here') {
  console.log('Usage: npx tsx scripts/test-project-api.ts <session-token>');
  console.log('\nTo get a session token:');
  console.log('1. Log in to the app');
  console.log('2. Open browser dev tools > Application > Cookies');
  console.log('3. Copy the value of "better-auth-session" cookie');
} else {
  testProjectAPI(SESSION_TOKEN).catch(console.error);
}