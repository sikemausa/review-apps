import { pgTable, text, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
					id: text('id').primaryKey(),
					name: text('name').notNull(),
 email: text('email').notNull().unique(),
 emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
 image: text('image'),
 createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
 updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
				});

export const session = pgTable("session", {
					id: text('id').primaryKey(),
					expiresAt: timestamp('expires_at').notNull(),
 token: text('token').notNull().unique(),
 createdAt: timestamp('created_at').notNull(),
 updatedAt: timestamp('updated_at').notNull(),
 ipAddress: text('ip_address'),
 userAgent: text('user_agent'),
 userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' })
				});

export const account = pgTable("account", {
					id: text('id').primaryKey(),
					accountId: text('account_id').notNull(),
 providerId: text('provider_id').notNull(),
 userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' }),
 accessToken: text('access_token'),
 refreshToken: text('refresh_token'),
 idToken: text('id_token'),
 accessTokenExpiresAt: timestamp('access_token_expires_at'),
 refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
 scope: text('scope'),
 password: text('password'),
 createdAt: timestamp('created_at').notNull(),
 updatedAt: timestamp('updated_at').notNull()
				});

export const verification = pgTable("verification", {
					id: text('id').primaryKey(),
					identifier: text('identifier').notNull(),
 value: text('value').notNull(),
 expiresAt: timestamp('expires_at').notNull(),
 createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
 updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date())
				});

export const deploymentStatusEnum = pgEnum('deployment_status', ['pending', 'building', 'deploying', 'active', 'failed', 'destroyed']);
export const logLevelEnum = pgEnum('log_level', ['info', 'warning', 'error']);
export const logTypeEnum = pgEnum('log_type', ['build', 'deploy', 'runtime']);

export const project = pgTable("project", {
 id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
 githubRepoId: integer('github_repo_id').notNull(),
 githubRepoFullName: text('github_repo_full_name').notNull(),
 githubInstallationId: integer('github_installation_id').notNull(),
 deploymentConfig: json('deployment_config').$type<{
  buildCommand?: string;
  installCommand?: string;
  startCommand?: string;
  port?: number;
  envVars?: Record<string, string>;
  dockerfilePath?: string;
  flyConfig?: unknown;
 }>().notNull().$default(() => ({})),
 isActive: boolean('is_active').notNull().$default(() => true),
 createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
 updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date())
});

export const deployment = pgTable("deployment", {
 id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
 prNumber: integer('pr_number').notNull(),
 prTitle: text('pr_title').notNull(),
 prAuthor: text('pr_author').notNull(),
 commitSha: text('commit_sha').notNull(),
 flyAppName: text('fly_app_name').notNull(),
 flyAppUrl: text('fly_app_url'),
 status: deploymentStatusEnum('status').notNull().$default(() => 'pending'),
 error: text('error'),
 startedAt: timestamp('started_at'),
 completedAt: timestamp('completed_at'),
 createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
 updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date())
});

export const deploymentLog = pgTable("deployment_log", {
 id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 deploymentId: text('deployment_id').notNull().references(() => deployment.id, { onDelete: 'cascade' }),
 type: logTypeEnum('type').notNull(),
 message: text('message').notNull(),
 level: logLevelEnum('level').notNull().$default(() => 'info'),
 timestamp: timestamp('timestamp').notNull().$defaultFn(() => new Date())
});

export const projectSecret = pgTable("project_secret", {
 id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
 projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
 name: text('name').notNull(),
 encryptedValue: text('encrypted_value').notNull(),
 createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
 updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date())
});
