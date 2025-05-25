import { createUserClient, createRepoClient, type GitHubClient, type GitHubRepo } from '../client';

export interface RepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  language: string | null;
  description: string | null;
  owner: {
    login: string;
    id: number;
    avatarUrl: string;
  };
}

// Convert GitHub API response to our format
function mapRepository(repo: GitHubRepo): RepositoryInfo {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    cloneUrl: repo.clone_url,
    language: repo.language,
    description: repo.description,
    owner: {
      login: repo.owner.login,
      id: repo.owner.id,
      avatarUrl: repo.owner.avatar_url,
    },
  };
}

// Get user's repositories
export async function getUserRepositories(
  accessToken: string,
  options?: {
    perPage?: number;
    page?: number;
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  }
): Promise<RepositoryInfo[]> {
  try {
    const client = createUserClient(accessToken);
    const { data } = await client.repos.listForAuthenticatedUser({
      per_page: options?.perPage || 30,
      page: options?.page || 1,
      sort: options?.sort || 'updated',
      direction: 'desc',
    });

    return data.map(mapRepository);
  } catch (error) {
    console.error('Failed to get user repositories:', error);
    return [];
  }
}

// Get a specific repository
export async function getRepository(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<RepositoryInfo | null> {
  try {
    let client: GitHubClient | null;
    
    if (accessToken) {
      client = createUserClient(accessToken);
    } else {
      client = await createRepoClient(owner, repo);
    }
    
    if (!client) {
      return null;
    }

    const { data } = await client.repos.get({
      owner,
      repo,
    });

    return mapRepository(data);
  } catch (error) {
    console.error(`Failed to get repository ${owner}/${repo}:`, error);
    return null;
  }
}

// Check if user has access to a repository
export async function checkRepositoryAccess(
  owner: string,
  repo: string,
  accessToken: string
): Promise<boolean> {
  try {
    const client = createUserClient(accessToken);
    await client.repos.get({
      owner,
      repo,
    });
    return true;
  } catch (error) {
    return false;
  }
}

// Get repository file content
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  try {
    const client = await createRepoClient(owner, repo);
    if (!client) {
      return null;
    }

    const { data } = await client.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    // Check if it's a file (not a directory)
    if ('content' in data && data.type === 'file') {
      // Decode base64 content
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch (error) {
    console.error(`Failed to get file content ${owner}/${repo}/${path}:`, error);
    return null;
  }
}

// Check if a file exists in the repository
export async function fileExists(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<boolean> {
  try {
    const client = await createRepoClient(owner, repo);
    if (!client) {
      return false;
    }

    await client.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    
    return true;
  } catch (error) {
    return false;
  }
}

// Get repository branches
export async function getBranches(
  owner: string,
  repo: string
): Promise<string[]> {
  try {
    const client = await createRepoClient(owner, repo);
    if (!client) {
      return [];
    }

    const { data } = await client.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map(branch => branch.name);
  } catch (error) {
    console.error(`Failed to get branches for ${owner}/${repo}:`, error);
    return [];
  }
}