import { pgEnum } from 'drizzle-orm/pg-core';

// Auth & Users
export const roleEnum = pgEnum('role', ['owner', 'staff', 'admin']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'rejected']);

// Subscriptions
export const subscriptionStatusEnum = pgEnum('subscription_status', ['inactive', 'active', 'past_due', 'canceled']);

// Organizations & Settings
export const settingsRoleEnum = pgEnum('settings_role', ['owner', 'manager', 'salesman']);
export const printerTypeEnum = pgEnum('printer_type', ['THERMAL', 'STANDARD']);
export const paperSizeEnum = pgEnum('paper_size', ['2INCH', '3INCH', 'A4', 'A5']);

// Accounting & Finance
export const accountTypeEnum = pgEnum('account_type', ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
export const voucherTypeEnum = pgEnum('voucher_type', ['RECEIPT', 'PAYMENT']);
export const voucherStatusEnum = pgEnum('voucher_status', ['posted', 'draft', 'cancelled']);
export const ledgerDirectionEnum = pgEnum('ledger_direction', ['DEBIT', 'CREDIT']);
export const reconciliationStatusEnum = pgEnum('reconciliation_status', ['draft', 'matched', 'mismatched']);
export const ledgerSourceTypeEnum = pgEnum('ledger_source_type', ['BILL', 'PAYMENT', 'RETURN', 'ADJUSTMENT']);
export const paymentDirectionEnum = pgEnum('payment_direction', ['IN', 'OUT']);

// Inventory & Billing
export const movementTypeEnum = pgEnum('movement_type', ['IN', 'OUT', 'ADJUST']);
export const partyTypeEnum = pgEnum('party_type', ['customer', 'supplier']);
export const transactionTypeEnum = pgEnum('transaction_type', ['SALE', 'PURCHASE', 'RETURN_INWARD', 'RETURN_OUTWARD']);
export const paymentStatusEnum = pgEnum('payment_status', ['PAID', 'PARTIAL', 'PENDING']);
export const billModeEnum = pgEnum('bill_mode', ['GST', 'ESTIMATE']);
export const paymentModeEnum = pgEnum('payment_mode', ['CASH', 'BANK', 'UPI', 'CARD', 'CREDIT']);

// Operations & Approvals
export const requestModuleEnum = pgEnum('request_module', ['inventory', 'billing', 'accounting', 'admin']);
export const requestTypeEnum = pgEnum('request_type', ['JOURNAL_ENTRY', 'STOCK_ADJUSTMENT']);
export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'rejected']);
export const periodStatusEnum = pgEnum('period_status', ['open', 'locked', 'closed']);
export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'half-day', 'leave']);
export const payrollCategoryEnum = pgEnum('payroll_category', ['earning', 'deduction', 'statutory']);
export const amountTypeEnum = pgEnum('amount_type', ['fixed', 'percent']);
export const salaryRunStatusEnum = pgEnum('salary_run_status', ['draft', 'finalized']);

// Media & Templates
export const templateTypeEnum = pgEnum('template_type', ['invoice', 'card', 'email']);
export const assetTypeEnum = pgEnum('asset_type', ['PRODUCT_IMAGE', 'PROFILE_IMAGE', 'BILL_ATTACHMENT', 'OTHER']);
export const audienceEnum = pgEnum('audience', ['all', 'owners', 'staff']);
export const paymentIntentStatusEnum = pgEnum('payment_intent_status', ['pending', 'succeeded', 'failed', 'canceled']);
