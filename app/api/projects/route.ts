import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/src/db';
import { project, deployment } from '@/src/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projects = await db
      .select({
        id: project.id,
        githubRepoFullName: project.githubRepoFullName,
        isActive: project.isActive,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
      .from(project)
      .where(eq(project.userId, session.user.id))
      .orderBy(desc(project.createdAt));

    const projectsWithStats = await Promise.all(
      projects.map(async (p) => {
        const deployments = await db
          .select({
            status: deployment.status,
            flyAppUrl: deployment.flyAppUrl,
          })
          .from(deployment)
          .where(eq(deployment.projectId, p.id))
          .orderBy(desc(deployment.createdAt))
          .limit(1);

        const deploymentCount = await db
          .select({ count: deployment.id })
          .from(deployment)
          .where(eq(deployment.projectId, p.id));

        return {
          ...p,
          _count: {
            deployments: deploymentCount.length,
          },
          latestDeployment: deployments[0] || null,
        };
      })
    );

    return NextResponse.json({ projects: projectsWithStats });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      githubRepoId,
      githubRepoFullName,
      githubInstallationId,
      deploymentConfig,
    } = body;

    const existingProject = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.userId, session.user.id),
          eq(project.githubRepoId, githubRepoId)
        )
      )
      .limit(1);

    if (existingProject.length > 0) {
      return NextResponse.json(
        { error: 'Project already exists' },
        { status: 400 }
      );
    }

    const [newProject] = await db
      .insert(project)
      .values({
        userId: session.user.id,
        githubRepoId,
        githubRepoFullName,
        githubInstallationId,
        deploymentConfig: deploymentConfig || {},
      })
      .returning();

    return NextResponse.json({ project: newProject });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}