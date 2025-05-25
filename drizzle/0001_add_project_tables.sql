CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"github_repo_id" integer NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"dockerfile_path" text,
	"build_command" text DEFAULT 'npm run build',
	"install_command" text DEFAULT 'npm install',
	"start_command" text DEFAULT 'npm start',
	"node_version" text DEFAULT '20',
	"fly_app_name_prefix" text,
	"fly_region" text DEFAULT 'iad',
	"fly_org_slug" text,
	"is_active" boolean DEFAULT true,
	"last_deployed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_title" text,
	"branch" text NOT NULL,
	"commit_sha" text NOT NULL,
	"fly_app_name" text,
	"fly_app_id" text,
	"preview_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"build_logs" text,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"destroyed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "deployment_fly_app_name_unique" UNIQUE("fly_app_name")
);
--> statement-breakpoint
CREATE TABLE "env_var" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"is_secret" boolean DEFAULT false,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "env_var" ADD CONSTRAINT "env_var_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;