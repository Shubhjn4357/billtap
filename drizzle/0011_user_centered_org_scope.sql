DO $$ BEGIN
    CREATE TYPE "settings_role" AS ENUM ('owner', 'manager', 'salesman');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
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
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "organizationId" text NOT NULL,
    "role" "settings_role" DEFAULT 'salesman' NOT NULL,
    "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "invitedBy" text,
    "phoneNumberSnapshot" text,
    "joinedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_settings" (
    "organizationId" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_categories" (
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
ALTER TABLE "staff_invites" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "party_ledger_entries" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "payment_entries" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "bill_templates" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "print_profiles" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "organizationId" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_user_idx" ON "organizations" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_code_idx" ON "organizations" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_active_idx" ON "organizations" ("isActive");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_user_idx" ON "organization_members" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_org_idx" ON "organization_members" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_role_idx" ON "organization_members" ("role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_active_idx" ON "organization_members" ("isActive");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_settings_user_idx" ON "organization_settings" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_categories_org_idx" ON "organization_categories" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_categories_user_idx" ON "organization_categories" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_categories_name_idx" ON "organization_categories" ("organizationId", "name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_org_idx" ON "items" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parties_org_idx" ON "parties" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_idx" ON "transactions" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_org_bill_number_idx" ON "transactions" ("organizationId", "billNumber");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_ledger_entries_org_idx" ON "party_ledger_entries" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_entries_org_idx" ON "payment_entries" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_org_idx" ON "expenses" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_templates_org_idx" ON "bill_templates" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_profiles_org_idx" ON "print_profiles" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signatures_org_idx" ON "signatures" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_org_idx" ON "media_assets" ("organizationId");
--> statement-breakpoint
UPDATE "staff_invites"
SET "organizationId" = "ownerId"
WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "items" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "parties" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "transactions" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "party_ledger_entries" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "payment_entries" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "expenses" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "bill_templates" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "print_profiles" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "signatures" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
UPDATE "media_assets" SET "organizationId" = "userId" WHERE "organizationId" IS NULL;
--> statement-breakpoint
INSERT INTO "organizations" (
    "id",
    "userId",
    "name",
    "code",
    "currency",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "uid",
    "uid",
    COALESCE(NULLIF("businessName", ''), 'Default Organization'),
    LEFT(REGEXP_REPLACE(COALESCE(NULLIF("businessName", ''), 'ORG_' || "uid"), '[^A-Za-z0-9]+', '_', 'g'), 32),
    COALESCE("currency", 'INR'),
    true,
    now(),
    now()
FROM "users"
WHERE "role" IN ('owner', 'admin')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "organization_settings" (
    "organizationId",
    "userId",
    "settings",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    '{}'::jsonb,
    now(),
    now()
FROM "organizations"
ON CONFLICT ("organizationId") DO NOTHING;
--> statement-breakpoint
INSERT INTO "organization_members" (
    "id",
    "userId",
    "organizationId",
    "role",
    "permissions",
    "isActive",
    "invitedBy",
    "phoneNumberSnapshot",
    "joinedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'mbr_' || "uid" || '_' || "uid",
    "uid",
    "uid",
    'owner'::"settings_role",
    '{}'::jsonb,
    true,
    "uid",
    "phoneNumber",
    now(),
    now(),
    now()
FROM "users"
WHERE "role" IN ('owner', 'admin')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "organization_members" (
    "id",
    "userId",
    "organizationId",
    "role",
    "permissions",
    "isActive",
    "invitedBy",
    "phoneNumberSnapshot",
    "joinedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'mbr_' || u."uid" || '_' || u."ownerId",
    u."uid",
    u."ownerId",
    'salesman'::"settings_role",
    '{}'::jsonb,
    true,
    u."ownerId",
    u."phoneNumber",
    now(),
    now(),
    now()
FROM "users" u
WHERE u."role" = 'staff' AND u."ownerId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
