import { getGitHubAppClient, createUserClient } from '../client';

export interface Installation {
  id: number;
  account: {
    login: string;
    id: number;
    avatarUrl: string;
    type: 'User' | 'Organization';
  };
  repositorySelection: 'all' | 'selected';
  permissions: Record<string, string>;
  events: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InstallationRepository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
}

// Get all installations for the GitHub App
export async function getAppInstallations(): Promise<Installation[]> {
  try {
    const client = getGitHubAppClient();
    const { data } = await client.apps.listInstallations({
      per_page: 100,
    });

    return data.map(installation => ({
      id: installation.id,
      account: {
        login: installation.account?.login || '',
        id: installation.account?.id || 0,
        avatarUrl: installation.account?.avatar_url || '',
        type: installation.account?.type as 'User' | 'Organization' || 'User',
      },
      repositorySelection: installation.repository_selection,
      permissions: installation.permissions,
      events: installation.events,
      createdAt: new Date(installation.created_at),
      updatedAt: new Date(installation.updated_at),
    }));
  } catch (error) {
    console.error('Failed to get app installations:', error);
    return [];
  }
}

// Get user's installations
export async function getUserInstallations(
  accessToken: string
): Promise<Installation[]> {
  try {
    const client = createUserClient(accessToken);
    const { data } = await client.request('GET /user/installations');

    return data.installations.map((installation: any) => ({
      id: installation.id,
      account: {
        login: installation.account.login,
        id: installation.account.id,
        avatarUrl: installation.account.avatar_url,
        type: installation.account.type as 'User' | 'Organization',
      },
      repositorySelection: installation.repository_selection,
      permissions: installation.permissions || {},
      events: installation.events || [],
      createdAt: new Date(installation.created_at),
      updatedAt: new Date(installation.updated_at),
    }));
  } catch (error: any) {
    console.error('Failed to get user installations:', error);
    // If user token doesn't have permission, fall back to app installations
    if (error.status === 403 || error.status === 404) {
      console.log('Falling back to app installations');
      return getAppInstallations();
    }
    return [];
  }
}

// Get repositories for an installation
export async function getInstallationRepositories(
  installationId: number
): Promise<InstallationRepository[]> {
  try {
    // We need to use the user's token to get repos accessible to the installation
    // The app token can't directly list installation repos without proper setup
    // For now, return empty array and rely on user token for repo listing
    return [];
  } catch (error) {
    console.error(`Failed to get repositories for installation ${installationId}:`, error);
    return [];
  }
}

// Check if a repository has the app installed
export async function isAppInstalledOnRepo(
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    const client = getGitHubAppClient();
    await client.apps.getRepoInstallation({
      owner,
      repo,
    });
    return true;
  } catch (error) {
    return false;
  }
}

// Get installation ID for a repository
export async function getRepoInstallationId(
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

// Create installation access token
export async function createInstallationAccessToken(
  installationId: number,
  options?: {
    repositories?: string[];
    permissions?: Record<string, string>;
  }
): Promise<string | null> {
  try {
    const client = getGitHubAppClient();
    const { data } = await client.apps.createInstallationAccessToken({
      installation_id: installationId,
      repositories: options?.repositories,
      permissions: options?.permissions,
    });
    return data.token;
  } catch (error) {
    console.error(`Failed to create installation access token:`, error);
    return null;
  }
}