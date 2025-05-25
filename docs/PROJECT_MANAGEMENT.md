# Project Management API

This guide explains how to use the project management features in the review apps system.

## Overview

Projects connect GitHub repositories to the deployment system. Each project stores:
- Repository information
- Build configuration
- Environment variables
- Deployment settings

## Database Schema

### Projects Table
- **id**: Unique project identifier
- **userId**: Owner of the project
- **githubRepoId**: GitHub's repository ID
- **repoOwner**: Repository owner (user/org)
- **repoName**: Repository name
- **repoFullName**: Full name (owner/repo)
- **dockerfilePath**: Path to Dockerfile (optional)
- **buildCommand**: Command to build the app
- **installCommand**: Command to install dependencies
- **startCommand**: Command to start the app
- **flyAppNamePrefix**: Prefix for Fly.io app names
- **isActive**: Whether project is active

### Deployments Table
- **id**: Unique deployment identifier
- **projectId**: Associated project
- **prNumber**: Pull request number
- **branch**: Git branch name
- **commitSha**: Git commit SHA
- **flyAppName**: Fly.io app name
- **previewUrl**: Deployment URL
- **status**: Current status (pending, building, ready, failed, etc.)

### Environment Variables Table
- **id**: Unique identifier
- **projectId**: Associated project
- **key**: Variable name
- **value**: Variable value
- **isSecret**: Whether to mask the value

## API Endpoints

### List Projects
```http
GET /api/projects
```

Response:
```json
{
  "projects": [
    {
      "id": "uuid",
      "repoFullName": "owner/repo",
      "dockerfilePath": "./Dockerfile",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Project
```http
POST /api/projects
```

Request:
```json
{
  "repoOwner": "sikemausa",
  "repoName": "my-app",
  "dockerfilePath": "./Dockerfile",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "startCommand": "npm start"
}
```

### Get Project
```http
GET /api/projects/{projectId}
```

Response includes active deployment count.

### Update Project
```http
PATCH /api/projects/{projectId}
```

Request (only include fields to update):
```json
{
  "buildCommand": "npm run build:prod",
  "nodeVersion": "18",
  "isActive": false
}
```

### Delete Project
```http
DELETE /api/projects/{projectId}
```

Cannot delete projects with active deployments.

### Environment Variables

#### List Variables
```http
GET /api/projects/{projectId}/env-vars
```

Secret values are masked in responses.

#### Add Variables
```http
POST /api/projects/{projectId}/env-vars
```

Request:
```json
{
  "variables": [
    {
      "key": "API_URL",
      "value": "https://api.example.com",
      "isSecret": false
    },
    {
      "key": "API_KEY",
      "value": "secret-key-123",
      "isSecret": true
    }
  ]
}
```

#### Delete Variable
```http
DELETE /api/projects/{projectId}/env-vars?varId={varId}
```

### Check Repository
```http
GET /api/projects/check-repo?owner={owner}&repo={repo}
```

Check if a project exists for a repository.

## Webhook Integration

The webhook handler now checks if a project exists before processing PR events:

1. Webhook receives PR event
2. Checks if project exists for repository
3. If no project, ignores the event
4. If project exists, processes deployment

## Setup Flow

1. **User logs in** with GitHub
2. **User installs GitHub App** on repositories
3. **User creates project** for a repository
4. **User configures** build settings and env vars
5. **Webhook processes** PR events for that repository

## Testing

Run the test script to verify the API:

```bash
# First, get your session token from the browser
npx tsx scripts/test-project-api.ts <session-token>
```

## Next Steps

With project management in place, the next steps are:
1. Create UI for project management
2. Implement Fly.io deployment logic
3. Create deployment tracking
4. Add PR comment posting