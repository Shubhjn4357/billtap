
import { ExecutionContext } from 'hono';
import app from './app';

import { logger } from 'hono/logger';
app.use(logger())

export default {
    fetch: app.fetch,
    scheduled: async (event: ScheduledEvent, env: any, ctx: ExecutionContext) => {
        const url = 'http://internal/api/jobs/run-all';
        const req = new Request(url, {
            method: 'POST',
            headers: {
                'X-Cron-Secret': env.CRON_SECRET || '',
                'Authorization': `Bearer ${env.CRON_SECRET || ''}`
            }
        });
        await app.fetch(req, env, ctx);
    }
};