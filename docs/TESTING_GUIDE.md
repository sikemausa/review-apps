# Testing Guide for Deployment Preview System

## Prerequisites
1. Ensure the development server is running: `npm run dev`
2. Make sure you have the GitHub App created and configured
3. Database migrations are applied

## Testing Flow

### 1. Authentication Flow
1. Navigate to http://localhost:3000
2. Click "Login" or go to http://localhost:3000/login
3. Sign in with GitHub OAuth
4. Verify you're redirected to the dashboard

### 2. Dashboard
1. After login, you should see the dashboard at http://localhost:3000/dashboard
2. Initially, you should see "No projects yet" message
3. Click "Add New Project" button

### 3. GitHub App Installation
1. If not installed, you'll be redirected to `/setup/github`
2. Click "Install GitHub App" to install on your repositories
3. Or click "I already installed it" if you've done this before

### 4. Repository Selection
1. Navigate to http://localhost:3000/setup/repositories
2. You should see your GitHub installations
3. Select a repository to set up deployment previews for
4. Click "Continue to Configuration"

### 5. Project Configuration
1. On the configuration page, observe:
   - Auto-detection of build settings (if package.json exists)
   - Pre-filled commands based on your project type
2. Customize the settings:
   - Install command (e.g., `npm install`)
   - Build command (e.g., `npm run build`)
   - Start command (e.g., `npm start`)
   - Port number
   - Add environment variables if needed
3. Click "Create Project"

### 6. Project Detail Page
1. After creation, you'll be redirected to `/projects/[id]`
2. Verify the project information is displayed correctly
3. Check that the status shows "Active"
4. The deployments section will be empty initially

### 7. Dashboard with Projects
1. Go back to the dashboard
2. You should now see your project card with:
   - Repository name
   - Active status
   - Creation date
   - Deployment count (0 initially)

## API Testing with cURL

### Test Project Creation
```bash
# First, get your session token from browser DevTools (Application > Cookies)
SESSION_TOKEN="your-session-token"

# Create a project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session=$SESSION_TOKEN" \
  -d '{
    "githubRepoId": 123456,
    "githubRepoFullName": "username/test-repo",
    "githubInstallationId": 789012,
    "deploymentConfig": {
      "buildCommand": "npm run build",
      "installCommand": "npm install",
      "startCommand": "npm start",
      "port": 3000
    }
  }'
```

### Test Fetching Projects
```bash
curl http://localhost:3000/api/projects \
  -H "Cookie: better-auth.session=$SESSION_TOKEN"
```

### Test Fetching Single Project
```bash
PROJECT_ID="your-project-id"
curl http://localhost:3000/api/projects/$PROJECT_ID \
  -H "Cookie: better-auth.session=$SESSION_TOKEN"
```

### Test Toggle Project Status
```bash
curl -X PATCH http://localhost:3000/api/projects/$PROJECT_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session=$SESSION_TOKEN" \
  -d '{"isActive": false}'
```

## Database Verification

Connect to your database and verify the data:

```sql
-- Check projects
SELECT * FROM project WHERE user_id = 'your-user-id';

-- Check deployment config
SELECT 
  github_repo_full_name,
  deployment_config,
  is_active,
  created_at
FROM project;

-- Once deployments are created (future)
SELECT * FROM deployment WHERE project_id = 'your-project-id';
```

## Common Issues & Solutions

### "No GitHub App installations found"
- Make sure you've installed the GitHub App on at least one repository
- Check the app name in `/setup/github/page.tsx` matches your actual app

### Auto-detection not working
- Ensure your repository has a package.json in the root
- Check browser console for any API errors
- Verify the GitHub installation has proper permissions

### Project creation fails
- Check that the repository ID and installation ID are valid
- Ensure you're not creating a duplicate project
- Check browser DevTools Network tab for error details

## Next Steps

Once basic testing is complete, the next implementation phases will enable:
1. Webhook processing for PR events
2. Actual deployment to Fly.io
3. Real-time deployment status updates
4. Deployment logs and monitoring

## Quick Test Checklist

- [ ] Can log in with GitHub
- [ ] Dashboard loads and shows user info
- [ ] Can navigate to repository selection
- [ ] Repositories from GitHub are listed
- [ ] Can select and configure a repository
- [ ] Project is created successfully
- [ ] Project appears on dashboard
- [ ] Can view project details
- [ ] Can toggle project active/inactive status
- [ ] API endpoints return expected data