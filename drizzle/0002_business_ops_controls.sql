ALTER TABLE "items"
    ADD COLUMN IF NOT EXISTS "expiresAt" timestamptz,
    ADD COLUMN IF NOT EXISTS "autoDeleteAt" timestamptz,
    ADD COLUMN IF NOT EXISTS "autoDeleteEnabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "paidAmount" double precision DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "paymentMode" text DEFAULT 'CASH' NOT NULL,
    ADD COLUMN IF NOT EXISTS "paymentStatus" text DEFAULT 'PAID' NOT NULL,
    ADD COLUMN IF NOT EXISTS "dueDate" timestamptz,
    ADD COLUMN IF NOT EXISTS "reminderEnabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "reminderFrequencyDays" integer DEFAULT 3 NOT NULL,
    ADD COLUMN IF NOT EXISTS "nextReminderAt" timestamptz,
    ADD COLUMN IF NOT EXISTS "lastReminderAt" timestamptz;

CREATE INDEX IF NOT EXISTS "items_expires_at_idx" ON "items" ("expiresAt");
CREATE INDEX IF NOT EXISTS "items_auto_delete_at_idx" ON "items" ("autoDeleteAt");
CREATE INDEX IF NOT EXISTS "transactions_due_date_idx" ON "transactions" ("dueDate");
CREATE INDEX IF NOT EXISTS "transactions_payment_status_idx" ON "transactions" ("paymentStatus");
CREATE INDEX IF NOT EXISTS "transactions_next_reminder_idx" ON "transactions" ("nextReminderAt");
