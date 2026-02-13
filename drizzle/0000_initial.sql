CREATE TABLE IF NOT EXISTS users (
  "uid" text PRIMARY KEY,
  "email" text,
  "phoneNumber" text,
  "displayName" text,
  "photoURL" text,
  "businessName" text,
  "address" text,
  "gstEnabled" boolean DEFAULT false,
  "gstNumber" text,
  "currency" text DEFAULT 'INR',
  "role" text DEFAULT 'owner',
  "subscriptionStatus" text DEFAULT 'inactive',
  "subscriptionPlanId" text,
  "subscriptionPlanName" text,
  "subscriptionAmountMonthly" double precision,
  "subscriptionCurrency" text,
  "subscriptionStartsAt" timestamptz,
  "subscriptionEndsAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users ("role");
CREATE INDEX IF NOT EXISTS users_subscription_status_idx ON users ("subscriptionStatus");

CREATE TABLE IF NOT EXISTS phone_verifications (
  "id" text PRIMARY KEY,
  "phoneNumber" text NOT NULL,
  "code" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "consumedAt" timestamptz,
  "attempts" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_verifications_phone_idx ON phone_verifications ("phoneNumber");

CREATE TABLE IF NOT EXISTS plans (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "monthlyPrice" double precision NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "isActive" boolean NOT NULL DEFAULT true,
  "displayOrder" integer NOT NULL DEFAULT 0,
  "features" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plans_active_idx ON plans ("isActive");

CREATE TABLE IF NOT EXISTS offers (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "bannerUrl" text,
  "bannerBackground" text,
  "ctaText" text,
  "ctaRoute" text,
  "audience" text NOT NULL DEFAULT 'all',
  "isActive" boolean NOT NULL DEFAULT true,
  "priority" integer NOT NULL DEFAULT 0,
  "startsAt" timestamptz,
  "endsAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_active_idx ON offers ("isActive");
CREATE INDEX IF NOT EXISTS offers_priority_idx ON offers ("priority");

CREATE TABLE IF NOT EXISTS items (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "nameLowercase" text NOT NULL,
  "price" double precision NOT NULL,
  "stock" integer NOT NULL DEFAULT 0,
  "category" text,
  "barcode" text,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_user_idx ON items ("userId");
CREATE INDEX IF NOT EXISTS items_name_idx ON items ("nameLowercase");
CREATE INDEX IF NOT EXISTS items_barcode_idx ON items ("barcode");

CREATE TABLE IF NOT EXISTS orders (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "customerName" text,
  "customerPhone" text,
  "businessName" text,
  "businessAddress" text,
  "gstNumber" text,
  "currency" text DEFAULT 'INR',
  "items" jsonb NOT NULL,
  "total" double precision NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS analytics_events (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "eventType" text NOT NULL,
  "source" text,
  "planId" text,
  "offerId" text,
  "value" double precision,
  "currency" text,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events ("createdAt");
CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events ("eventType");

CREATE TABLE IF NOT EXISTS payment_intents (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "planId" text NOT NULL,
  "planName" text NOT NULL,
  "amount" double precision NOT NULL,
  "currency" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'mock',
  "status" text NOT NULL DEFAULT 'pending',
  "checkoutUrl" text,
  "providerReference" text,
  "failureReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_intents_user_idx ON payment_intents ("userId");
CREATE INDEX IF NOT EXISTS payment_intents_status_idx ON payment_intents ("status");
