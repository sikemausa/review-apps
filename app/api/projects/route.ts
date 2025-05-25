import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { project } from '@/src/db/schema/projects';
import { eq, and, desc } from 'drizzle-orm';
import { getSessionFromHeaders, getCurrentUserGitHubToken } from '@/src/lib/auth-utils';
import { getRepository, checkRepositoryAccess } from '@/src/lib/github';

// GET /api/projects - List user's projects
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, session.userId))
      .orderBy(desc(project.updatedAt));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { repoOwner, repoName, dockerfilePath, buildCommand, installCommand, startCommand } = body;

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'Repository owner and name are required' },
        { status: 400 }
      );
    }

    // Get GitHub access token
    const accessToken = await getCurrentUserGitHubToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found' },
        { status: 400 }
      );
    }

    // Verify user has access to the repository
    const hasAccess = await checkRepositoryAccess(repoOwner, repoName, accessToken);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this repository' },
        { status: 403 }
      );
    }

    // Get repository details
    const repo = await getRepository(repoOwner, repoName, accessToken);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Check if project already exists
    const existingProjects = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.userId, session.userId),
          eq(project.githubRepoId, repo.id)
        )
      )
      .limit(1);

    if (existingProjects.length > 0) {
      return NextResponse.json(
        { error: 'Project already exists for this repository' },
        { status: 409 }
      );
    }

    // Create the project
    const newProject = await db
      .insert(project)
      .values({
        userId: session.userId,
        githubRepoId: repo.id,
        repoOwner: repo.owner.login,
        repoName: repo.name,
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        dockerfilePath,
        buildCommand: buildCommand || 'npm run build',
        installCommand: installCommand || 'npm install',
        startCommand: startCommand || 'npm start',
        flyAppNamePrefix: repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      })
      .returning();

    return NextResponse.json({ project: newProject[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}