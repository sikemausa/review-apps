CREATE TYPE "public"."deployment_status" AS ENUM('pending', 'building', 'deploying', 'active', 'failed', 'destroyed');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."log_type" AS ENUM('build', 'deploy', 'runtime');--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"github_repo_id" integer NOT NULL,
	"github_repo_full_name" text NOT NULL,
	"github_installation_id" integer NOT NULL,
	"deployment_config" json NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_title" text NOT NULL,
	"pr_author" text NOT NULL,
	"commit_sha" text NOT NULL,
	"fly_app_name" text NOT NULL,
	"fly_app_url" text,
	"status" "deployment_status" NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_log" (
	"id" text PRIMARY KEY NOT NULL,
	"deployment_id" text NOT NULL,
	"type" "log_type" NOT NULL,
	"message" text NOT NULL,
	"level" "log_level" NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_secret" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_log" ADD CONSTRAINT "deployment_log_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secret" ADD CONSTRAINT "project_secret_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;