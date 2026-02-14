import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import * as dotenv from "dotenv"

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const databaseUrl = process.env.DATABASE_URL || '';
console.log({ databaseUrl });
if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Neon database connection.');
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });
export const runtime = 'edge';