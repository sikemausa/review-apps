import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { project } from '@/src/db/schema/projects';
import { eq, and, desc } from 'drizzle-orm';
import { getSession } from '@/src/lib/auth-server';
import { getRepository } from '@/src/lib/github/services/repositories';
import { 
  createProjectSchema, 
  validateRepositoryAccess,
  validateFlyAppName 
} from '@/src/lib/validation/project-validation';
import { 
  handleApiError, 
  ValidationError, 
  AuthorizationError,
  ConflictError,
  withRetry 
} from '@/src/lib/utils/error-handling';

// GET /api/projects - List user's projects
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return handleApiError(new AuthorizationError());
    }

    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, session.user.id))
      .orderBy(desc(project.createdAt));

    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return handleApiError(new AuthorizationError());
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);
    const { repoFullName, ...projectData } = validatedData;

    // Get user's GitHub access token first
    const { getGitHubAccessToken } = await import('@/src/lib/auth-utils');
    const accessToken = await getGitHubAccessToken(session.user.id);
    
    if (!accessToken) {
      throw new AuthorizationError('GitHub access token not found. Please reconnect your GitHub account.');
    }
    
    // Parse repository owner and name
    const [owner, repoName] = repoFullName.split('/');
    
    // Get repository details with retry, using access token
    const repo = await withRetry(
      () => getRepository(owner, repoName, accessToken),
      { maxAttempts: 2 }
    );
    
    if (!repo) {
      throw new ValidationError('Repository not found');
    }
    
    // Get GitHub username from the access token
    const { createUserClient } = await import('@/src/lib/github/client');
    const githubClient = createUserClient(accessToken);
    const { data: githubUser } = await githubClient.users.getAuthenticated();
    
    // Validate repository access
    const { isValid, error } = await validateRepositoryAccess(
      repoFullName,
      githubUser.login, // Use GitHub username
      accessToken
    );
    
    if (!isValid) {
      throw new AuthorizationError(error || 'Cannot access repository');
    }

    // Generate and validate Fly app name with edge case handling
    const { sanitizeFlyConfig } = await import('@/src/lib/utils/edge-case-handlers');
    const flyConfig = sanitizeFlyConfig({
      flyAppNamePrefix: repo.name,
      flyRegion: 'iad',
      flyOrgSlug: 'personal'
    });
    
    const flyAppValidation = validateFlyAppName(flyConfig.flyAppNamePrefix);
    if (!flyAppValidation.isValid) {
      // Use a fallback name if validation fails
      flyConfig.flyAppNamePrefix = `app-${Date.now().toString(36)}`.substring(0, 20);
    }

    // Check if project already exists
    const existingProjects = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.repoFullName, repo.fullName),
          eq(project.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingProjects.length > 0) {
      throw new ConflictError('Project already exists for this repository');
    }

    // Create the project
    const [newProject] = await db
      .insert(project)
      .values({
        userId: session.user.id,
        githubRepoId: repo.id,
        repoOwner: repo.owner.login,
        repoName: repo.name,
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        dockerfilePath: projectData.dockerfilePath,
        buildCommand: projectData.buildCommand || 'npm run build',
        installCommand: projectData.installCommand || 'npm install',
        startCommand: projectData.startCommand || 'npm start',
        flyAppNamePrefix: flyConfig.flyAppNamePrefix,
        nodeVersion: '20',
        flyRegion: flyConfig.flyRegion,
        flyOrgSlug: flyConfig.flyOrgSlug,
        isActive: true,
      })
      .returning();

    // Log successful creation
    console.log(`Project created: ${newProject.id} for ${repo.fullName}`);

    return NextResponse.json(
      { project: newProject },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}