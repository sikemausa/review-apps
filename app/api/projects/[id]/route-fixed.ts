import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { project, deployment } from '@/src/db/schema/projects';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/src/lib/auth-server';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/projects/[id] - Get a specific project
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectData = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.user.id)
        )
      )
      .limit(1);

    if (projectData.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get active deployments for this project
    const deployments = await db
      .select()
      .from(deployment)
      .where(
        and(
          eq(deployment.projectId, params.id),
          eq(deployment.status, 'ready')
        )
      );

    return NextResponse.json({ 
      project: projectData[0],
      activeDeployments: deployments.length 
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: any = {};

    // Only allow updating specific fields
    const allowedFields = [
      'dockerfilePath',
      'buildCommand',
      'installCommand',
      'startCommand',
      'nodeVersion',
      'flyRegion',
      'isActive'
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date();

    const updatedProject = await db
      .update(project)
      .set(updates)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.user.id)
        )
      )
      .returning();

    if (updatedProject.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project: updatedProject[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if project exists and belongs to user
    const projectData = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.user.id)
        )
      )
      .limit(1);

    if (projectData.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check for active deployments
    const activeDeployments = await db
      .select()
      .from(deployment)
      .where(
        and(
          eq(deployment.projectId, params.id),
          eq(deployment.status, 'ready')
        )
      );

    if (activeDeployments.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete project with active deployments',
          activeDeployments: activeDeployments.length 
        },
        { status: 400 }
      );
    }

    // Delete the project (cascades to deployments and env vars)
    await db
      .delete(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.user.id)
        )
      );

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}