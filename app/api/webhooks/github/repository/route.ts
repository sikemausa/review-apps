import { NextRequest, NextResponse } from 'next/server';
import { extractWebhookHeaders, verifyWebhookSignature } from '@/src/lib/github/webhook-verification';
import { handleApiError, logError } from '@/src/lib/utils/error-handling';
import { updateProjectRepository } from '@/src/lib/utils/edge-case-handlers';
import { db } from '@/src/db';
import { project } from '@/src/db/schema/projects';
import { eq } from 'drizzle-orm';

interface RepositoryWebhookEvent {
  action: 'renamed' | 'transferred' | 'archived' | 'unarchived' | 'deleted';
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  changes?: {
    repository?: {
      name?: {
        from: string;
      };
    };
    owner?: {
      from: {
        login: string;
      };
    };
  };
}

export async function POST(request: NextRequest) {
  console.log('=== GitHub Repository Webhook Received ===');
  
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook configuration error' },
      { status: 500 }
    );
  }

  try {
    const body = await request.text();
    const headers = extractWebhookHeaders(request.headers);
    
    // Verify signature
    const isValid = await verifyWebhookSignature(body, headers.signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const payload = JSON.parse(body) as RepositoryWebhookEvent;
    console.log(`Repository ${payload.action}: ${payload.repository.full_name}`);
    
    // Find projects for this repository
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.githubRepoId, payload.repository.id));
    
    if (projects.length === 0) {
      console.log('No projects found for this repository');
      return NextResponse.json({ message: 'No projects to update' });
    }
    
    switch (payload.action) {
      case 'renamed':
      case 'transferred':
        // Update all projects with new repository information
        for (const proj of projects) {
          await updateProjectRepository(
            proj.id,
            payload.repository.full_name,
            payload.repository.owner.login,
            payload.repository.name
          );
        }
        console.log(`Updated ${projects.length} projects with new repository info`);
        break;
        
      case 'archived':
        // Deactivate projects for archived repositories
        await db
          .update(project)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(project.githubRepoId, payload.repository.id));
        console.log(`Deactivated ${projects.length} projects for archived repository`);
        break;
        
      case 'unarchived':
        // Reactivate projects for unarchived repositories
        await db
          .update(project)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(project.githubRepoId, payload.repository.id));
        console.log(`Reactivated ${projects.length} projects for unarchived repository`);
        break;
        
      case 'deleted':
        // Mark projects as inactive (don't delete to preserve history)
        await db
          .update(project)
          .set({ 
            isActive: false, 
            updatedAt: new Date(),
            // Add a note in the dockerfile path field (hacky but works)
            dockerfilePath: '[REPOSITORY_DELETED]'
          })
          .where(eq(project.githubRepoId, payload.repository.id));
        console.log(`Marked ${projects.length} projects as deleted`);
        break;
    }
    
    return NextResponse.json({
      message: 'Repository webhook processed',
      action: payload.action,
      repository: payload.repository.full_name,
      projectsUpdated: projects.length
    });
    
  } catch (error) {
    logError(error, { webhook: 'repository' });
    return handleApiError(error);
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'GitHub repository webhook endpoint',
    status: 'ready'
  });
}