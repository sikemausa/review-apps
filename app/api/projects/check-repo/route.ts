import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db';
import { project } from '@/src/db/schema/projects';
import { eq } from 'drizzle-orm';
import { getSessionFromHeaders } from '@/src/lib/auth-utils';

// GET /api/projects/check-repo?owner=xxx&repo=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromHeaders(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo parameters are required' },
        { status: 400 }
      );
    }

    const fullName = `${owner}/${repo}`;

    // Check if project exists for this repo
    const existingProject = await db
      .select()
      .from(project)
      .where(eq(project.repoFullName, fullName))
      .limit(1);

    return NextResponse.json({
      exists: existingProject.length > 0,
      project: existingProject[0] || null
    });
  } catch (error) {
    console.error('Error checking repository:', error);
    return NextResponse.json(
      { error: 'Failed to check repository' },
      { status: 500 }
    );
  }
}