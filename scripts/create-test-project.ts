#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

async function createTestProject(sessionToken: string) {
  const API_URL = 'http://localhost:3000/api';
  
  console.log('=== Creating Test Project ===\n');
  
  try {
    // First, check current projects
    console.log('1. Checking existing projects...');
    const listResponse = await fetch(`${API_URL}/projects`, {
      headers: {
        'Cookie': `better-auth-session=${sessionToken}`
      }
    });
    
    if (!listResponse.ok) {
      console.error('Failed to list projects:', await listResponse.text());
      return;
    }
    
    const { projects } = await listResponse.json();
    console.log(`Found ${projects.length} existing projects`);
    
    // Create a test project
    console.log('\n2. Creating new project...');
    const createResponse = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Cookie': `better-auth-session=${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        repoOwner: 'sikemausa',
        repoName: 'review-apps',
        dockerfilePath: './Dockerfile',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
        startCommand: 'npm start'
      })
    });
    
    const result = await createResponse.json();
    
    if (!createResponse.ok) {
      console.error('Failed to create project:', result);
      
      // If it's a 403, user might not have access
      if (createResponse.status === 403) {
        console.log('\n💡 Make sure:');
        console.log('1. You have access to the repository');
        console.log('2. Your GitHub token has the right permissions');
      }
      
      // If it's a 409, project already exists
      if (createResponse.status === 409) {
        console.log('\n✅ Project already exists for this repository');
        // Get the existing project
        const existing = projects.find((p: any) => 
          p.repoOwner === 'sikemausa' && p.repoName === 'review-apps'
        );
        if (existing) {
          console.log('Project ID:', existing.id);
          console.log('Created:', new Date(existing.createdAt).toLocaleString());
        }
      }
      return;
    }
    
    console.log('✅ Project created successfully!');
    console.log('Project ID:', result.project.id);
    console.log('Repository:', result.project.repoFullName);
    console.log('Fly App Prefix:', result.project.flyAppNamePrefix);
    
    // Add some environment variables
    console.log('\n3. Adding environment variables...');
    const envResponse = await fetch(`${API_URL}/projects/${result.project.id}/env-vars`, {
      method: 'POST',
      headers: {
        'Cookie': `better-auth-session=${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        variables: [
          { key: 'NODE_ENV', value: 'production', isSecret: false },
          { key: 'DATABASE_URL', value: 'postgresql://...', isSecret: true }
        ]
      })
    });
    
    if (envResponse.ok) {
      console.log('✅ Environment variables added');
    }
    
    console.log('\n🎉 Project setup complete!');
    console.log('Now when you create a PR in sikemausa/review-apps, it will trigger a deployment.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get session token from command line
const SESSION_TOKEN = process.argv[2];

if (!SESSION_TOKEN) {
  console.log('Usage: npx tsx scripts/create-test-project.ts <session-token>');
  console.log('\nTo get a session token:');
  console.log('1. Log in to the app at http://localhost:3000');
  console.log('2. Open browser dev tools > Application > Cookies');
  console.log('3. Copy the value of "better-auth-session" cookie');
} else {
  createTestProject(SESSION_TOKEN).catch(console.error);
}