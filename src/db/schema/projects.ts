import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "../schema";

export const project = pgTable("project", {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // GitHub repository info
  githubRepoId: integer('github_repo_id').notNull(),
  repoOwner: text('repo_owner').notNull(),
  repoName: text('repo_name').notNull(),
  repoFullName: text('repo_full_name').notNull(), // owner/repo
  defaultBranch: text('default_branch').notNull().default('main'),
  
  // Build configuration
  dockerfilePath: text('dockerfile_path'), // null means auto-generate
  buildCommand: text('build_command').default('npm run build'),
  installCommand: text('install_command').default('npm install'),
  startCommand: text('start_command').default('npm start'),
  nodeVersion: text('node_version').default('20'),
  
  // Fly.io configuration
  flyAppNamePrefix: text('fly_app_name_prefix'), // e.g., "my-app" -> "my-app-pr-123"
  flyRegion: text('fly_region').default('iad'),
  flyOrgSlug: text('fly_org_slug'),
  
  // Status
  isActive: boolean('is_active').default(true),
  lastDeployedAt: timestamp('last_deployed_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const deployment = pgTable("deployment", {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  
  // PR info
  prNumber: integer('pr_number').notNull(),
  prTitle: text('pr_title'),
  branch: text('branch').notNull(),
  commitSha: text('commit_sha').notNull(),
  
  // Deployment info
  flyAppName: text('fly_app_name').unique(), // e.g., "my-app-pr-123"
  flyAppId: text('fly_app_id'),
  previewUrl: text('preview_url'),
  
  // Status
  status: text('status', { 
    enum: ['pending', 'building', 'deploying', 'ready', 'failed', 'destroying', 'destroyed'] 
  }).notNull().default('pending'),
  
  // Build info
  buildLogs: text('build_logs'),
  errorMessage: text('error_message'),
  
  // Timing
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  destroyedAt: timestamp('destroyed_at'),
  
  // Metadata
  metadata: jsonb('metadata'), // Store any additional data
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const envVar = pgTable("env_var", {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  
  key: text('key').notNull(),
  value: text('value').notNull(),
  isSecret: boolean('is_secret').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});