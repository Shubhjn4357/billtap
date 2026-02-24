CREATE TABLE "organization_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '📦' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"thumbnailUrl" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "expenses_branch_idx";--> statement-breakpoint
CREATE INDEX "org_categories_org_idx" ON "organization_categories" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "org_categories_user_idx" ON "organization_categories" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "org_categories_name_idx" ON "organization_categories" USING btree ("organizationId","name");--> statement-breakpoint
CREATE INDEX "templates_type_idx" ON "templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "templates_default_idx" ON "templates" USING btree ("isDefault");