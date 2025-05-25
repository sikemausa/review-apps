import { NextResponse } from 'next/server';

// Custom error classes
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(
      `External service error: ${service}`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError: originalError?.message }
    );
    this.name = 'ExternalServiceError';
  }
}

// Retry configuration
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: (error: any) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: (error) => {
    // Retry on network errors and 5xx status codes
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    if (error.status && error.status >= 500) {
      return true;
    }
    return false;
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxAttempts || !opts.retryableErrors(error)) {
        throw error;
      }
      
      console.log(`Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }
  
  throw lastError;
}

/**
 * Handle errors in API routes consistently
 */
export function handleApiError(error: any): NextResponse {
  console.error('API Error:', error);

  // Handle known app errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  // Handle Prisma/Database errors
  if (error.code === 'P2002') {
    return NextResponse.json(
      {
        error: 'A record with this value already exists',
        code: 'DUPLICATE_ENTRY',
      },
      { status: 409 }
    );
  }

  if (error.code === 'P2025') {
    return NextResponse.json(
      {
        error: 'Record not found',
        code: 'NOT_FOUND',
      },
      { status: 404 }
    );
  }

  // Default error response
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    },
    { status: 500 }
  );
}

/**
 * Create a safe error logger that doesn't expose sensitive data
 */
export function logError(
  error: any,
  context: Record<string, any> = {}
): void {
  const sanitizedError = {
    message: error.message,
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };

  const sanitizedContext = Object.entries(context).reduce((acc, [key, value]) => {
    // Don't log sensitive fields
    if (['password', 'token', 'secret', 'accessToken'].includes(key)) {
      acc[key] = '[REDACTED]';
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  console.error('Error occurred:', {
    error: sanitizedError,
    context: sanitizedContext,
    timestamp: new Date().toISOString(),
  });
}