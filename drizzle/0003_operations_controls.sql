-- Operations and controls phase
-- Role matrix, maker-checker approvals, audit logs, accounting period lock/close

CREATE TABLE IF NOT EXISTS "business_controls" (
    "userId" text PRIMARY KEY NOT NULL,
    "makerCheckerEnabled" boolean DEFAULT true NOT NULL,
    "journalApprovalRequired" boolean DEFAULT true NOT NULL,
    "stockAdjustmentApprovalRequired" boolean DEFAULT true NOT NULL,
    "periodLockEnabled" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "business_controls_user_idx" ON "business_controls" ("userId");

CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "module" text NOT NULL,
    "requestType" text NOT NULL,
    "requestedBy" text NOT NULL,
    "requestedByRole" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "payload" jsonb NOT NULL,
    "reason" text,
    "reviewedBy" text,
    "reviewedAt" timestamptz,
    "reviewNote" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "approval_requests_user_status_idx" ON "approval_requests" ("userId", "status");
CREATE INDEX IF NOT EXISTS "approval_requests_module_idx" ON "approval_requests" ("module");
CREATE INDEX IF NOT EXISTS "approval_requests_requester_idx" ON "approval_requests" ("requestedBy");
CREATE INDEX IF NOT EXISTS "approval_requests_created_idx" ON "approval_requests" ("createdAt");

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
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_module_idx" ON "audit_logs" ("module");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actorUid");
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" ("createdAt");

CREATE TABLE IF NOT EXISTS "accounting_periods" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "periodStart" timestamptz NOT NULL,
    "periodEnd" timestamptz NOT NULL,
    "status" text DEFAULT 'open' NOT NULL,
    "lockedBy" text,
    "lockedAt" timestamptz,
    "closedBy" text,
    "closedAt" timestamptz,
    "notes" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "accounting_periods_user_idx" ON "accounting_periods" ("userId");
CREATE INDEX IF NOT EXISTS "accounting_periods_range_idx" ON "accounting_periods" ("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "accounting_periods_status_idx" ON "accounting_periods" ("status");
