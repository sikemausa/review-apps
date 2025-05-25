import { NextResponse } from 'next/server';
import { runHealthChecks } from '@/src/lib/jobs/cleanup-jobs';

export async function GET() {
  try {
    const health = await runHealthChecks();
    
    return NextResponse.json({
      status: health.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: health.checks,
      errors: health.errors,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
    }, {
      status: health.healthy ? 200 : 503
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, {
      status: 503
    });
  }
}