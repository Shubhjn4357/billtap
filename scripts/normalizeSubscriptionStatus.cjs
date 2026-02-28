#!/usr/bin/env node

require('dotenv').config();
const { Client } = require('pg');

const main = async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('[db:repair] DATABASE_URL is not set.');
        process.exit(1);
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
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
    } finally {
        await client.end();
    }
};

main().catch((error) => {
    console.error('[db:repair] failed:', error.message || error);
    process.exit(1);
});
