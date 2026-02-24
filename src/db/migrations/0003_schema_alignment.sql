ALTER TABLE `items` ADD `branchId` text;
--> statement-breakpoint
ALTER TABLE `items` ADD `openingStock` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `items` ADD `subcategory` text;
--> statement-breakpoint
ALTER TABLE `items` ADD `location` text;
--> statement-breakpoint
ALTER TABLE `items` ADD `expiresAt` text;
--> statement-breakpoint
ALTER TABLE `items` ADD `autoDeleteAt` text;
--> statement-breakpoint
ALTER TABLE `items` ADD `autoDeleteEnabled` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `branchId` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `partyPhone` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `businessName` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `businessAddress` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `gstNumber` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `costCenter` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `projectCode` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `affectsGst` integer DEFAULT true;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `createdByUid` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `reminderEnabled` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `reminderFrequencyDays` integer DEFAULT 3;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `nextReminderAt` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `lastReminderAt` text;
