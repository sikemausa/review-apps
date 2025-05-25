import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import type { RestEndpointMethodTypes } from '@octokit/types';

// Types
export type GitHubClient = Octokit;
export type GitHubRepo = RestEndpointMethodTypes['repos']['get']['response']['data'];
export type GitHubPullRequest = RestEndpointMethodTypes['pulls']['get']['response']['data'];
export type GitHubIssueComment = RestEndpointMethodTypes['issues']['createComment']['response']['data'];

// Environment variables validation
function validateEnvVars() {
  const required = {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return required as Required<typeof required>;
}

// Create GitHub App client
export function createGitHubAppClient(): GitHubClient {
  const env = validateEnvVars();
  
  const auth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle escaped newlines
  });

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  });
}

// Create GitHub App installation client
export async function createInstallationClient(installationId: number): Promise<GitHubClient> {
  const env = validateEnvVars();
  
  const auth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    installationId,
  });

  const installationAuth = await auth({ type: 'installation' });

  return new Octokit({
    auth: installationAuth.token,
  });
}

// Create OAuth user client
export function createUserClient(accessToken: string): GitHubClient {
  return new Octokit({
    auth: accessToken,
  });
}

// Singleton app client instance
let appClient: GitHubClient | null = null;

export function getGitHubAppClient(): GitHubClient {
  if (!appClient) {
    appClient = createGitHubAppClient();
  }
  return appClient;
}

// Helper to get installation ID for a repository
export async function getInstallationId(
  owner: string,
  repo: string
): Promise<number | null> {
  try {
    const client = getGitHubAppClient();
    const { data } = await client.apps.getRepoInstallation({
      owner,
      repo,
    });
    return data.id;
  } catch (error) {
    console.error(`Failed to get installation ID for ${owner}/${repo}:`, error);
    return null;
  }
}

// Helper to create client for a specific repository
export async function createRepoClient(
  owner: string,
  repo: string
): Promise<GitHubClient | null> {
  const installationId = await getInstallationId(owner, repo);
  if (!installationId) {
    return null;
  }
  return createInstallationClient(installationId);
}