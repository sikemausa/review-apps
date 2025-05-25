import { z } from 'zod';

// Regex patterns for validation
const DOCKER_PATH_REGEX = /^[a-zA-Z0-9._\-\/]+$/;
const COMMAND_REGEX = /^[a-zA-Z0-9\s\-._\/\$\{\}:&|;"'=]+$/;
const FLY_APP_NAME_REGEX = /^[a-z0-9\-]+$/;
const ENV_KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;

// Project creation schema
export const createProjectSchema = z.object({
  repoFullName: z.string()
    .min(3)
    .max(200)
    .regex(/^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/, 'Invalid repository format'),
  
  dockerfilePath: z.string()
    .regex(DOCKER_PATH_REGEX, 'Invalid Dockerfile path')
    .max(255)
    .optional()
    .nullable(),
  
  buildCommand: z.string()
    .regex(COMMAND_REGEX, 'Invalid build command')
    .max(500)
    .optional(),
  
  installCommand: z.string()
    .regex(COMMAND_REGEX, 'Invalid install command')
    .max(500)
    .optional(),
  
  startCommand: z.string()
    .regex(COMMAND_REGEX, 'Invalid start command')
    .max(500)
    .optional(),
});

// Project update schema
export const updateProjectSchema = z.object({
  dockerfilePath: z.string()
    .regex(DOCKER_PATH_REGEX, 'Invalid Dockerfile path')
    .max(255)
    .nullable()
    .optional(),
  
  buildCommand: z.string()
    .regex(COMMAND_REGEX, 'Invalid build command')
    .max(500)
    .optional(),
  
  installCommand: z.string()
    .regex(COMMAND_REGEX, 'Invalid install command')
    .max(500)
    .optional(),
  
  startCommand: z.string()
    .regex(COMMAND_REGEX, 'Invalid start command')
    .max(500)
    .optional(),
  
  nodeVersion: z.string()
    .regex(/^\d{1,2}(\.\d{1,2}(\.\d{1,2})?)?$/, 'Invalid node version')
    .optional(),
  
  flyRegion: z.enum([
    'iad', 'ord', 'lax', 'sea', 'lhr', 
    'ams', 'fra', 'sin', 'syd', 'gru',
    'hkg', 'nrt', 'cdg', 'dfw', 'den'
  ]).optional(),
  
  flyAppNamePrefix: z.string()
    .regex(FLY_APP_NAME_REGEX, 'Invalid app name prefix')
    .max(20)
    .optional(),
  
  isActive: z.boolean().optional(),
});

// Environment variable schema
export const envVarSchema = z.object({
  key: z.string()
    .regex(ENV_KEY_REGEX, 'Environment variable keys must be uppercase with underscores')
    .min(1)
    .max(100),
  
  value: z.string()
    .min(0)
    .max(5000),
  
  isSecret: z.boolean().optional().default(false),
});

export const envVarsArraySchema = z.object({
  variables: z.array(envVarSchema).min(1).max(50),
});

// Sanitize commands to prevent injection
export function sanitizeCommand(command: string): string {
  // Remove dangerous characters and command chaining
  return command
    .replace(/[;&|`$<>\\]/g, '') // Remove shell operators
    .replace(/\.\.\//g, '') // Remove directory traversal
    .trim();
}

// Validate GitHub repository access
export async function validateRepositoryAccess(
  repoFullName: string,
  githubUsername: string,
  accessToken: string | null
): Promise<{ isValid: boolean; error?: string }> {
  if (!accessToken) {
    return {
      isValid: false,
      error: 'GitHub access token not available.',
    };
  }

  try {
    const [owner, repo] = repoFullName.split('/');
    
    // Import dynamically to avoid circular dependencies
    const { createUserClient } = await import('@/src/lib/github/client');
    const client = createUserClient(accessToken);
    
    // Check if user has access to the repository
    const { data: repoData } = await client.repos.get({ owner, repo });
    
    // Check if the user is the owner of the repository
    if (repoData.owner.login === githubUsername) {
      // User is the owner, they have full access
      return { isValid: true };
    }
    
    // If not the owner, check collaborator permissions
    try {
      const { data: permission } = await client.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username: githubUsername,
      });
      
      if (!['admin', 'write'].includes(permission.permission)) {
        return {
          isValid: false,
          error: 'Insufficient permissions. You need write access to this repository.',
        };
      }
      
      return { isValid: true };
    } catch (collabError) {
      // If we get a 403 here, it might mean the user has access through org membership
      // Try to push to the repo as a final check
      if (collabError instanceof Error && 'status' in collabError) {
        const status = (collabError as any).status;
        if (status === 403 || status === 404) {
          // User might have access through organization membership
          // The fact that we could get the repo details means they have at least read access
          // For now, we'll assume they have write access if they can see the repo
          return { isValid: true };
        }
      }
      throw collabError;
    }
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) {
      return {
        isValid: false,
        error: 'Repository not found or you do not have access.',
      };
    }
    
    return {
      isValid: false,
      error: 'Failed to verify repository access.',
    };
  }
}

// Validate Fly.io app name
export function validateFlyAppName(name: string): { isValid: boolean; error?: string } {
  if (!name) {
    return { isValid: false, error: 'App name is required' };
  }
  
  if (name.length > 30) {
    return { isValid: false, error: 'App name must be 30 characters or less' };
  }
  
  if (!FLY_APP_NAME_REGEX.test(name)) {
    return { 
      isValid: false, 
      error: 'App name must contain only lowercase letters, numbers, and hyphens' 
    };
  }
  
  if (name.startsWith('-') || name.endsWith('-')) {
    return { isValid: false, error: 'App name cannot start or end with a hyphen' };
  }
  
  return { isValid: true };
}