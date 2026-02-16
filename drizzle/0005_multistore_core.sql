-- Multi-store core, RBAC memberships, customization, ledger/payments, and institution support

ALTER TABLE "items"
    ADD COLUMN IF NOT EXISTS "imageUrl" text;

ALTER TABLE "parties"
    ADD COLUMN IF NOT EXISTS "organizationId" text;

ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "organizationId" text,
    ADD COLUMN IF NOT EXISTS "billMode" text DEFAULT 'GST' NOT NULL,
    ADD COLUMN IF NOT EXISTS "affectsGst" boolean DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS "createdByUid" text;

ALTER TABLE "staff_invites"
    ADD COLUMN IF NOT EXISTS "organizationId" text,
    ADD COLUMN IF NOT EXISTS "permissions" jsonb;

CREATE INDEX IF NOT EXISTS "parties_org_idx" ON "parties" ("organizationId");
CREATE INDEX IF NOT EXISTS "transactions_org_idx" ON "transactions" ("organizationId");

CREATE TABLE IF NOT EXISTS "organizations" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "name" text NOT NULL,
    "code" text NOT NULL,
    "gstNumber" text,
    "address" text,
    "phoneNumber" text,
    "email" text,
    "currency" text DEFAULT 'INR' NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "organizations_user_idx" ON "organizations" ("userId");
CREATE INDEX IF NOT EXISTS "organizations_code_idx" ON "organizations" ("code");
CREATE INDEX IF NOT EXISTS "organizations_active_idx" ON "organizations" ("isActive");

CREATE TABLE IF NOT EXISTS "organization_members" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    "role" text DEFAULT 'salesman' NOT NULL,
    "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "invitedBy" text,
    "phoneNumberSnapshot" text,
    "joinedAt" timestamptz DEFAULT now() NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "organization_members_user_idx" ON "organization_members" ("userId");
CREATE INDEX IF NOT EXISTS "organization_members_org_idx" ON "organization_members" ("organizationId");
CREATE INDEX IF NOT EXISTS "organization_members_role_idx" ON "organization_members" ("role");
CREATE INDEX IF NOT EXISTS "organization_members_active_idx" ON "organization_members" ("isActive");

