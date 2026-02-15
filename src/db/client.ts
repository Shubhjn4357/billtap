import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

export { schema };

