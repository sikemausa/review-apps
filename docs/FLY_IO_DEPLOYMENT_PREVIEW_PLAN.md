# Deployment Preview System - Fly.io Implementation Plan

## Overview
A GitHub App that automatically creates deployment previews for pull requests, reimplemented as a Next.js monolith deployed on Fly.io with Neon PostgreSQL and Drizzle ORM.

## Tech Stack
- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Database**: Neon (Serverless PostgreSQL) with Drizzle ORM
- **Deployment Platform**: Fly.io
- **Authentication**: NextAuth.js with GitHub OAuth
- **Styling**: Tailwind CSS + shadcn/ui
- **Background Jobs**: Vercel's Background Functions or BullMQ
- **Container Registry**: Fly.io's built-in registry

## Core Features to Implement

### 1. GitHub App Integration
- **Webhook Receiver**: Next.js API route (`/api/webhooks/github`) to handle PR events
- **GitHub OAuth**: NextAuth.js provider for user authentication
- **GitHub API Client**: Octokit for interacting with GitHub API
- **App Installation Flow**: Handle GitHub App installation callbacks

### 2. Project Management
- **Project CRUD**: Create, configure, and delete projects
- **Repository Connection**: Link GitHub repos to projects
- **Build Configuration**: 
  - Dockerfile path specification
  - Auto-Dockerfile generation
  - Environment variable management
  - Build command customization

### 3. Deployment Pipeline
- **Fly.io App Creation**: Dynamic app creation per PR using Fly.io API
- **Build Process**:
  - Clone repository from GitHub
  - Build Docker image
  - Push to Fly.io registry
  - Deploy to Fly.io
- **Preview URL Generation**: `pr-{number}-{project}.fly.dev` format
- **Health Checking**: Poll deployment status until ready

### 4. PR Comment Management
- **Progress Tracking**: Real-time deployment status with progress indicators
- **Preview URL Display**: Post preview links to PR comments
- **Status Updates**: Edit existing comments with deployment progress
- **Error Reporting**: Clear error messages when deployments fail

### 5. Cleanup Operations
- **PR Close Handler**: Automatically destroy Fly.io apps when PRs close
- **Resource Management**: Track and clean up orphaned deployments
- **Cost Control**: Implement deployment limits per user/project

## Database Schema (Drizzle)

```typescript
// schema/users.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').unique().notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// schema/projects.ts
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  repoOwner: varchar('repo_owner', { length: 255 }).notNull(),
  repoName: varchar('repo_name', { length: 255 }).notNull(),
  dockerfilePath: varchar('dockerfile_path', { length: 255 }),
  buildCommand: text('build_command'),
  installCommand: text('install_command'),
  flyAppPrefix: varchar('fly_app_prefix', { length: 255 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// schema/deployments.ts
export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  prNumber: integer('pr_number').notNull(),
  prTitle: text('pr_title'),
  branch: varchar('branch', { length: 255 }).notNull(),
  commitSha: varchar('commit_sha', { length: 255 }).notNull(),
  flyAppName: varchar('fly_app_name', { length: 255 }).unique(),
  previewUrl: text('preview_url'),
  status: varchar('status', { length: 50 }).notNull(), // pending, building, deploying, ready, failed
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at')
});

// schema/envVars.ts
export const envVars = pgTable('env_vars', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  key: varchar('key', { length: 255 }).notNull(),
  value: text('value').notNull(),
  isSecret: boolean('is_secret').default(false),
  createdAt: timestamp('created_at').defaultNow()
});
```

## API Routes Structure

```
app/
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts         # NextAuth.js handlers
│   ├── webhooks/
│   │   └── github/
│   │       └── route.ts         # GitHub webhook receiver
│   ├── projects/
│   │   ├── route.ts            # List/Create projects
│   │   └── [id]/
│   │       ├── route.ts        # Get/Update/Delete project
│   │       └── env-vars/
│   │           └── route.ts    # Manage env vars
│   ├── github/
│   │   ├── repos/
│   │   │   └── route.ts        # List user's repos
│   │   └── installations/
│   │       └── route.ts        # Check app installations
│   └── deployments/
│       ├── route.ts            # List deployments
│       └── [id]/
│           └── route.ts        # Get deployment details
```

