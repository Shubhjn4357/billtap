CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"eventType" text NOT NULL,
	"source" text,
	"planId" text,
	"offerId" text,
	"value" double precision,
	"currency" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"nameLowercase" text NOT NULL,
	"price" double precision NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"category" text,
	"barcode" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"bannerUrl" text,
	"bannerBackground" text,
	"ctaText" text,
	"ctaRoute" text,
	"audience" text DEFAULT 'all' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"customerName" text,
	"customerPhone" text,
	"businessName" text,
	"businessAddress" text,
	"gstNumber" text,
	"currency" text DEFAULT 'INR',
	"items" jsonb NOT NULL,
	"total" double precision NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"planId" text NOT NULL,
	"planName" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" text NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"checkoutUrl" text,
	"providerReference" text,
	"failureReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"phoneNumber" text NOT NULL,
	"code" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"monthlyPrice" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"uid" text PRIMARY KEY NOT NULL,
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
	"subscriptionStartsAt" timestamp with time zone,
	"subscriptionEndsAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "analytics_events_type_idx" ON "analytics_events" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "items_user_idx" ON "items" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "items_name_idx" ON "items" USING btree ("nameLowercase");--> statement-breakpoint
CREATE INDEX "items_barcode_idx" ON "items" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "offers_active_idx" ON "offers" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "offers_priority_idx" ON "offers" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "payment_intents_user_idx" ON "payment_intents" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "phone_verifications_phone_idx" ON "phone_verifications" USING btree ("phoneNumber");--> statement-breakpoint
CREATE INDEX "plans_active_idx" ON "plans" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_subscription_status_idx" ON "users" USING btree ("subscriptionStatus");