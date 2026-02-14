import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    try {
        console.log('Testing connection...');
        // Simple query
        const result = await db.execute(sql`SELECT 1`);
        console.log('Connection successful:', result);

        console.log('Checking "plans" table...');
        const plansCount = await db.select({ count: sql<number>`count(*)` }).from(schema.plans);
        console.log('Plans count:', plansCount);
    } catch (e) {
        console.error('Database Connection Failed:', e);
    }
}

main();
