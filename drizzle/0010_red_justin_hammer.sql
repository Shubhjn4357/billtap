DROP TABLE "branch_transfers" CASCADE;--> statement-breakpoint
DROP TABLE "cost_centers" CASCADE;--> statement-breakpoint
DROP TABLE "fee_invoices" CASCADE;--> statement-breakpoint
DROP TABLE "fee_reminder_logs" CASCADE;--> statement-breakpoint
DROP TABLE "gst_notes" CASCADE;--> statement-breakpoint
DROP TABLE "institution_students" CASCADE;--> statement-breakpoint
DROP TABLE "message_logs" CASCADE;--> statement-breakpoint
DROP TABLE "projects" CASCADE;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "description" text;