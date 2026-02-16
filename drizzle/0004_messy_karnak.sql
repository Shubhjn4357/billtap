ALTER TABLE "items" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
CREATE INDEX "items_org_idx" ON "items" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "items_org_branch_idx" ON "items" USING btree ("organizationId","branchId");