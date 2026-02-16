-- Remaining business suite phases:
-- staff/payroll, GST compliance depth, cash/banking, enterprise scale

ALTER TABLE "items"
    ADD COLUMN IF NOT EXISTS "branchId" text;

ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "branchId" text,
    ADD COLUMN IF NOT EXISTS "costCenter" text,
    ADD COLUMN IF NOT EXISTS "projectCode" text;

ALTER TABLE "accounts"
    ADD COLUMN IF NOT EXISTS "branchId" text;

ALTER TABLE "journal_entries"
    ADD COLUMN IF NOT EXISTS "branchId" text,
    ADD COLUMN IF NOT EXISTS "costCenter" text,
    ADD COLUMN IF NOT EXISTS "projectCode" text;

ALTER TABLE "inventory_movements"
    ADD COLUMN IF NOT EXISTS "branchId" text;

CREATE INDEX IF NOT EXISTS "items_branch_idx" ON "items" ("branchId");
CREATE INDEX IF NOT EXISTS "transactions_branch_idx" ON "transactions" ("branchId");
CREATE INDEX IF NOT EXISTS "accounts_branch_idx" ON "accounts" ("branchId");
CREATE INDEX IF NOT EXISTS "journal_entries_branch_idx" ON "journal_entries" ("branchId");
CREATE INDEX IF NOT EXISTS "inventory_movements_branch_idx" ON "inventory_movements" ("branchId");

CREATE TABLE IF NOT EXISTS "branches" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "name" text NOT NULL,
    "code" text NOT NULL,
    "address" text,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "branches_user_idx" ON "branches" ("userId");
CREATE INDEX IF NOT EXISTS "branches_code_idx" ON "branches" ("code");

CREATE TABLE IF NOT EXISTS "attendance_records" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "staffUid" text NOT NULL,
    "branchId" text,
    "shiftName" text,
    "checkInAt" timestamptz NOT NULL,
    "checkOutAt" timestamptz,
    "overtimeMinutes" integer DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'present' NOT NULL,
    "notes" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "attendance_records_user_idx" ON "attendance_records" ("userId");
CREATE INDEX IF NOT EXISTS "attendance_records_staff_idx" ON "attendance_records" ("staffUid");
CREATE INDEX IF NOT EXISTS "attendance_records_checkin_idx" ON "attendance_records" ("checkInAt");

CREATE TABLE IF NOT EXISTS "payroll_components" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "category" text NOT NULL,
    "amountType" text DEFAULT 'fixed' NOT NULL,
    "value" double precision DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payroll_components_user_idx" ON "payroll_components" ("userId");
CREATE INDEX IF NOT EXISTS "payroll_components_code_idx" ON "payroll_components" ("code");
CREATE INDEX IF NOT EXISTS "payroll_components_category_idx" ON "payroll_components" ("category");

CREATE TABLE IF NOT EXISTS "salary_runs" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "branchId" text,
    "periodStart" timestamptz NOT NULL,
    "periodEnd" timestamptz NOT NULL,
    "status" text DEFAULT 'draft' NOT NULL,
    "totalGross" double precision DEFAULT 0 NOT NULL,
    "totalDeductions" double precision DEFAULT 0 NOT NULL,
    "totalNet" double precision DEFAULT 0 NOT NULL,
    "journalEntryId" text,
    "createdBy" text NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "salary_runs_user_idx" ON "salary_runs" ("userId");
