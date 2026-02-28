CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."amount_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('PRODUCT_IMAGE', 'PROFILE_IMAGE', 'BILL_ATTACHMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'half-day', 'leave');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('all', 'owners', 'staff');--> statement-breakpoint
CREATE TYPE "public"."bill_mode" AS ENUM('GST', 'ESTIMATE');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('BILL', 'PAYMENT', 'RETURN', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('IN', 'OUT', 'ADJUST');--> statement-breakpoint
CREATE TYPE "public"."paper_size" AS ENUM('2INCH', '3INCH', 'A4', 'A5');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('customer', 'supplier');--> statement-breakpoint
CREATE TYPE "public"."payment_direction" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('pending', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'BANK', 'UPI', 'CARD', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PAID', 'PARTIAL', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."payroll_category" AS ENUM('earning', 'deduction', 'statutory');--> statement-breakpoint
CREATE TYPE "public"."period_status" AS ENUM('open', 'locked', 'closed');--> statement-breakpoint
CREATE TYPE "public"."printer_type" AS ENUM('THERMAL', 'STANDARD');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('draft', 'matched', 'mismatched');--> statement-breakpoint
CREATE TYPE "public"."request_module" AS ENUM('inventory', 'billing', 'accounting', 'admin');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('JOURNAL_ENTRY', 'STOCK_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'staff', 'admin');--> statement-breakpoint
CREATE TYPE "public"."salary_run_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."settings_role" AS ENUM('owner', 'manager', 'salesman');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('inactive', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."tax_type" AS ENUM('CGST', 'SGST', 'IGST', 'CESS');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('invoice', 'card', 'email');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('SALE', 'PURCHASE', 'RETURN_INWARD', 'RETURN_OUTWARD');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('posted', 'draft', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."voucher_type" AS ENUM('RECEIPT', 'PAYMENT');--> statement-breakpoint
CREATE TABLE "user_settings" (
	"userId" text PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "role" SET DEFAULT 'staff'::"public"."role";--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."invite_status";--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "status" SET DATA TYPE "public"."invite_status" USING "status"::"public"."invite_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'owner'::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
UPDATE "users" SET "subscriptionStatus" = 'inactive' WHERE "subscriptionStatus"::text = 'expired';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'inactive'::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscriptionStatus" SET DATA TYPE "public"."subscription_status" USING "subscriptionStatus"::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "audience" SET DEFAULT 'all'::"public"."audience";--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "audience" SET DATA TYPE "public"."audience" USING "audience"::"public"."audience";--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "provider" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."payment_intent_status";--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "status" SET DATA TYPE "public"."payment_intent_status" USING "status"::"public"."payment_intent_status";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "paymentMode" SET DEFAULT 'CASH'::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "paymentMode" SET DATA TYPE "public"."payment_mode" USING "paymentMode"::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "organizationId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ALTER COLUMN "type" SET DATA TYPE "public"."party_type" USING "type"::"public"."party_type";--> statement-breakpoint
ALTER TABLE "party_ledger_entries" ALTER COLUMN "sourceType" SET DATA TYPE "public"."ledger_source_type" USING "sourceType"::"public"."ledger_source_type";--> statement-breakpoint
ALTER TABLE "party_ledger_entries" ALTER COLUMN "direction" SET DATA TYPE "public"."ledger_direction" USING "direction"::"public"."ledger_direction";--> statement-breakpoint
ALTER TABLE "payment_entries" ALTER COLUMN "direction" SET DATA TYPE "public"."payment_direction" USING "direction"::"public"."payment_direction";--> statement-breakpoint
ALTER TABLE "payment_entries" ALTER COLUMN "paymentMode" SET DEFAULT 'CASH'::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "payment_entries" ALTER COLUMN "paymentMode" SET DATA TYPE "public"."payment_mode" USING "paymentMode"::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE "public"."transaction_type" USING "type"::"public"."transaction_type";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "paymentMode" SET DEFAULT 'CASH'::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "paymentMode" SET DATA TYPE "public"."payment_mode" USING "paymentMode"::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "paymentStatus" SET DEFAULT 'PAID'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "paymentStatus" SET DATA TYPE "public"."payment_status" USING "paymentStatus"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "billMode" SET DEFAULT 'GST'::"public"."bill_mode";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "billMode" SET DATA TYPE "public"."bill_mode" USING "billMode"::"public"."bill_mode";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "type" SET DATA TYPE "public"."account_type" USING "type"::"public"."account_type";--> statement-breakpoint
ALTER TABLE "bank_ledger_entries" ALTER COLUMN "direction" SET DATA TYPE "public"."ledger_direction" USING "direction"::"public"."ledger_direction";--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."reconciliation_status";--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ALTER COLUMN "status" SET DATA TYPE "public"."reconciliation_status" USING "status"::"public"."reconciliation_status";--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "movementType" SET DATA TYPE "public"."movement_type" USING "movementType"::"public"."movement_type";--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "taxType" SET DATA TYPE "public"."tax_type" USING "taxType"::"public"."tax_type";--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "type" SET DATA TYPE "public"."voucher_type" USING "type"::"public"."voucher_type";--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "mode" SET DEFAULT 'CASH'::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "mode" SET DATA TYPE "public"."payment_mode" USING "mode"::"public"."payment_mode";--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'posted'::"public"."voucher_status";--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "status" SET DATA TYPE "public"."voucher_status" USING "status"::"public"."voucher_status";--> statement-breakpoint
ALTER TABLE "accounting_periods" ALTER COLUMN "status" SET DEFAULT 'open'::"public"."period_status";--> statement-breakpoint
ALTER TABLE "accounting_periods" ALTER COLUMN "status" SET DATA TYPE "public"."period_status" USING "status"::"public"."period_status";--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "module" SET DATA TYPE "public"."request_module" USING "module"::"public"."request_module";--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "requestType" SET DATA TYPE "public"."request_type" USING "requestType"::"public"."request_type";--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."request_status";--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "status" SET DATA TYPE "public"."request_status" USING "status"::"public"."request_status";--> statement-breakpoint
ALTER TABLE "attendance_records" ALTER COLUMN "status" SET DEFAULT 'present'::"public"."attendance_status";--> statement-breakpoint
ALTER TABLE "attendance_records" ALTER COLUMN "status" SET DATA TYPE "public"."attendance_status" USING "status"::"public"."attendance_status";--> statement-breakpoint
ALTER TABLE "payroll_components" ALTER COLUMN "category" SET DATA TYPE "public"."payroll_category" USING "category"::"public"."payroll_category";--> statement-breakpoint
ALTER TABLE "payroll_components" ALTER COLUMN "amountType" SET DEFAULT 'fixed'::"public"."amount_type";--> statement-breakpoint
ALTER TABLE "payroll_components" ALTER COLUMN "amountType" SET DATA TYPE "public"."amount_type" USING "amountType"::"public"."amount_type";--> statement-breakpoint
ALTER TABLE "salary_runs" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."salary_run_status";--> statement-breakpoint
ALTER TABLE "salary_runs" ALTER COLUMN "status" SET DATA TYPE "public"."salary_run_status" USING "status"::"public"."salary_run_status";--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "role" SET DEFAULT 'salesman'::"public"."settings_role";--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "role" SET DATA TYPE "public"."settings_role" USING "role"::"public"."settings_role";--> statement-breakpoint
ALTER TABLE "print_profiles" ALTER COLUMN "printerType" SET DATA TYPE "public"."printer_type" USING "printerType"::"public"."printer_type";--> statement-breakpoint
ALTER TABLE "print_profiles" ALTER COLUMN "paperSize" SET DATA TYPE "public"."paper_size" USING "paperSize"::"public"."paper_size";--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "assetType" SET DATA TYPE "public"."asset_type" USING "assetType"::"public"."asset_type";--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "type" SET DATA TYPE "public"."template_type" USING "type"::"public"."template_type";--> statement-breakpoint
CREATE INDEX "transactions_user_bill_number_idx" ON "transactions" USING btree ("userId","billNumber");