CREATE TABLE IF NOT EXISTS "organization_settings" (
    "organizationId" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "organization_settings_user_idx" ON "organization_settings" ("userId");

CREATE TABLE IF NOT EXISTS "owner_usage_snapshots" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "billsCreated" integer DEFAULT 0 NOT NULL,
    "storesCount" integer DEFAULT 0 NOT NULL,
    "staffCount" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "owner_usage_snapshots_user_idx" ON "owner_usage_snapshots" ("userId");
CREATE INDEX IF NOT EXISTS "owner_usage_snapshots_month_year_idx" ON "owner_usage_snapshots" ("year", "month");

CREATE TABLE IF NOT EXISTS "party_ledger_entries" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "partyId" text NOT NULL,
    "sourceType" text NOT NULL,
    "sourceId" text,
    "direction" text NOT NULL,
    "amount" double precision NOT NULL,
    "runningBalance" double precision DEFAULT 0 NOT NULL,
    "entryDate" timestamptz DEFAULT now() NOT NULL,
    "narration" text,
    "createdByUid" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "party_ledger_entries_user_idx" ON "party_ledger_entries" ("userId");
CREATE INDEX IF NOT EXISTS "party_ledger_entries_org_idx" ON "party_ledger_entries" ("organizationId");
CREATE INDEX IF NOT EXISTS "party_ledger_entries_party_idx" ON "party_ledger_entries" ("partyId");
CREATE INDEX IF NOT EXISTS "party_ledger_entries_date_idx" ON "party_ledger_entries" ("entryDate");

CREATE TABLE IF NOT EXISTS "payment_entries" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "partyId" text NOT NULL,
    "direction" text NOT NULL,
    "amount" double precision NOT NULL,
    "paymentDate" timestamptz DEFAULT now() NOT NULL,
    "paymentMode" text DEFAULT 'CASH' NOT NULL,
    "referenceNumber" text,
    "narration" text,
    "createdByUid" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payment_entries_user_idx" ON "payment_entries" ("userId");
CREATE INDEX IF NOT EXISTS "payment_entries_org_idx" ON "payment_entries" ("organizationId");
CREATE INDEX IF NOT EXISTS "payment_entries_party_idx" ON "payment_entries" ("partyId");
CREATE INDEX IF NOT EXISTS "payment_entries_date_idx" ON "payment_entries" ("paymentDate");

CREATE TABLE IF NOT EXISTS "expenses" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "branchId" text,
    "expenseDate" timestamptz DEFAULT now() NOT NULL,
    "category" text NOT NULL,
    "amount" double precision NOT NULL,
    "paymentMode" text DEFAULT 'CASH' NOT NULL,
    "paidToPartyId" text,
    "paidToName" text,
    "costCenter" text,
    "projectCode" text,
    "notes" text,
    "attachmentUrl" text,
    "createdByUid" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "expenses_user_idx" ON "expenses" ("userId");
CREATE INDEX IF NOT EXISTS "expenses_org_idx" ON "expenses" ("organizationId");
CREATE INDEX IF NOT EXISTS "expenses_branch_idx" ON "expenses" ("branchId");
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("expenseDate");
CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" ("category");

CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "assetType" text NOT NULL,
    "entityType" text,
    "entityId" text,
    "url" text NOT NULL,
    "mimeType" text,
    "sizeBytes" integer,
    "createdByUid" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "media_assets_user_idx" ON "media_assets" ("userId");
CREATE INDEX IF NOT EXISTS "media_assets_org_idx" ON "media_assets" ("organizationId");
CREATE INDEX IF NOT EXISTS "media_assets_entity_idx" ON "media_assets" ("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "signatures" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "name" text,
    "signatureData" text,
    "signatureUrl" text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdByUid" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "signatures_user_idx" ON "signatures" ("userId");
CREATE INDEX IF NOT EXISTS "signatures_org_idx" ON "signatures" ("organizationId");
CREATE INDEX IF NOT EXISTS "signatures_default_idx" ON "signatures" ("isDefault");

CREATE TABLE IF NOT EXISTS "bill_templates" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "templateKey" text NOT NULL,
    "name" text NOT NULL,
    "isPremium" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "layoutConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bill_templates_user_idx" ON "bill_templates" ("userId");
CREATE INDEX IF NOT EXISTS "bill_templates_org_idx" ON "bill_templates" ("organizationId");
CREATE INDEX IF NOT EXISTS "bill_templates_key_idx" ON "bill_templates" ("templateKey");

CREATE TABLE IF NOT EXISTS "print_profiles" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "name" text NOT NULL,
    "printerType" text NOT NULL,
    "paperSize" text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "print_profiles_user_idx" ON "print_profiles" ("userId");
CREATE INDEX IF NOT EXISTS "print_profiles_org_idx" ON "print_profiles" ("organizationId");
CREATE INDEX IF NOT EXISTS "print_profiles_default_idx" ON "print_profiles" ("isDefault");

CREATE TABLE IF NOT EXISTS "message_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "channel" text NOT NULL,
    "recipient" text NOT NULL,
    "message" text NOT NULL,
    "mediaUrl" text,
    "providerMessageId" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "errorMessage" text,
    "sentByUid" text,
    "sentAt" timestamptz,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "message_logs_user_idx" ON "message_logs" ("userId");
CREATE INDEX IF NOT EXISTS "message_logs_org_idx" ON "message_logs" ("organizationId");
CREATE INDEX IF NOT EXISTS "message_logs_channel_idx" ON "message_logs" ("channel");
CREATE INDEX IF NOT EXISTS "message_logs_status_idx" ON "message_logs" ("status");

CREATE TABLE IF NOT EXISTS "institution_students" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "name" text NOT NULL,
    "className" text,
    "admissionNumber" text,
    "guardianName" text,
    "phoneNumber" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "institution_students_user_idx" ON "institution_students" ("userId");
CREATE INDEX IF NOT EXISTS "institution_students_org_idx" ON "institution_students" ("organizationId");
CREATE INDEX IF NOT EXISTS "institution_students_phone_idx" ON "institution_students" ("phoneNumber");

CREATE TABLE IF NOT EXISTS "fee_invoices" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "studentId" text NOT NULL,
    "invoiceNumber" text,
    "amount" double precision NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    "dueAmount" double precision DEFAULT 0 NOT NULL,
    "dueDate" timestamptz,
    "status" text DEFAULT 'DUE' NOT NULL,
    "paymentMode" text,
    "barcodeValue" text,
    "notes" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL,
    "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "fee_invoices_user_idx" ON "fee_invoices" ("userId");
CREATE INDEX IF NOT EXISTS "fee_invoices_org_idx" ON "fee_invoices" ("organizationId");
CREATE INDEX IF NOT EXISTS "fee_invoices_student_idx" ON "fee_invoices" ("studentId");
CREATE INDEX IF NOT EXISTS "fee_invoices_due_date_idx" ON "fee_invoices" ("dueDate");
CREATE INDEX IF NOT EXISTS "fee_invoices_status_idx" ON "fee_invoices" ("status");

CREATE TABLE IF NOT EXISTS "fee_reminder_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text,
    "feeInvoiceId" text NOT NULL,
    "channel" text DEFAULT 'WHATSAPP' NOT NULL,
    "recipient" text,
    "message" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "sentByUid" text,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "fee_reminder_logs_user_idx" ON "fee_reminder_logs" ("userId");
CREATE INDEX IF NOT EXISTS "fee_reminder_logs_org_idx" ON "fee_reminder_logs" ("organizationId");
CREATE INDEX IF NOT EXISTS "fee_reminder_logs_invoice_idx" ON "fee_reminder_logs" ("feeInvoiceId");
CREATE INDEX IF NOT EXISTS "fee_reminder_logs_status_idx" ON "fee_reminder_logs" ("status");
