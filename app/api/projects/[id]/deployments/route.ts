import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/src/db';
import { project, deployment } from '@/src/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [foundProject] = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, params.id),
          eq(project.userId, session.user.id)
        )
      )
      .limit(1);

    if (!foundProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const deployments = await db
      .select()
      .from(deployment)
      .where(eq(deployment.projectId, params.id))
      .orderBy(desc(deployment.createdAt));

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error('Failed to fetch deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 }
    );
  }
}