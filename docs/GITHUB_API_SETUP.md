# GitHub API Client Setup

This guide explains how to set up and use the GitHub API client in the review apps system.

## Overview

The GitHub API client provides:
- GitHub App authentication
- OAuth user authentication  
- Repository access and information
- Pull request comment management
- Installation management

## Configuration

### 1. Create a GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Configure with these settings:

**Basic Information:**
- **Name**: Your App Name (e.g., "Review Apps Bot")
- **Homepage URL**: Your app URL
- **Webhook URL**: `https://your-domain.com/api/webhooks/github`
- **Webhook Secret**: Generate a secure random string

**Permissions:**
- **Repository permissions:**
  - Contents: Read
  - Issues: Write (for PR comments)
  - Pull requests: Write
  - Actions: Read (optional)
- **Account permissions:**
  - Email addresses: Read (optional)

**Subscribe to events:**
- Pull request
- Pull request review
- Pull request review comment

**Where can this GitHub App be installed?**
- Choose based on your needs (personal or any account)

**Installation Settings:**
- **Setup URL** (optional): `https://your-domain.com/setup/github`
- **Callback URL**: `https://your-domain.com/api/github/app/callback`
- **Request user authorization during installation**: Yes

### 2. Generate Private Key

After creating the app:
1. Scroll to "Private keys" section
2. Click "Generate a private key"
3. Save the downloaded .pem file

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
[Your full private key here]
-----END RSA PRIVATE KEY-----"

# GitHub OAuth (already configured)
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Webhook Secret
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

## Usage Examples

### 1. Post Deployment Comment

```typescript
import { postDeploymentComment } from '@/src/lib/github';

// Post a deployment status to a PR
await postDeploymentComment(
  'owner',
  'repo', 
  123, // PR number
  {
    status: 'success',
    url: 'https://pr-123-myapp.fly.dev',
    startedAt: new Date(),
    completedAt: new Date()
  }
);
```

### 2. Get User Repositories

```typescript
import { getUserRepositories } from '@/src/lib/github';

// In an API route with authenticated user
const repos = await getUserRepositories(accessToken, {
  page: 1,
  perPage: 30,
  sort: 'updated'
});
```

### 3. Check App Installation

```typescript
import { isAppInstalledOnRepo } from '@/src/lib/github';

const isInstalled = await isAppInstalledOnRepo('owner', 'repo');
if (!isInstalled) {
  // Prompt user to install the app
}
```

## API Endpoints

### List User Repositories
```
GET /api/github/repos?page=1&per_page=30&sort=updated
```

Response:
```json
{
  "repositories": [
    {
      "id": 123,
      "name": "my-repo",
      "fullName": "user/my-repo",
      "private": false,
      "defaultBranch": "main",
      "cloneUrl": "https://github.com/user/my-repo.git"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 30,
    "hasMore": true
  }
}
```

### Get User Installations
```
GET /api/github/installations
```

Response:
```json
{
  "installations": [
    {
      "id": 12345,
      "account": {
        "login": "username",
        "type": "User"
      },
      "repositories": [
        {
          "id": 123,
          "name": "repo-name",
          "fullName": "user/repo-name"
        }
      ]
    }
  ]
}
```

### Check Repository Installation
```
GET /api/github/repos/{owner}/{repo}/installation
```

Response:
```json
{
  "installed": true,
  "repository": {
    "owner": "owner",
    "name": "repo",
    "fullName": "owner/repo"
  }
}
```

## Testing

Run the test script to verify your configuration:

```bash
npx tsx scripts/test-github-client.ts
```

This will:
1. Test GitHub App client creation
2. Verify API credentials
3. Test comment generation
4. Check service imports

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Validate webhook signatures** - Already implemented in webhook handler
3. **Limit permissions** - Only request necessary GitHub App permissions
4. **Token rotation** - Installation tokens expire after 1 hour
5. **Access control** - Always verify user has repository access

## Troubleshooting

### "Bad credentials" error
- Verify GITHUB_APP_ID is correct
- Check private key format (must include BEGIN/END lines)
- Ensure no extra whitespace in credentials

### "Not found" errors
- Verify the GitHub App is installed on the repository
- Check user has access to the repository
- Ensure correct OAuth scopes

### Webhook signature failures
- Verify GITHUB_WEBHOOK_SECRET matches GitHub App settings
- Check for trailing whitespace in secret

## Next Steps

With the GitHub API client configured, you can:
1. Implement deployment triggers from PR events
2. Post deployment status comments
3. Verify repository access before creating projects
4. List repositories for project creation UI