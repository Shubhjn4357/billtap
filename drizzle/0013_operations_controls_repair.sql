DO $$ BEGIN
    CREATE TYPE "request_module" AS ENUM ('inventory', 'billing', 'accounting', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "request_type" AS ENUM ('JOURNAL_ENTRY', 'STOCK_ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "request_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "period_status" AS ENUM ('open', 'locked', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_controls" (
    "userId" text PRIMARY KEY NOT NULL,
    "makerCheckerEnabled" boolean DEFAULT true NOT NULL,
    "journalApprovalRequired" boolean DEFAULT true NOT NULL,
    "stockAdjustmentApprovalRequired" boolean DEFAULT true NOT NULL,
    "periodLockEnabled" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "module" "request_module" NOT NULL,
    "requestType" "request_type" NOT NULL,
    "requestedBy" text NOT NULL,
    "requestedByRole" text,
    "status" "request_status" DEFAULT 'pending' NOT NULL,
    "payload" jsonb NOT NULL,
    "reason" text,
    "reviewedBy" text,
    "reviewedAt" timestamp with time zone,
    "reviewNote" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "actorUid" text NOT NULL,
    "actorRole" text,
    "module" text NOT NULL,
    "action" text NOT NULL,
    "entityType" text,
    "entityId" text,
    "before" jsonb,
    "after" jsonb,
    "metadata" jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_periods" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "periodStart" timestamp with time zone NOT NULL,
    "periodEnd" timestamp with time zone NOT NULL,
    "status" "period_status" DEFAULT 'open' NOT NULL,
    "lockedBy" text,
    "lockedAt" timestamp with time zone,
    "closedBy" text,
    "closedAt" timestamp with time zone,
    "notes" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_controls_user_idx" ON "business_controls" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_user_status_idx" ON "approval_requests" ("userId", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_module_idx" ON "approval_requests" ("module");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_requester_idx" ON "approval_requests" ("requestedBy");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_created_idx" ON "approval_requests" ("createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_module_idx" ON "audit_logs" ("module");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actorUid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" ("createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_periods_user_idx" ON "accounting_periods" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_periods_range_idx" ON "accounting_periods" ("periodStart", "periodEnd");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_periods_status_idx" ON "accounting_periods" ("status");
