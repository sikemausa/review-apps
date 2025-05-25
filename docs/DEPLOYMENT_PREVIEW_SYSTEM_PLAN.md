# Deployment Preview System Plan

## Overview
This document outlines the architecture, data models, and user flows for implementing a GitHub PR deployment preview system.

## Data Models

### 1. Projects
Represents a GitHub repository with deployment preview enabled.
```typescript
projects {
  id: string (uuid)
  userId: string (FK -> user.id)
  githubRepoId: number
  githubRepoFullName: string (e.g., "owner/repo")
  githubInstallationId: number
  deploymentConfig: json {
    buildCommand?: string
    installCommand?: string
    startCommand?: string
    port?: number
    envVars?: Record<string, string>
    dockerfilePath?: string
    flyConfig?: object
  }
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 2. Deployments
Tracks individual deployment instances for PRs.
```typescript
deployments {
  id: string (uuid)
  projectId: string (FK -> projects.id)
  prNumber: number
  prTitle: string
  prAuthor: string
  commitSha: string
  flyAppName: string (e.g., "pr-123-repo-name")
  flyAppUrl: string
  status: enum ['pending', 'building', 'deploying', 'active', 'failed', 'destroyed']
  error?: string
  startedAt: timestamp
  completedAt?: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 3. Deployment Logs
Stores build and deployment logs.
```typescript
deploymentLogs {
  id: string (uuid)
  deploymentId: string (FK -> deployments.id)
  type: enum ['build', 'deploy', 'runtime']
  message: text
  level: enum ['info', 'warning', 'error']
  timestamp: timestamp
}
```

### 4. Project Secrets
Encrypted environment variables for projects.
```typescript
projectSecrets {
  id: string (uuid)
  projectId: string (FK -> projects.id)
  name: string
  encryptedValue: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

## User Flows

### 1. Initial Setup Flow
1. **Login** → User logs in with GitHub OAuth
2. **Install GitHub App** → Redirect to GitHub to install app on repositories
3. **Select Repository** → Show list of accessible repos, user selects one
4. **Configure Deployment** → User provides:
   - Build configuration (commands, Dockerfile, etc.)
   - Environment variables
   - Port configuration
5. **Save & Activate** → Create project record and listen for webhooks

### 2. PR Deployment Flow (Automated)
1. **Webhook Received** → PR opened/synchronized/reopened
2. **Create Deployment** → Record in database with 'pending' status
3. **Post GitHub Comment** → "🚀 Deploying preview..."
4. **Build & Deploy** → 
   - Clone repository
   - Run build commands
   - Create Fly.io app
   - Deploy to Fly.io
5. **Update Status** → 
   - Update deployment record
   - Update GitHub PR comment with URL
   - Post deployment status to GitHub

### 3. Management Flow
1. **Dashboard View** → List all projects and recent deployments
2. **Project Settings** → Update configuration, secrets, or disable
3. **Deployment Details** → View logs, status, and manual actions
4. **Manual Actions** → Redeploy, destroy, or view logs

## Implementation Phases

### Phase 1: Core Data Layer (Week 1)
- [ ] Create database schemas
- [ ] Set up Drizzle migrations
- [ ] Create TypeScript types
- [ ] Build basic CRUD operations

### Phase 2: Repository Setup Flow (Week 1-2)
- [ ] Create repository selection UI
- [ ] Build configuration form
- [ ] Implement project creation API
- [ ] Add environment variable management

### Phase 3: Deployment Tracking (Week 2)
- [ ] Enhance webhook handler for deployment creation
- [ ] Build deployment status tracking
- [ ] Implement GitHub status/comment updates
- [ ] Create deployment detail views

### Phase 4: Fly.io Integration (Week 3)
- [ ] Design Fly.io app naming convention
- [ ] Implement deployment orchestration
- [ ] Add deployment cleanup for closed PRs
- [ ] Handle deployment failures gracefully

### Phase 5: Dashboard & Management (Week 3-4)
- [ ] Build project dashboard
- [ ] Create deployment history views
- [ ] Add log streaming/viewing
- [ ] Implement manual deployment controls

### Phase 6: Polish & Advanced Features (Week 4+)
- [ ] Add deployment metrics
- [ ] Implement resource limits
- [ ] Add custom domain support
- [ ] Build notification system

## Technical Considerations

### Security
- Encrypt all secrets at rest
- Validate GitHub webhook signatures
- Implement proper access controls
- Sanitize user inputs for commands

### Scalability
- Queue deployment jobs (consider Bull/BullMQ)
- Implement deployment timeouts
- Add resource limits per user/project
- Consider caching GitHub API responses

### User Experience
- Real-time deployment status updates (consider SSE or WebSockets)
- Clear error messages and recovery options
- Progressive disclosure of advanced options
- Mobile-responsive dashboard

### Integration Points
- GitHub App permissions: 
  - Read repository contents
  - Write PR comments
  - Create deployment statuses
- Fly.io API:
  - Create/destroy apps
  - Deploy Docker images
  - Manage secrets
  - Monitor app status

## Next Steps
1. Review and approve this plan
2. Set up development environment
3. Create database migrations
4. Begin Phase 1 implementation