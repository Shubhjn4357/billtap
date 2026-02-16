CREATE TABLE "accounting_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"lockedBy" text,
	"lockedAt" timestamp with time zone,
	"closedBy" text,
	"closedAt" timestamp with time zone,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"branchId" text,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"parentId" text,
	"isSystem" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
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
	"reviewedAt" timestamp with time zone,
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"staffUid" text NOT NULL,
	"branchId" text,
	"shiftName" text,
	"checkInAt" timestamp with time zone NOT NULL,
	"checkOutAt" timestamp with time zone,
	"overtimeMinutes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
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
CREATE TABLE "bank_accounts" (
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
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"bankAccountId" text NOT NULL,
	"entryDate" timestamp with time zone DEFAULT now() NOT NULL,
	"direction" text NOT NULL,
	"amount" double precision NOT NULL,
	"balanceAfter" double precision,
	"referenceType" text,
	"referenceId" text,
	"narration" text,
	"reconciled" boolean DEFAULT false NOT NULL,
	"reconciledAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"bankAccountId" text NOT NULL,
	"statementStart" timestamp with time zone NOT NULL,
	"statementEnd" timestamp with time zone NOT NULL,
	"statementClosingBalance" double precision NOT NULL,
	"bookClosingBalance" double precision NOT NULL,
	"differenceAmount" double precision NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"templateKey" text NOT NULL,
	"name" text NOT NULL,
	"isPremium" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"layoutConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"fromBranchId" text NOT NULL,
	"toBranchId" text NOT NULL,
	"itemId" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unitCost" double precision DEFAULT 0 NOT NULL,
	"transferDate" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"referenceNote" text,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_controls" (
	"userId" text PRIMARY KEY NOT NULL,
	"makerCheckerEnabled" boolean DEFAULT true NOT NULL,
	"journalApprovalRequired" boolean DEFAULT true NOT NULL,
	"stockAdjustmentApprovalRequired" boolean DEFAULT true NOT NULL,
	"periodLockEnabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"branchId" text,
	"expenseDate" timestamp with time zone DEFAULT now() NOT NULL,
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
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"studentId" text NOT NULL,
	"invoiceNumber" text,
	"amount" double precision NOT NULL,
	"paidAmount" double precision DEFAULT 0 NOT NULL,
	"dueAmount" double precision DEFAULT 0 NOT NULL,
	"dueDate" timestamp with time zone,
	"status" text DEFAULT 'DUE' NOT NULL,
	"paymentMode" text,
	"barcodeValue" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_reminder_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"feeInvoiceId" text NOT NULL,
	"channel" text DEFAULT 'WHATSAPP' NOT NULL,
	"recipient" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sentByUid" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gst_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"relatedTransactionId" text,
	"noteNumber" text,
	"noteDate" timestamp with time zone DEFAULT now() NOT NULL,
	"partyId" text,
	"partyName" text,
	"partyGstNumber" text,
	"reason" text,
	"taxableAmount" double precision DEFAULT 0 NOT NULL,
	"taxAmount" double precision DEFAULT 0 NOT NULL,
	"totalAmount" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_students" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"name" text NOT NULL,
	"className" text,
	"admissionNumber" text,
	"guardianName" text,
	"phoneNumber" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"branchId" text,
	"itemId" text NOT NULL,
	"transactionId" text,
	"movementType" text NOT NULL,
	"quantity" double precision NOT NULL,
	"balanceAfter" double precision,
	"unitCost" double precision,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"branchId" text,
	"costCenter" text,
	"projectCode" text,
	"entryDate" timestamp with time zone DEFAULT now() NOT NULL,
	"batchNumber" text,
	"referenceType" text,
	"referenceId" text,
	"narration" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"entryId" text NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"partyId" text,
	"debit" double precision DEFAULT 0 NOT NULL,
	"credit" double precision DEFAULT 0 NOT NULL,
	"hsn" text,
	"gstRate" double precision DEFAULT 0,
	"taxType" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
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
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_logs" (
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
	"sentAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text NOT NULL,
	"role" text DEFAULT 'salesman' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"invitedBy" text,
	"phoneNumberSnapshot" text,
	"joinedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organizationId" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
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
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_usage_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"billsCreated" integer DEFAULT 0 NOT NULL,
	"storesCount" integer DEFAULT 0 NOT NULL,
	"staffCount" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"name" text NOT NULL,
	"nameLowercase" text NOT NULL,
	"type" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"gstNumber" text,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"partyId" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" text,
	"direction" text NOT NULL,
	"amount" double precision NOT NULL,
	"runningBalance" double precision DEFAULT 0 NOT NULL,
	"entryDate" timestamp with time zone DEFAULT now() NOT NULL,
	"narration" text,
	"createdByUid" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"partyId" text NOT NULL,
	"direction" text NOT NULL,
	"amount" double precision NOT NULL,
	"paymentDate" timestamp with time zone DEFAULT now() NOT NULL,
	"paymentMode" text DEFAULT 'CASH' NOT NULL,
	"referenceNumber" text,
	"narration" text,
	"createdByUid" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_components" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amountType" text DEFAULT 'fixed' NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"name" text NOT NULL,
	"printerType" text NOT NULL,
	"paperSize" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_run_items" (
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
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"branchId" text,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"totalGross" double precision DEFAULT 0 NOT NULL,
	"totalDeductions" double precision DEFAULT 0 NOT NULL,
	"totalNet" double precision DEFAULT 0 NOT NULL,
	"journalEntryId" text,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"name" text,
	"signatureData" text,
	"signatureUrl" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdByUid" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"organizationId" text,
	"phoneNumber" text NOT NULL,
	"role" text DEFAULT 'staff',
	"permissions" jsonb,
	"status" text DEFAULT 'pending',
	"code" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text,
	"branchId" text,
	"type" text NOT NULL,
	"partyId" text,
	"partyName" text,
	"partyPhone" text,
	"billNumber" text,
	"billDate" timestamp with time zone DEFAULT now() NOT NULL,
	"businessName" text,
	"businessAddress" text,
	"gstNumber" text,
	"currency" text DEFAULT 'INR',
	"costCenter" text,
	"projectCode" text,
	"totalAmount" double precision NOT NULL,
	"discountAmount" double precision DEFAULT 0,
	"taxAmount" double precision DEFAULT 0,
	"paidAmount" double precision DEFAULT 0,
	"paymentMode" text DEFAULT 'CASH' NOT NULL,
	"paymentStatus" text DEFAULT 'PAID' NOT NULL,
	"billMode" text DEFAULT 'GST' NOT NULL,
	"affectsGst" boolean DEFAULT true NOT NULL,
	"createdByUid" text,
	"dueDate" timestamp with time zone,
	"reminderEnabled" boolean DEFAULT false NOT NULL,
	"reminderFrequencyDays" integer DEFAULT 3 NOT NULL,
	"nextReminderAt" timestamp with time zone,
	"lastReminderAt" timestamp with time zone,
	"items" jsonb NOT NULL,
	"remark" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"branchId" text,
	"type" text NOT NULL,
	"voucherDate" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" double precision NOT NULL,
	"mode" text DEFAULT 'CASH' NOT NULL,
	"bankAccountId" text,
	"partyId" text,
	"partyName" text,
	"narration" text,
	"costCenter" text,
	"projectCode" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "orders" CASCADE;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "branchId" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "purchasePrice" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "mrp" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "hsn" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "gstPercentage" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "minimumStock" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "openingStock" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "unit" text DEFAULT 'pcs';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "imageUrl" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "expiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "autoDeleteAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "autoDeleteEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "isActive" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ownerId" text;--> statement-breakpoint
CREATE INDEX "accounting_periods_user_idx" ON "accounting_periods" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "accounting_periods_range_idx" ON "accounting_periods" USING btree ("periodStart","periodEnd");--> statement-breakpoint
CREATE INDEX "accounting_periods_status_idx" ON "accounting_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "accounts_branch_idx" ON "accounts" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "accounts_code_idx" ON "accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "approval_requests_user_status_idx" ON "approval_requests" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "approval_requests_module_idx" ON "approval_requests" USING btree ("module");--> statement-breakpoint
CREATE INDEX "approval_requests_requester_idx" ON "approval_requests" USING btree ("requestedBy");--> statement-breakpoint
CREATE INDEX "approval_requests_created_idx" ON "approval_requests" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "attendance_records_user_idx" ON "attendance_records" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "attendance_records_staff_idx" ON "attendance_records" USING btree ("staffUid");--> statement-breakpoint
CREATE INDEX "attendance_records_checkin_idx" ON "attendance_records" USING btree ("checkInAt");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "audit_logs_module_idx" ON "audit_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actorUid");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "bank_accounts_user_idx" ON "bank_accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "bank_accounts_branch_idx" ON "bank_accounts" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "bank_ledger_entries_user_idx" ON "bank_ledger_entries" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "bank_ledger_entries_bank_idx" ON "bank_ledger_entries" USING btree ("bankAccountId");--> statement-breakpoint
CREATE INDEX "bank_ledger_entries_date_idx" ON "bank_ledger_entries" USING btree ("entryDate");--> statement-breakpoint
CREATE INDEX "bank_ledger_entries_reconciled_idx" ON "bank_ledger_entries" USING btree ("reconciled");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_user_idx" ON "bank_reconciliations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_bank_idx" ON "bank_reconciliations" USING btree ("bankAccountId");--> statement-breakpoint
CREATE INDEX "bank_reconciliations_period_idx" ON "bank_reconciliations" USING btree ("statementStart","statementEnd");--> statement-breakpoint
CREATE INDEX "bill_templates_user_idx" ON "bill_templates" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "bill_templates_org_idx" ON "bill_templates" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "bill_templates_key_idx" ON "bill_templates" USING btree ("templateKey");--> statement-breakpoint
CREATE INDEX "branch_transfers_user_idx" ON "branch_transfers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "branch_transfers_from_idx" ON "branch_transfers" USING btree ("fromBranchId");--> statement-breakpoint
CREATE INDEX "branch_transfers_to_idx" ON "branch_transfers" USING btree ("toBranchId");--> statement-breakpoint
CREATE INDEX "branch_transfers_item_idx" ON "branch_transfers" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "branches_user_idx" ON "branches" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "branches_code_idx" ON "branches" USING btree ("code");--> statement-breakpoint
CREATE INDEX "business_controls_user_idx" ON "business_controls" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "cost_centers_user_idx" ON "cost_centers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "cost_centers_code_idx" ON "cost_centers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "expenses_user_idx" ON "expenses" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "expenses_org_idx" ON "expenses" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "expenses_branch_idx" ON "expenses" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expenseDate");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "fee_invoices_user_idx" ON "fee_invoices" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "fee_invoices_org_idx" ON "fee_invoices" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "fee_invoices_student_idx" ON "fee_invoices" USING btree ("studentId");--> statement-breakpoint
CREATE INDEX "fee_invoices_due_date_idx" ON "fee_invoices" USING btree ("dueDate");--> statement-breakpoint
CREATE INDEX "fee_invoices_status_idx" ON "fee_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fee_reminder_logs_user_idx" ON "fee_reminder_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "fee_reminder_logs_org_idx" ON "fee_reminder_logs" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "fee_reminder_logs_invoice_idx" ON "fee_reminder_logs" USING btree ("feeInvoiceId");--> statement-breakpoint
CREATE INDEX "fee_reminder_logs_status_idx" ON "fee_reminder_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gst_notes_user_idx" ON "gst_notes" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gst_notes_type_idx" ON "gst_notes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gst_notes_date_idx" ON "gst_notes" USING btree ("noteDate");--> statement-breakpoint
CREATE INDEX "institution_students_user_idx" ON "institution_students" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "institution_students_org_idx" ON "institution_students" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "institution_students_phone_idx" ON "institution_students" USING btree ("phoneNumber");--> statement-breakpoint
CREATE INDEX "inventory_movements_user_idx" ON "inventory_movements" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "inventory_movements_branch_idx" ON "inventory_movements" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_idx" ON "inventory_movements" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "inventory_movements_txn_idx" ON "inventory_movements" USING btree ("transactionId");--> statement-breakpoint
CREATE INDEX "inventory_movements_created_idx" ON "inventory_movements" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "journal_entries_user_idx" ON "journal_entries" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "journal_entries_branch_idx" ON "journal_entries" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("entryDate");--> statement-breakpoint
CREATE INDEX "journal_entries_ref_idx" ON "journal_entries" USING btree ("referenceType","referenceId");--> statement-breakpoint
CREATE INDEX "journal_lines_user_idx" ON "journal_lines" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("entryId");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "media_assets_user_idx" ON "media_assets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "media_assets_org_idx" ON "media_assets" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "media_assets_entity_idx" ON "media_assets" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "message_logs_user_idx" ON "message_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "message_logs_org_idx" ON "message_logs" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "message_logs_channel_idx" ON "message_logs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "message_logs_status_idx" ON "message_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "organization_members_org_idx" ON "organization_members" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "organization_members_role_idx" ON "organization_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "organization_members_active_idx" ON "organization_members" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "organization_settings_user_idx" ON "organization_settings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "organizations_user_idx" ON "organizations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "organizations_code_idx" ON "organizations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "organizations_active_idx" ON "organizations" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "owner_usage_snapshots_user_idx" ON "owner_usage_snapshots" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "owner_usage_snapshots_month_year_idx" ON "owner_usage_snapshots" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "parties_user_idx" ON "parties" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "parties_org_idx" ON "parties" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "parties_name_idx" ON "parties" USING btree ("nameLowercase");--> statement-breakpoint
CREATE INDEX "parties_type_idx" ON "parties" USING btree ("type");--> statement-breakpoint
CREATE INDEX "party_ledger_entries_user_idx" ON "party_ledger_entries" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "party_ledger_entries_org_idx" ON "party_ledger_entries" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "party_ledger_entries_party_idx" ON "party_ledger_entries" USING btree ("partyId");--> statement-breakpoint
CREATE INDEX "party_ledger_entries_date_idx" ON "party_ledger_entries" USING btree ("entryDate");--> statement-breakpoint
CREATE INDEX "payment_entries_user_idx" ON "payment_entries" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "payment_entries_org_idx" ON "payment_entries" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "payment_entries_party_idx" ON "payment_entries" USING btree ("partyId");--> statement-breakpoint
CREATE INDEX "payment_entries_date_idx" ON "payment_entries" USING btree ("paymentDate");--> statement-breakpoint
CREATE INDEX "payroll_components_user_idx" ON "payroll_components" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "payroll_components_code_idx" ON "payroll_components" USING btree ("code");--> statement-breakpoint
CREATE INDEX "payroll_components_category_idx" ON "payroll_components" USING btree ("category");--> statement-breakpoint
CREATE INDEX "print_profiles_user_idx" ON "print_profiles" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "print_profiles_org_idx" ON "print_profiles" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "print_profiles_default_idx" ON "print_profiles" USING btree ("isDefault");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "projects_code_idx" ON "projects" USING btree ("code");--> statement-breakpoint
CREATE INDEX "salary_run_items_user_idx" ON "salary_run_items" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "salary_run_items_run_idx" ON "salary_run_items" USING btree ("runId");--> statement-breakpoint
CREATE INDEX "salary_run_items_staff_idx" ON "salary_run_items" USING btree ("staffUid");--> statement-breakpoint
CREATE INDEX "salary_runs_user_idx" ON "salary_runs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "salary_runs_period_idx" ON "salary_runs" USING btree ("periodStart","periodEnd");--> statement-breakpoint
CREATE INDEX "salary_runs_status_idx" ON "salary_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signatures_user_idx" ON "signatures" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "signatures_org_idx" ON "signatures" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "signatures_default_idx" ON "signatures" USING btree ("isDefault");--> statement-breakpoint
CREATE INDEX "staff_invites_owner_idx" ON "staff_invites" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "staff_invites_phone_idx" ON "staff_invites" USING btree ("phoneNumber");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "transactions_org_idx" ON "transactions" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "transactions_branch_idx" ON "transactions" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_created_idx" ON "transactions" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "transactions_party_idx" ON "transactions" USING btree ("partyId");--> statement-breakpoint
CREATE INDEX "transactions_due_date_idx" ON "transactions" USING btree ("dueDate");--> statement-breakpoint
CREATE INDEX "transactions_payment_status_idx" ON "transactions" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX "transactions_next_reminder_idx" ON "transactions" USING btree ("nextReminderAt");--> statement-breakpoint
CREATE INDEX "vouchers_user_idx" ON "vouchers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "vouchers_type_idx" ON "vouchers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "vouchers_date_idx" ON "vouchers" USING btree ("voucherDate");--> statement-breakpoint
CREATE INDEX "vouchers_branch_idx" ON "vouchers" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "items_branch_idx" ON "items" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "items_expires_at_idx" ON "items" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "items_auto_delete_at_idx" ON "items" USING btree ("autoDeleteAt");--> statement-breakpoint
CREATE INDEX "users_owner_idx" ON "users" USING btree ("ownerId");