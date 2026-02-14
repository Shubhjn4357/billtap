import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import * as dotenv from "dotenv"

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

export { schema };

