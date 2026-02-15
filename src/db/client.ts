import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

export { schema };

