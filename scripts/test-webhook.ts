#!/usr/bin/env node
import { createHmac } from 'crypto';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

// Test script for GitHub webhook endpoint
// Usage: tsx scripts/test-webhook.ts

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/github';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';

console.log('Using webhook secret:', WEBHOOK_SECRET);

// Sample pull request webhook payload
const samplePayload = {
  action: 'opened',
  number: 1,
  pull_request: {
    id: 123456,
    number: 1,
    title: 'Test PR for webhook',
    state: 'open',
    head: {
      ref: 'feature-branch',
      sha: 'abc123def456',
      repo: {
        name: 'test-repo',
        full_name: 'testuser/test-repo',
        owner: {
          login: 'testuser'
        },
        clone_url: 'https://github.com/testuser/test-repo.git'
      }
    },
    base: {
      ref: 'main',
      repo: {
        name: 'test-repo',
        full_name: 'testuser/test-repo',
        owner: {
          login: 'testuser'
        }
      }
    },
    user: {
      login: 'testuser',
      id: 789012
    },
    draft: false,
    merged: false,
    mergeable: true,
    mergeable_state: 'clean',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: null,
    merged_at: null,
    body: 'This is a test pull request'
  },
  repository: {
    id: 987654,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    private: false,
    owner: {
      login: 'testuser',
      id: 789012,
      avatar_url: 'https://avatars.githubusercontent.com/u/789012',
      url: 'https://api.github.com/users/testuser',
      type: 'User'
    },
    clone_url: 'https://github.com/testuser/test-repo.git',
    default_branch: 'main'
  },
  sender: {
    login: 'testuser',
    id: 789012,
    avatar_url: 'https://avatars.githubusercontent.com/u/789012',
    url: 'https://api.github.com/users/testuser',
    type: 'User'
  },
  installation: {
    id: 111222,
    account: {
      login: 'testuser',
      id: 789012,
      avatar_url: 'https://avatars.githubusercontent.com/u/789012',
      url: 'https://api.github.com/users/testuser',
      type: 'User'
    },
    repository_selection: 'selected' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
};

async function testWebhook(action: string = 'opened') {
  const payload = { ...samplePayload, action };
  const body = JSON.stringify(payload);
  
  // Calculate signature
  const hmac = createHmac('sha256', WEBHOOK_SECRET);
  const signature = `sha256=${hmac.update(body).digest('hex')}`;
  
  console.log(`Testing webhook with action: ${action}`);
  console.log(`URL: ${WEBHOOK_URL}`);
  console.log(`Signature: ${signature}`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Delivery': `test-${Date.now()}`,
        'X-GitHub-Hook-ID': '123456',
        'X-GitHub-Hook-Installation-Target-ID': '111222',
        'X-GitHub-Hook-Installation-Target-Type': 'integration'
      },
      body
    });
    
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const result = await response.json();
      console.log(`Response (${response.status}):`, result);
      
      if (!response.ok) {
        console.error('❌ Webhook test failed');
      } else {
        console.log('✅ Webhook test successful');
      }
    } else {
      const text = await response.text();
      console.error('❌ Webhook returned non-JSON response:');
      console.error('Status:', response.status);
      console.error('Content-Type:', contentType);
      console.error('Response:', text.substring(0, 200) + '...');
    }
  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }
}

// Test different PR actions
async function runTests() {
  console.log('=== GitHub Webhook Test Suite ===\n');
  
  // Test GET endpoint
  console.log('Testing GET endpoint...');
  try {
    const getResponse = await fetch(WEBHOOK_URL);
    const contentType = getResponse.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const getResult = await getResponse.json();
      console.log('GET Response:', getResult);
      console.log('✅ GET endpoint working\n');
    } else {
      const text = await getResponse.text();
      console.error('❌ GET endpoint returned non-JSON response:');
      console.error('Status:', getResponse.status);
      console.error('Content-Type:', contentType);
      console.error('Response:', text.substring(0, 200) + '...\n');
    }
  } catch (error) {
    console.error('❌ GET endpoint failed:', error);
  }
  
  // Test PR opened
  await testWebhook('opened');
  console.log();
  
  // Test PR synchronized  
  await testWebhook('synchronize');
  console.log();
  
  // Test PR closed
  await testWebhook('closed');
  console.log();
  
  // Test unsupported action (should be ignored)
  await testWebhook('labeled');
}

// Run tests
runTests().catch(console.error);