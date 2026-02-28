#!/usr/bin/env node

require('dotenv').config();
const { Client } = require('pg');

const CANONICAL_ENUM_VALUES = {
    subscription_tier: ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'],
    billing_cycle: ['MONTHLY', 'YEARLY', 'THREE_YEAR'],
    subscription_status: ['ACTIVE', 'EXPIRED', 'TRIAL', 'CANCELLED', 'GRACE'],
    feature_flag: [
        'OFFLINE_BILLING',
        'GST_INVOICES',
        'PURCHASE_MODULE',
        'STOCK_MODULE',
        'PARTY_MANAGEMENT',
        'GST_REPORTS',
        'ADVANCED_REPORTS',
        'E_INVOICE',
        'E_WAY_BILL',
        'MULTI_BUSINESS',
        'STAFF_USERS',
        'CLOUD_SYNC',
        'MULTI_DEVICE',
        'BACKUP_CLOUD',
        'EXPORT_PDF',
        'EXPORT_EXCEL',
        'ACCESS_WEB_DASHBOARD',
        'API_ACCESS',
        'BATCH_EXPIRY',
        'MULTI_GODOWN',
    ],
    account_type: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'],
    voucher_type: [
        'SALES_INVOICE',
        'PURCHASE_INVOICE',
        'PAYMENT',
        'RECEIPT',
        'CONTRA',
        'JOURNAL',
        'CREDIT_NOTE',
        'DEBIT_NOTE',
    ],
    party_type: ['CUSTOMER', 'SUPPLIER'],
    invoice_type: [
        'TAX_INVOICE',
        'BILL_OF_SUPPLY',
        'ESTIMATE',
        'PROFORMA',
        'CREDIT_NOTE_DOC',
        'DEBIT_NOTE_DOC',
        'DELIVERY_CHALLAN',
    ],
    payment_status: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'],
    device_platform: ['ANDROID', 'IOS', 'WEB'],
    plan_limit_type: ['MAX_BILLS', 'MAX_STAFF_USERS', 'MAX_BUSINESSES', 'MAX_DEVICES', 'MAX_STORAGE_MB'],
    discount_type: ['PERCENTAGE', 'FIXED_AMOUNT'],
    discount_scope: ['PLAN', 'TIER', 'GLOBAL'],
    notification_channel: ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'],
    admin_role: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'READ_ONLY_ADMIN'],
    member_role: ['OWNER', 'STAFF'],
};

const escapeLiteral = (value) => value.replace(/'/g, "''");

const ensureCanonicalEnumValues = async (client) => {
    const enumNames = Object.keys(CANONICAL_ENUM_VALUES);
    const enumRows = await client.query(
        `
            SELECT t.typname AS enum_name, e.enumlabel AS enum_label
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typname = ANY($1::text[])
            ORDER BY t.typname, e.enumsortorder
        `,
        [enumNames]
    );

    const existingByEnum = new Map();
    for (const row of enumRows.rows) {
        const enumName = row.enum_name;
        const labels = existingByEnum.get(enumName) ?? new Set();
        labels.add(row.enum_label);
        existingByEnum.set(enumName, labels);
    }

    for (const [enumName, expectedValues] of Object.entries(CANONICAL_ENUM_VALUES)) {
        const existingLabels = existingByEnum.get(enumName);
        if (!existingLabels) {
            continue;
        }

        const addedValues = [];
        for (const value of expectedValues) {
            if (existingLabels.has(value)) {
                continue;
            }

            await client.query(
                `ALTER TYPE "public"."${enumName}" ADD VALUE IF NOT EXISTS '${escapeLiteral(value)}'`
            );
            existingLabels.add(value);
            addedValues.push(value);
        }

        if (addedValues.length > 0) {
            console.log(`[db:repair] added enum values for ${enumName}: ${addedValues.join(', ')}`);
        }
    }
};

const normalizeLegacyUserSubscriptionStatus = async (client) => {
    const columnExistsResult = await client.query(
        `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND column_name = 'subscriptionStatus'
            ) AS "exists"
        `
    );

    const columnExists = Boolean(columnExistsResult.rows?.[0]?.exists);
    if (!columnExists) {
        console.log('[db:repair] users.subscriptionStatus not found. Skipping normalization.');
        return;
    }

    const updateResult = await client.query(
        `
            UPDATE "users"
            SET "subscriptionStatus" = 'inactive'
            WHERE "subscriptionStatus"::text = 'expired'
        `
    );

    console.log(`[db:repair] normalized expired subscription statuses: ${updateResult.rowCount ?? 0}`);
};

const main = async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('[db:repair] DATABASE_URL is not set.');
        process.exit(1);
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        await ensureCanonicalEnumValues(client);
        await normalizeLegacyUserSubscriptionStatus(client);
    } finally {
        await client.end();
    }
};

main().catch((error) => {
    console.error('[db:repair] failed:', error.message || error);
    process.exit(1);
});
