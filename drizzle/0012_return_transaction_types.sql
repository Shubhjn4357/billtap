DO $$ BEGIN
    ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'RETURN_INWARD';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'RETURN_OUTWARD';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
