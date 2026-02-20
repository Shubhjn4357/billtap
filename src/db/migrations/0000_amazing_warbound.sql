CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0,
	`isDefault` integer DEFAULT false,
	`isActive` integer DEFAULT true,
	`isSystem` integer DEFAULT false,
	`details` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`nameLowercase` text NOT NULL,
	`price` real NOT NULL,
	`purchasePrice` real DEFAULT 0,
	`mrp` real DEFAULT 0,
	`hsn` text,
	`gstPercentage` real DEFAULT 0,
	`stock` integer DEFAULT 0,
	`minimumStock` integer DEFAULT 0,
	`unit` text DEFAULT 'pcs',
	`category` text,
	`imageUrl` text,
	`barcode` text,
	`isActive` integer DEFAULT true,
	`updatedAt` text,
	`createdAt` text
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text,
	`name` text NOT NULL,
	`nameLowercase` text NOT NULL,
	`type` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`gstNumber` text,
	`isActive` integer DEFAULT true,
	`updatedAt` text,
	`createdAt` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'PENDING',
	`retryCount` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text,
	`accountId` text,
	`type` text NOT NULL,
	`partyId` text,
	`partyName` text,
	`billNumber` text,
	`billDate` text NOT NULL,
	`currency` text DEFAULT 'INR',
	`totalAmount` real NOT NULL,
	`discountAmount` real DEFAULT 0,
	`taxAmount` real DEFAULT 0,
	`paidAmount` real DEFAULT 0,
	`paymentMode` text DEFAULT 'CASH',
	`paymentStatus` text DEFAULT 'PAID',
	`billMode` text DEFAULT 'ESTIMATE',
	`dueDate` text,
	`remark` text,
	`deliveryAddress` text,
	`deliveryContactName` text,
	`deliveryContactPhone` text,
	`itemsSnapshot` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`uid` text PRIMARY KEY NOT NULL,
	`email` text,
	`displayName` text,
	`businessName` text,
	`address` text,
	`gstNumber` text,
	`currency` text DEFAULT 'INR',
	`role` text DEFAULT 'owner',
	`subscriptionStatus` text DEFAULT 'inactive',
	`createdAt` text,
	`updatedAt` text
);
