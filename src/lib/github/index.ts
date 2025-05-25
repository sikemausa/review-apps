// Main export file for GitHub services

// Client exports
export {
  createGitHubAppClient,
  createInstallationClient,
  createUserClient,
  getGitHubAppClient,
  createRepoClient,
  type GitHubClient,
  type GitHubRepo,
  type GitHubPullRequest,
  type GitHubIssueComment,
} from './client';

// Webhook types and utilities
export * from './webhook-types';
export * from './webhook-verification';

// Service exports
export * from './services/pr-comments';
export * from './services/repositories';
export * from './services/installations';

// Re-export commonly used functions
export { postDeploymentComment } from './services/pr-comments';
export { getUserRepositories, getRepository } from './services/repositories';
export { getUserInstallations, isAppInstalledOnRepo } from './services/installations';