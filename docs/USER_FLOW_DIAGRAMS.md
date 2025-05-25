# User Flow Diagrams

## 1. Initial Repository Setup Flow

```mermaid
flowchart TD
    A[User visits Dashboard] --> B{Authenticated?}
    B -->|No| C[Redirect to Login]
    C --> D[GitHub OAuth]
    D --> A
    B -->|Yes| E{GitHub App Installed?}
    E -->|No| F[Show Install GitHub App Button]
    F --> G[Redirect to GitHub App Install]
    G --> H[User Selects Repositories]
    H --> I[Return to App]
    E -->|Yes| J[Show Repository List]
    I --> J
    J --> K[User Selects Repository]
    K --> L[Repository Configuration Page]
    L --> M{Auto-detect Config?}
    M -->|Yes| N[Scan for package.json/Dockerfile]
    M -->|No| O[Manual Configuration Form]
    N --> P[Pre-fill Configuration]
    P --> O
    O --> Q[User Reviews/Edits Config]
    Q --> R[Add Environment Variables]
    R --> S[Save Configuration]
    S --> T[Create Project Record]
    T --> U[Enable Webhook Listening]
    U --> V[Show Success Message]
```

## 2. PR Deployment Flow (Automated)

```mermaid
flowchart TD
    A[GitHub PR Event] --> B{Event Type}
    B -->|Opened| C[Create Deployment Record]
    B -->|Synchronize| D[Find Existing Deployment]
    B -->|Closed| E[Find & Destroy Deployment]
    D --> F{Deployment Active?}
    F -->|Yes| G[Mark for Rebuild]
    F -->|No| C
    C --> H[Post GitHub Comment: Deploying...]
    G --> H
    H --> I[Queue Deployment Job]
    I --> J[Clone Repository]
    J --> K[Build Application]
    K --> L{Build Success?}
    L -->|No| M[Update Status: Failed]
    L -->|Yes| N[Create/Update Fly App]
    N --> O{Deploy Success?}
    O -->|No| M
    O -->|Yes| P[Update Status: Active]
    M --> Q[Update GitHub Comment: Error]
    P --> R[Update GitHub Comment: Success + URL]
    E --> S[Destroy Fly App]
    S --> T[Update GitHub Comment: Destroyed]
```

## 3. Dashboard Management Flow

```mermaid
flowchart TD
    A[User visits Dashboard] --> B[Load User Projects]
    B --> C[Display Project Cards]
    C --> D{User Action}
    D -->|View Project| E[Project Detail Page]
    D -->|Add New| F[Repository Selection]
    D -->|Settings| G[Project Settings]
    E --> H[Show Recent Deployments]
    H --> I[Deployment Actions]
    I -->|View Logs| J[Stream Deployment Logs]
    I -->|Redeploy| K[Trigger Manual Deploy]
    I -->|Delete| L[Confirm & Destroy]
    G --> M[Edit Configuration]
    G --> N[Manage Secrets]
    G --> O[Disable/Enable Project]
    M --> P[Save Changes]
    N --> Q[Add/Edit/Delete Secrets]
    O --> R[Update Project Status]
```

## 4. Environment Variable Management

```mermaid
flowchart TD
    A[Project Settings] --> B[Environment Variables Section]
    B --> C[List Current Variables]
    C --> D{User Action}
    D -->|Add| E[Show Add Variable Form]
    D -->|Edit| F[Show Edit Form]
    D -->|Delete| G[Confirm Deletion]
    E --> H[Enter Name & Value]
    F --> I[Update Value]
    H --> J[Encrypt Value]
    I --> J
    J --> K[Save to Database]
    K --> L[Queue Redeployment?]
    L -->|Yes| M[Trigger Deployment]
    L -->|No| N[Show Success]
    G --> O[Remove from Database]
    O --> L
```

## UI Components Needed

### 1. Dashboard Page (`/dashboard`)
- Project grid/list view
- Quick stats (active deployments, recent activity)
- Add new project button
- Search/filter functionality

### 2. Repository Selection (`/setup/select-repo`)
- List of available repositories from GitHub
- Installation status indicators
- Repository search
- Selection confirmation

### 3. Project Configuration (`/setup/configure/[repo]`)
- Configuration form with sections:
  - Build settings (commands, dockerfile)
  - Runtime settings (port, start command)
  - Environment variables
- Auto-detection status
- Save & activate button

### 4. Project Detail (`/projects/[id]`)
- Project overview
- Deployment history table
- Recent logs preview
- Quick actions (settings, disable, delete)

### 5. Deployment Detail (`/deployments/[id]`)
- Status timeline
- Full logs viewer
- Deployment metadata
- Action buttons (redeploy, destroy)

### 6. Settings Page (`/projects/[id]/settings`)
- Configuration editor
- Environment variables manager
- Danger zone (disable/delete project)

## Key User Experience Principles

1. **Progressive Disclosure**: Start with auto-detection, allow manual override
2. **Real-time Feedback**: Show deployment progress with live updates
3. **Error Recovery**: Clear error messages with actionable next steps
4. **Sensible Defaults**: Pre-fill common configurations
5. **Security First**: Encrypt secrets, validate inputs, show security warnings

## Implementation Priority

1. **Phase 1**: Basic repository connection and configuration
2. **Phase 2**: Deployment status tracking and GitHub integration
3. **Phase 3**: Dashboard and management features
4. **Phase 4**: Advanced features (logs, metrics, custom domains)