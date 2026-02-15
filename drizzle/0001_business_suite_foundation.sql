-- Business suite foundation migration
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards)

-- users table drift fixes
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ownerId" text;
CREATE INDEX IF NOT EXISTS "users_owner_idx" ON "users" ("ownerId");

-- items table drift fixes
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "purchasePrice" double precision DEFAULT 0;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "mrp" double precision DEFAULT 0;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "hsn" text;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "gstPercentage" double precision DEFAULT 0;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "minimumStock" integer DEFAULT 0;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "openingStock" integer DEFAULT 0;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'pcs';
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "subcategory" text;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "location" text;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true;
CREATE INDEX IF NOT EXISTS "items_category_idx" ON "items" ("category");

-- parties
CREATE TABLE IF NOT EXISTS "parties" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
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
CREATE INDEX IF NOT EXISTS "parties_user_idx" ON "parties" ("userId");
CREATE INDEX IF NOT EXISTS "parties_name_idx" ON "parties" ("nameLowercase");
CREATE INDEX IF NOT EXISTS "parties_type_idx" ON "parties" ("type");

-- transactions
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
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
    "totalAmount" double precision NOT NULL,
    "discountAmount" double precision DEFAULT 0,
    "taxAmount" double precision DEFAULT 0,
    "items" jsonb NOT NULL,
    "remark" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "transactions_user_idx" ON "transactions" ("userId");
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions" ("type");
CREATE INDEX IF NOT EXISTS "transactions_created_idx" ON "transactions" ("createdAt");
CREATE INDEX IF NOT EXISTS "transactions_party_idx" ON "transactions" ("partyId");

-- migrate legacy orders to SALE transactions where possible
DO $$
BEGIN
    IF to_regclass('orders') IS NOT NULL THEN
        INSERT INTO "transactions" (
            "id", "userId", "type", "partyName", "partyPhone",
            "billNumber", "billDate",
            "businessName", "businessAddress", "gstNumber",
            "currency", "totalAmount", "discountAmount", "taxAmount",
            "items", "createdAt", "updatedAt"
        )
        SELECT
            o."id",
            o."userId",
            'SALE',
            o."customerName",
            o."customerPhone",
            o."id",
            o."createdAt",
            o."businessName",
            o."businessAddress",
            o."gstNumber",
            COALESCE(o."currency", 'INR'),
            o."total",
            0,
            0,
            o."items",
            o."createdAt",
            o."createdAt"
        FROM "orders" o
        WHERE NOT EXISTS (
            SELECT 1 FROM "transactions" t WHERE t."id" = o."id"
        );
    END IF;
END $$;

-- staff invites
CREATE TABLE IF NOT EXISTS "staff_invites" (
    "id" text PRIMARY KEY NOT NULL,
    "ownerId" text NOT NULL,
    "phoneNumber" text NOT NULL,
    "role" text DEFAULT 'staff',
    "status" text DEFAULT 'pending',
    "code" text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "staff_invites_owner_idx" ON "staff_invites" ("ownerId");
CREATE INDEX IF NOT EXISTS "staff_invites_phone_idx" ON "staff_invites" ("phoneNumber");

-- chart of accounts
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "type" text NOT NULL,
    "parentId" text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" ("userId");
CREATE INDEX IF NOT EXISTS "accounts_code_idx" ON "accounts" ("code");
CREATE INDEX IF NOT EXISTS "accounts_type_idx" ON "accounts" ("type");

-- journal headers
CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "entryDate" timestamp with time zone DEFAULT now() NOT NULL,
    "batchNumber" text,
    "referenceType" text,
    "referenceId" text,
    "narration" text,
    "currency" text DEFAULT 'INR' NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "journal_entries_user_idx" ON "journal_entries" ("userId");
CREATE INDEX IF NOT EXISTS "journal_entries_date_idx" ON "journal_entries" ("entryDate");
CREATE INDEX IF NOT EXISTS "journal_entries_ref_idx" ON "journal_entries" ("referenceType", "referenceId");

-- journal lines
CREATE TABLE IF NOT EXISTS "journal_lines" (
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
CREATE INDEX IF NOT EXISTS "journal_lines_user_idx" ON "journal_lines" ("userId");
CREATE INDEX IF NOT EXISTS "journal_lines_entry_idx" ON "journal_lines" ("entryId");
CREATE INDEX IF NOT EXISTS "journal_lines_account_idx" ON "journal_lines" ("accountId");

-- inventory movement ledger
CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "itemId" text NOT NULL,
    "transactionId" text,
    "movementType" text NOT NULL,
    "quantity" double precision NOT NULL,
    "balanceAfter" double precision,
    "unitCost" double precision,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "inventory_movements_user_idx" ON "inventory_movements" ("userId");
CREATE INDEX IF NOT EXISTS "inventory_movements_item_idx" ON "inventory_movements" ("itemId");
CREATE INDEX IF NOT EXISTS "inventory_movements_txn_idx" ON "inventory_movements" ("transactionId");
CREATE INDEX IF NOT EXISTS "inventory_movements_created_idx" ON "inventory_movements" ("createdAt");