CREATE INDEX IF NOT EXISTS "salary_runs_period_idx" ON "salary_runs" ("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "salary_runs_status_idx" ON "salary_runs" ("status");

CREATE TABLE IF NOT EXISTS "salary_run_items" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "runId" text NOT NULL,
    "staffUid" text NOT NULL,
    "attendanceDays" double precision DEFAULT 0 NOT NULL,
    "overtimeMinutes" integer DEFAULT 0 NOT NULL,
    "grossPay" double precision DEFAULT 0 NOT NULL,
    "deductions" double precision DEFAULT 0 NOT NULL,
    "netPay" double precision DEFAULT 0 NOT NULL,
    "componentBreakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "payslipData" jsonb,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "salary_run_items_user_idx" ON "salary_run_items" ("userId");
CREATE INDEX IF NOT EXISTS "salary_run_items_run_idx" ON "salary_run_items" ("runId");
CREATE INDEX IF NOT EXISTS "salary_run_items_staff_idx" ON "salary_run_items" ("staffUid");

CREATE TABLE IF NOT EXISTS "gst_notes" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "type" text NOT NULL,
    "relatedTransactionId" text,
    "noteNumber" text,
    "noteDate" timestamptz DEFAULT now() NOT NULL,
    "partyId" text,
    "partyName" text,
    "partyGstNumber" text,
    "reason" text,
    "taxableAmount" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'open' NOT NULL,
    "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "gst_notes_user_idx" ON "gst_notes" ("userId");
CREATE INDEX IF NOT EXISTS "gst_notes_type_idx" ON "gst_notes" ("type");
CREATE INDEX IF NOT EXISTS "gst_notes_date_idx" ON "gst_notes" ("noteDate");

CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "branchId" text,
    "name" text NOT NULL,
    "bankName" text NOT NULL,
    "accountNumberMasked" text,
    "ifsc" text,
    "openingBalance" double precision DEFAULT 0 NOT NULL,
    "currentBalance" double precision DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bank_accounts_user_idx" ON "bank_accounts" ("userId");
CREATE INDEX IF NOT EXISTS "bank_accounts_branch_idx" ON "bank_accounts" ("branchId");

CREATE TABLE IF NOT EXISTS "vouchers" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "branchId" text,
    "type" text NOT NULL,
    "voucherDate" timestamptz DEFAULT now() NOT NULL,
    "amount" double precision NOT NULL,
    "mode" text DEFAULT 'CASH' NOT NULL,
    "bankAccountId" text,
    "partyId" text,
    "partyName" text,
    "narration" text,
    "costCenter" text,
    "projectCode" text,
    "status" text DEFAULT 'posted' NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "vouchers_user_idx" ON "vouchers" ("userId");
CREATE INDEX IF NOT EXISTS "vouchers_type_idx" ON "vouchers" ("type");
CREATE INDEX IF NOT EXISTS "vouchers_date_idx" ON "vouchers" ("voucherDate");
CREATE INDEX IF NOT EXISTS "vouchers_branch_idx" ON "vouchers" ("branchId");

CREATE TABLE IF NOT EXISTS "bank_ledger_entries" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "bankAccountId" text NOT NULL,
    "entryDate" timestamptz DEFAULT now() NOT NULL,
    "direction" text NOT NULL,
    "amount" double precision NOT NULL,
    "balanceAfter" double precision,
    "referenceType" text,
    "referenceId" text,
    "narration" text,
    "reconciled" boolean DEFAULT false NOT NULL,
    "reconciledAt" timestamptz,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bank_ledger_entries_user_idx" ON "bank_ledger_entries" ("userId");
CREATE INDEX IF NOT EXISTS "bank_ledger_entries_bank_idx" ON "bank_ledger_entries" ("bankAccountId");
CREATE INDEX IF NOT EXISTS "bank_ledger_entries_date_idx" ON "bank_ledger_entries" ("entryDate");
CREATE INDEX IF NOT EXISTS "bank_ledger_entries_reconciled_idx" ON "bank_ledger_entries" ("reconciled");

CREATE TABLE IF NOT EXISTS "bank_reconciliations" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "bankAccountId" text NOT NULL,
    "statementStart" timestamptz NOT NULL,
    "statementEnd" timestamptz NOT NULL,
    "statementClosingBalance" double precision NOT NULL,
    "bookClosingBalance" double precision NOT NULL,
    "differenceAmount" double precision NOT NULL,
    "notes" text,
    "status" text DEFAULT 'draft' NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bank_reconciliations_user_idx" ON "bank_reconciliations" ("userId");
CREATE INDEX IF NOT EXISTS "bank_reconciliations_bank_idx" ON "bank_reconciliations" ("bankAccountId");
CREATE INDEX IF NOT EXISTS "bank_reconciliations_period_idx" ON "bank_reconciliations" ("statementStart", "statementEnd");

CREATE TABLE IF NOT EXISTS "branch_transfers" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "fromBranchId" text NOT NULL,
    "toBranchId" text NOT NULL,
    "itemId" text NOT NULL,
    "quantity" double precision NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    "transferDate" timestamptz DEFAULT now() NOT NULL,
    "status" text DEFAULT 'completed' NOT NULL,
    "referenceNote" text,
    "createdBy" text NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "branch_transfers_user_idx" ON "branch_transfers" ("userId");
CREATE INDEX IF NOT EXISTS "branch_transfers_from_idx" ON "branch_transfers" ("fromBranchId");
CREATE INDEX IF NOT EXISTS "branch_transfers_to_idx" ON "branch_transfers" ("toBranchId");
CREATE INDEX IF NOT EXISTS "branch_transfers_item_idx" ON "branch_transfers" ("itemId");

CREATE TABLE IF NOT EXISTS "cost_centers" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cost_centers_user_idx" ON "cost_centers" ("userId");
CREATE INDEX IF NOT EXISTS "cost_centers_code_idx" ON "cost_centers" ("code");

CREATE TABLE IF NOT EXISTS "projects" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "projects_user_idx" ON "projects" ("userId");
CREATE INDEX IF NOT EXISTS "projects_code_idx" ON "projects" ("code");
