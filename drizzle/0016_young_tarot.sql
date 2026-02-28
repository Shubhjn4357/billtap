CREATE TYPE "public"."admin_role" AS ENUM('SUPER_ADMIN', 'SUPPORT_ADMIN', 'READ_ONLY_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('MONTHLY', 'YEARLY', 'THREE_YEAR');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ANDROID', 'IOS', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."discount_scope" AS ENUM('PLAN', 'TIER', 'GLOBAL');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT');--> statement-breakpoint
CREATE TYPE "public"."feature_flag" AS ENUM('OFFLINE_BILLING', 'GST_INVOICES', 'PURCHASE_MODULE', 'STOCK_MODULE', 'PARTY_MANAGEMENT', 'GST_REPORTS', 'ADVANCED_REPORTS', 'E_INVOICE', 'E_WAY_BILL', 'MULTI_BUSINESS', 'STAFF_USERS', 'CLOUD_SYNC', 'MULTI_DEVICE', 'BACKUP_CLOUD', 'EXPORT_PDF', 'EXPORT_EXCEL', 'ACCESS_WEB_DASHBOARD', 'API_ACCESS', 'BATCH_EXPIRY', 'MULTI_GODOWN');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('TAX_INVOICE', 'BILL_OF_SUPPLY', 'ESTIMATE', 'PROFORMA', 'CREDIT_NOTE_DOC', 'DEBIT_NOTE_DOC', 'DELIVERY_CHALLAN');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('OWNER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP');--> statement-breakpoint
CREATE TYPE "public"."plan_limit_type" AS ENUM('MAX_BILLS', 'MAX_STAFF_USERS', 'MAX_BUSINESSES', 'MAX_DEVICES', 'MAX_STORAGE_MB');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_email" text NOT NULL,
	"admin_role" "admin_role" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_members" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'STAFF' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"invited_by_user_id" text,
	"phone_snapshot" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"address" text,
	"state" text,
	"gstin" text,
	"pan" text,
	"books_start_date" date,
	"logo_url" text,
	"phone" text,
	"email" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"category" text,
	"code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"user_id" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"device_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"scope" "discount_scope" NOT NULL,
	"value" double precision NOT NULL,
	"max_redemptions" integer,
	"per_user_limit" integer,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"applicable_tiers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"applicable_billing_cycles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_admin_id" text,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"item_id" text,
	"description" text NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"unit" text,
	"rate" double precision DEFAULT 0 NOT NULL,
	"discount_percent" double precision DEFAULT 0 NOT NULL,
	"taxable_value" double precision DEFAULT 0 NOT NULL,
	"cgst_rate" double precision DEFAULT 0 NOT NULL,
	"cgst_amount" double precision DEFAULT 0 NOT NULL,
	"sgst_rate" double precision DEFAULT 0 NOT NULL,
	"sgst_amount" double precision DEFAULT 0 NOT NULL,
	"igst_rate" double precision DEFAULT 0 NOT NULL,
	"igst_amount" double precision DEFAULT 0 NOT NULL,
	"cess_rate" double precision DEFAULT 0 NOT NULL,
	"cess_amount" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"invoice_type" "invoice_type" NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" text,
	"place_of_supply" text,
	"total_taxable_value" double precision DEFAULT 0 NOT NULL,
	"total_tax_amount" double precision DEFAULT 0 NOT NULL,
	"total_invoice_value" double precision DEFAULT 0 NOT NULL,
	"reverse_charge" boolean DEFAULT false NOT NULL,
	"gst_rate_breakup_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"e_invoice_irn" text,
	"e_invoice_status" text,
	"e_way_bill_number" text,
	"payment_status" "payment_status" DEFAULT 'UNPAID' NOT NULL,
	"paid_amount" double precision DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"bills_created_in_month" integer DEFAULT 0 NOT NULL,
	"storage_used_mb" double precision DEFAULT 0 NOT NULL,
	"staff_users_count" integer DEFAULT 0 NOT NULL,
	"devices_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'FREE' NOT NULL,
	"billing_cycle" "billing_cycle",
	"status" "subscription_status" DEFAULT 'TRIAL' NOT NULL,
	"start_date" date,
	"end_date" date,
	"next_renewal_date" date,
	"grace_end_date" date,
	"max_bills_total" integer,
	"max_bills_per_month" integer,
	"max_staff_users" integer,
	"max_businesses" integer,
	"max_devices" integer,
	"max_storage_mb" integer,
	"offline_only" boolean DEFAULT false NOT NULL,
	"cloud_sync_allowed" boolean DEFAULT false NOT NULL,
	"web_dashboard_allowed" boolean DEFAULT false NOT NULL,
	"feature_flags_enabled" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"voucher_id" text NOT NULL,
	"account_id" text NOT NULL,
	"debit" double precision DEFAULT 0 NOT NULL,
	"credit" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_verifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "party_ledger_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_ledger_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journal_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journal_lines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounting_periods" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approval_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branches" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_controls" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payroll_components" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "salary_run_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "salary_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "owner_usage_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "print_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_assets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "phone_verifications" CASCADE;--> statement-breakpoint
DROP TABLE "expenses" CASCADE;--> statement-breakpoint
DROP TABLE "party_ledger_entries" CASCADE;--> statement-breakpoint
DROP TABLE "payment_entries" CASCADE;--> statement-breakpoint
DROP TABLE "transactions" CASCADE;--> statement-breakpoint
DROP TABLE "bank_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "bank_ledger_entries" CASCADE;--> statement-breakpoint
DROP TABLE "bank_reconciliations" CASCADE;--> statement-breakpoint
DROP TABLE "journal_entries" CASCADE;--> statement-breakpoint
DROP TABLE "journal_lines" CASCADE;--> statement-breakpoint
DROP TABLE "accounting_periods" CASCADE;--> statement-breakpoint
DROP TABLE "approval_requests" CASCADE;--> statement-breakpoint
DROP TABLE "attendance_records" CASCADE;--> statement-breakpoint
DROP TABLE "audit_logs" CASCADE;--> statement-breakpoint
DROP TABLE "branches" CASCADE;--> statement-breakpoint
DROP TABLE "business_controls" CASCADE;--> statement-breakpoint
DROP TABLE "payroll_components" CASCADE;--> statement-breakpoint
DROP TABLE "salary_run_items" CASCADE;--> statement-breakpoint
DROP TABLE "salary_runs" CASCADE;--> statement-breakpoint
DROP TABLE "bill_templates" CASCADE;--> statement-breakpoint
DROP TABLE "organization_categories" CASCADE;--> statement-breakpoint
DROP TABLE "organization_members" CASCADE;--> statement-breakpoint
DROP TABLE "organization_settings" CASCADE;--> statement-breakpoint
DROP TABLE "organizations" CASCADE;--> statement-breakpoint
DROP TABLE "owner_usage_snapshots" CASCADE;--> statement-breakpoint
DROP TABLE "print_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "user_settings" CASCADE;--> statement-breakpoint
DROP TABLE "media_assets" CASCADE;--> statement-breakpoint
ALTER TABLE "parties" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."party_type";--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('CUSTOMER', 'SUPPLIER');--> statement-breakpoint
ALTER TABLE "parties" ALTER COLUMN "type" SET DATA TYPE "public"."party_type" USING "type"::"public"."party_type";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_status" SET DEFAULT 'UNPAID'::text;--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_status" SET DEFAULT 'UNPAID'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_status" SET DATA TYPE "public"."payment_status" USING "payment_status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'TRIAL'::text;--> statement-breakpoint
DROP TYPE "public"."subscription_status";--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'EXPIRED', 'TRIAL', 'CANCELLED', 'GRACE');--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'TRIAL'::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DATA TYPE "public"."subscription_status" USING "status"::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "voucher_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."voucher_type";--> statement-breakpoint
CREATE TYPE "public"."voucher_type" AS ENUM('SALES_INVOICE', 'PURCHASE_INVOICE', 'PAYMENT', 'RECEIPT', 'CONTRA', 'JOURNAL', 'CREDIT_NOTE', 'DEBIT_NOTE');--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "voucher_type" SET DATA TYPE "public"."voucher_type" USING "voucher_type"::"public"."voucher_type";--> statement-breakpoint
DROP INDEX "staff_invites_owner_idx";--> statement-breakpoint
DROP INDEX "users_role_idx";--> statement-breakpoint
DROP INDEX "users_owner_idx";--> statement-breakpoint
DROP INDEX "users_subscription_status_idx";--> statement-breakpoint
DROP INDEX "payment_intents_user_idx";--> statement-breakpoint
DROP INDEX "plans_active_idx";--> statement-breakpoint
DROP INDEX "items_user_idx";--> statement-breakpoint
DROP INDEX "items_branch_idx";--> statement-breakpoint
DROP INDEX "items_org_idx";--> statement-breakpoint
DROP INDEX "items_org_branch_idx";--> statement-breakpoint
DROP INDEX "items_category_idx";--> statement-breakpoint
DROP INDEX "items_expires_at_idx";--> statement-breakpoint
DROP INDEX "items_auto_delete_at_idx";--> statement-breakpoint
DROP INDEX "parties_user_idx";--> statement-breakpoint
DROP INDEX "parties_org_idx";--> statement-breakpoint
DROP INDEX "parties_type_idx";--> statement-breakpoint
DROP INDEX "accounts_user_idx";--> statement-breakpoint
DROP INDEX "accounts_branch_idx";--> statement-breakpoint
DROP INDEX "accounts_type_idx";--> statement-breakpoint
DROP INDEX "inventory_movements_user_idx";--> statement-breakpoint
DROP INDEX "inventory_movements_branch_idx";--> statement-breakpoint
DROP INDEX "inventory_movements_txn_idx";--> statement-breakpoint
DROP INDEX "vouchers_user_idx";--> statement-breakpoint
DROP INDEX "vouchers_branch_idx";--> statement-breakpoint
DROP INDEX "vouchers_type_idx";--> statement-breakpoint
DROP INDEX "signatures_user_idx";--> statement-breakpoint
DROP INDEX "signatures_org_idx";--> statement-breakpoint
DROP INDEX "signatures_default_idx";--> statement-breakpoint
DROP INDEX "templates_default_idx";--> statement-breakpoint
DROP INDEX "staff_invites_phone_idx";--> statement-breakpoint
DROP INDEX "analytics_events_created_idx";--> statement-breakpoint
DROP INDEX "analytics_events_type_idx";--> statement-breakpoint
DROP INDEX "offers_active_idx";--> statement-breakpoint
DROP INDEX "items_name_idx";--> statement-breakpoint
DROP INDEX "parties_name_idx";--> statement-breakpoint
DROP INDEX "inventory_movements_item_idx";--> statement-breakpoint
DROP INDEX "inventory_movements_created_idx";--> statement-breakpoint
DROP INDEX "vouchers_date_idx";--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::text::"public"."member_role";--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "role" SET DEFAULT 'STAFF';--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "staff_invites" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "analytics_events" ALTER COLUMN "metadata" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "audience" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "audience" SET DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "stock" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'POSTED';--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "content" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD COLUMN "owner_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD COLUMN "phone_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "business_id" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "event_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "offer_id" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "banner_background" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "cta_text" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "cta_route" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "plan_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "plan_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "checkout_url" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "provider_reference" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "tier" "subscription_tier" NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "billing_cycle" "billing_cycle";--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "price_per_cycle" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "effective_discount_vs_monthly_percent" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "is_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_bills_total" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_bills_per_month" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_staff_users" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_businesses" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_devices" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_storage_mb" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "offline_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "cloud_sync_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "web_dashboard_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "enabled_features" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "disabled_features" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "name_lowercase" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "purchase_price" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "sale_price" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "gst_rate" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "opening_stock" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "reorder_level" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "auto_delete_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "auto_delete_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "name_lowercase" text NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "shipping_address" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "opening_balance" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "credit_limit" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "parent_account_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "item_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "movement_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "balance_after" double precision;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reference_id" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "voucher_type" "voucher_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "date" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "party_id" text;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "total_amount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "business_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "signature_data" text;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "signature_url" text;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "business_id" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_admin_idx" ON "admin_audit_logs" USING btree ("admin_email");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "business_members_business_idx" ON "business_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_members_user_idx" ON "business_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "businesses_active_idx" ON "businesses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "devices_business_idx" ON "devices" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discounts_code_idx" ON "discounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discounts_active_idx" ON "discounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_item_idx" ON "invoice_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "invoices_business_idx" ON "invoices" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "invoices_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "plan_usage_business_idx" ON "plan_usage" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "plan_usage_month_year_idx" ON "plan_usage" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "subscriptions_business_idx" ON "subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voucher_lines_voucher_idx" ON "voucher_lines" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "voucher_lines_account_idx" ON "voucher_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "staff_invites_business_idx" ON "staff_invites" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "users_google_sub_idx" ON "users" USING btree ("google_sub");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payment_intents_business_idx" ON "payment_intents" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "plans_tier_idx" ON "plans" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "plans_visible_idx" ON "plans" USING btree ("is_visible");--> statement-breakpoint
CREATE INDEX "items_business_idx" ON "items" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "parties_business_idx" ON "parties" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "accounts_business_idx" ON "accounts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_business_idx" ON "inventory_movements" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "vouchers_business_idx" ON "vouchers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "signatures_business_idx" ON "signatures" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "templates_business_idx" ON "templates" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_invites_phone_idx" ON "staff_invites" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_type_idx" ON "analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "offers_active_idx" ON "offers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "items_name_idx" ON "items" USING btree ("name_lowercase");--> statement-breakpoint
CREATE INDEX "parties_name_idx" ON "parties" USING btree ("name_lowercase");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_idx" ON "inventory_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_created_idx" ON "inventory_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vouchers_date_idx" ON "vouchers" USING btree ("date");--> statement-breakpoint
ALTER TABLE "staff_invites" DROP COLUMN "ownerId";--> statement-breakpoint
ALTER TABLE "staff_invites" DROP COLUMN "organizationId";--> statement-breakpoint
ALTER TABLE "staff_invites" DROP COLUMN "phoneNumber";--> statement-breakpoint
ALTER TABLE "staff_invites" DROP COLUMN "permissions";--> statement-breakpoint
ALTER TABLE "staff_invites" DROP COLUMN "expiresAt";--> statement-breakpoint
ALTER TABLE "staff_invites" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "uid";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "ownerId";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phoneNumber";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "displayName";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "photoURL";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "businessName";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gstEnabled";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gstNumber";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionStatus";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionPlanId";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionPlanName";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionAmountMonthly";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionCurrency";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionStartsAt";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscriptionEndsAt";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "eventType";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "planId";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "offerId";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "bannerUrl";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "bannerBackground";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "ctaText";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "ctaRoute";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "isActive";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "startsAt";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "endsAt";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "planId";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "planName";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "checkoutUrl";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "providerReference";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "failureReason";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "monthlyPrice";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "isActive";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "displayOrder";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "features";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "organizationId";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "branchId";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "nameLowercase";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "purchasePrice";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "hsn";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "gstPercentage";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "minimumStock";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "openingStock";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "subcategory";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "imageUrl";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "expiresAt";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "autoDeleteAt";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "autoDeleteEnabled";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "isActive";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "organizationId";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "nameLowercase";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "gstNumber";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "isActive";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "branchId";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "parentId";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "isSystem";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "isActive";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "branchId";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "itemId";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "transactionId";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "movementType";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "balanceAfter";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "unitCost";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "branchId";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "voucherDate";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "bankAccountId";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "partyId";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "partyName";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "costCenter";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "projectCode";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "vouchers" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "organizationId";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "signatureData";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "signatureUrl";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "isDefault";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "createdByUid";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "signatures" DROP COLUMN "updatedAt";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "isDefault";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "thumbnailUrl";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "isActive";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "updatedAt";--> statement-breakpoint
DROP TYPE "public"."amount_type";--> statement-breakpoint
DROP TYPE "public"."asset_type";--> statement-breakpoint
DROP TYPE "public"."attendance_status";--> statement-breakpoint
DROP TYPE "public"."audience";--> statement-breakpoint
DROP TYPE "public"."bill_mode";--> statement-breakpoint
DROP TYPE "public"."invite_status";--> statement-breakpoint
DROP TYPE "public"."ledger_direction";--> statement-breakpoint
DROP TYPE "public"."ledger_source_type";--> statement-breakpoint
DROP TYPE "public"."movement_type";--> statement-breakpoint
DROP TYPE "public"."paper_size";--> statement-breakpoint
DROP TYPE "public"."payment_direction";--> statement-breakpoint
DROP TYPE "public"."payment_intent_status";--> statement-breakpoint
DROP TYPE "public"."payment_mode";--> statement-breakpoint
DROP TYPE "public"."payroll_category";--> statement-breakpoint
DROP TYPE "public"."period_status";--> statement-breakpoint
DROP TYPE "public"."printer_type";--> statement-breakpoint
DROP TYPE "public"."reconciliation_status";--> statement-breakpoint
DROP TYPE "public"."request_module";--> statement-breakpoint
DROP TYPE "public"."request_status";--> statement-breakpoint
DROP TYPE "public"."request_type";--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
DROP TYPE "public"."salary_run_status";--> statement-breakpoint
DROP TYPE "public"."settings_role";--> statement-breakpoint
DROP TYPE "public"."tax_type";--> statement-breakpoint
DROP TYPE "public"."template_type";--> statement-breakpoint
DROP TYPE "public"."transaction_type";--> statement-breakpoint
DROP TYPE "public"."voucher_status";