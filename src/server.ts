import { serve } from '@hono/node-server';
import app from './app.js';
import * as dotenv from 'dotenv'
import { logger } from 'hono/logger';
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}
const port = Number(process.env.PORT || 3000);
app.use(logger())
console.log(`🚀 Server starting on ${port}`);

serve({
    fetch: app.fetch,
    port,
});
