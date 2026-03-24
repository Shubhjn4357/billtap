import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

export const createDbClient = (databaseUrl: string) => {
    const pool = new Pool({ connectionString: databaseUrl });
    return drizzle(pool, { schema });
};

export type DrizzleClient = ReturnType<typeof createDbClient>;

export { schema };

