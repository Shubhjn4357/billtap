import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { ExecutionContext } from 'hono';
import apiApp from './app';
import siteRoute from './routes/site';
import type { AppEnv } from './middleware/auth';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.route('/', siteRoute);
app.get('/api/', (c) => c.redirect('/api', 307));
app.route('/api', apiApp);

export default {
    fetch: app.fetch,
    scheduled: async (_event: ScheduledEvent, _env: AppEnv['Bindings'], _ctx: ExecutionContext) => {
        // Reserved for future scheduled jobs.
    },
};