## UI Pages Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx           # GitHub OAuth login
│   └── callback/
│       └── page.tsx           # OAuth callback handler
├── (dashboard)/
│   ├── layout.tsx             # Dashboard layout with nav
│   ├── page.tsx               # Dashboard home
│   ├── projects/
│   │   ├── page.tsx           # Projects list
│   │   ├── new/
│   │   │   └── page.tsx       # Create project
│   │   └── [id]/
│   │       ├── page.tsx       # Project details
│   │       └── settings/
│   │           └── page.tsx   # Project settings
│   └── deployments/
│       └── page.tsx           # All deployments
└── setup/
    └── page.tsx               # GitHub App setup guide
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Next.js project setup with TypeScript
- [ ] Neon database provisioning
- [ ] Drizzle ORM setup and migrations
- [ ] NextAuth.js GitHub OAuth integration
- [ ] Basic UI components with shadcn/ui

### Phase 2: GitHub Integration (Week 2)
- [ ] GitHub webhook receiver endpoint
- [ ] GitHub API client setup
- [ ] PR event handlers (opened, synchronized, closed)
- [ ] GitHub App installation flow
- [ ] Repository listing and selection

### Phase 3: Project Management (Week 3)
- [ ] Project CRUD operations
- [ ] Environment variable management
- [ ] Build configuration UI
- [ ] Project dashboard with deployment history

### Phase 4: Fly.io Integration (Week 4-5)
- [ ] Fly.io API client implementation
- [ ] Dynamic app creation/deletion
- [ ] Docker image building pipeline
- [ ] Deployment orchestration
- [ ] Health check polling

### Phase 5: Deployment Pipeline (Week 6)
- [ ] Git clone functionality
- [ ] Dockerfile generation logic
- [ ] Build queue management
- [ ] Progress tracking system
- [ ] Error handling and recovery

### Phase 6: Polish & Production (Week 7-8)
- [ ] PR comment formatting
- [ ] Real-time deployment status (Server-Sent Events)
- [ ] Usage limits and quotas
- [ ] Monitoring and alerting
- [ ] Documentation
- [ ] Production deployment to Fly.io

## Key Implementation Details

### Webhook Security
```typescript
// Verify GitHub webhook signatures
import { createHmac } from 'crypto';

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return digest === signature;
}
```

### Fly.io App Management
```typescript
// Create Fly.io app for PR
async function createFlyApp(projectId: string, prNumber: number) {
  const appName = `pr-${prNumber}-${projectId}`.toLowerCase();
  
  // Use Fly.io Machines API
  const response = await fetch(`https://api.fly.io/v1/apps`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app_name: appName,
      org_slug: process.env.FLY_ORG_SLUG
    })
  });
  
  return response.json();
}
```

### Background Job Processing
```typescript
// Using Vercel Background Functions or BullMQ
export async function deploymentJob(deploymentId: string) {
  // 1. Clone repository
  // 2. Build Docker image
  // 3. Push to Fly.io registry
  // 4. Deploy to Fly.io
  // 5. Update deployment status
  // 6. Post PR comment
}
```

## Environment Variables

```env
# .env.local
DATABASE_URL=postgresql://...@neon.tech/...
NEXTAUTH_URL=https://your-app.fly.dev
NEXTAUTH_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...
FLY_API_TOKEN=...
FLY_ORG_SLUG=...
```

## Deployment Configuration

```toml
# fly.toml
app = "deployment-previews"
primary_region = "iad"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "3000"
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 3000
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

## Cost Optimization

1. **Auto-scaling**: Use Fly.io's auto-stop/start for preview apps
2. **Resource Limits**: Set CPU/memory limits for preview deployments
3. **Expiration**: Auto-delete preview apps after 7 days of inactivity
4. **Quotas**: Implement per-user deployment limits

## Security Considerations

1. **Secrets Management**: Store GitHub tokens and API keys in Fly.io secrets
2. **Network Isolation**: Use Fly.io private networking for database connections
3. **Input Validation**: Sanitize all user inputs, especially Docker commands
4. **Rate Limiting**: Implement rate limits on webhook endpoints
5. **Access Control**: Verify user owns project before allowing operations

## Monitoring & Observability

1. **Logging**: Structured logging with correlation IDs
2. **Metrics**: Track deployment success rates, build times
3. **Alerts**: Set up alerts for failed deployments, quota exceeded
4. **APM**: Use Sentry or similar for error tracking

## MVP Feature Set

For a quick MVP, focus on:
1. GitHub OAuth login
2. Basic project creation
3. Webhook receiver for PR events
4. Simple Fly.io app deployment
5. PR comment with preview URL
6. Cleanup on PR close

This can be built in 2-3 weeks and expanded incrementally.
