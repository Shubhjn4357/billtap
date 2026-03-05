import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export const createDbClient = (databaseUrl: string) => {
    const sql = neon(databaseUrl);
    return drizzle(sql, { schema });
};

export type DrizzleClient = ReturnType<typeof createDbClient>;

export { schema };

