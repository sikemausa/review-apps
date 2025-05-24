// GitHub webhook event types
export type PullRequestAction = 'opened' | 'synchronize' | 'reopened' | 'closed' | 'edited' | 'assigned' | 'unassigned' | 'review_requested' | 'review_request_removed' | 'labeled' | 'unlabeled';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  url: string;
  type: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  clone_url: string;
  default_branch: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  user: GitHubUser;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
}

export interface GitHubInstallation {
  id: number;
  account: GitHubUser;
  repository_selection: 'all' | 'selected';
  created_at: string;
  updated_at: string;
}

export interface PullRequestWebhookEvent {
  action: PullRequestAction;
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: GitHubInstallation;
}

// Supported webhook events
export const SUPPORTED_PR_ACTIONS: PullRequestAction[] = [
  'opened',
  'synchronize', 
  'reopened',
  'closed'
];

// Check if an action should trigger a deployment
export function shouldTriggerDeployment(action: PullRequestAction): boolean {
  return ['opened', 'synchronize', 'reopened'].includes(action);
}

// Check if an action should cleanup deployments
export function shouldCleanupDeployment(action: PullRequestAction): boolean {
  return action === 'closed';
}