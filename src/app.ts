import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './db/schema';
import type { AppEnv } from './middleware/auth';
import type { DrizzleClient } from './db/client';
import authRoute from './routes/auth';
import itemsRoute from './routes/items';
import partiesRoute from './routes/parties';
import transactionsRoute from './routes/transactions';
import adminRoute from './routes/admin';
import staffRoute from './routes/staff';
import subscriptionRoute from './routes/subscription';
import reportingRoute from './routes/reporting';
import analyticsRoute from './routes/analytics';
import jobsRoute from './routes/jobs';
import usersRoute from './routes/users';
import accountingRoute from './routes/accounting';
import operationsRoute from './routes/operations';
import payrollRoute from './routes/payroll';
import gstComplianceRoute from './routes/gstCompliance';
import treasuryRoute from './routes/treasury';
import enterpriseRoute from './routes/enterprise';
import organizationsRoute from './routes/organizations';
import financeOpsRoute from './routes/financeOps';
import institutionRoute from './routes/institution';
import communicationsRoute from './routes/communications';
import mediaRoute from './routes/media';

const app = new Hono<AppEnv>();
const apiRoutes = new Hono<AppEnv>();

let cachedDatabaseUrl: string | null = null;
let cachedDb: DrizzleClient | null = null;
let cachedPool: Pool | null = null;

const getDbClient = (databaseUrl: string): DrizzleClient => {
    if (cachedDb && cachedDatabaseUrl === databaseUrl) {
        return cachedDb;
    }

    // Close previous pool if it exists and URL changed (rare in serverless but good practice)
    if (cachedPool && cachedDatabaseUrl !== databaseUrl) {
        // In serverless, we might not want to await this or it might cause overhead, but it's cleaner.
        // cachedPool.end(); 
    }

    const pool = new Pool({ connectionString: databaseUrl });
    cachedPool = pool;
    cachedDb = drizzle(pool, { schema }) as unknown as DrizzleClient;
    cachedDatabaseUrl = databaseUrl;
    return cachedDb;
};

app.use('*', async (c, next) => {
    const origins = c.env.CORS_ORIGINS?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];
    const corsMiddleware = cors({
        origin: origins.length > 0 ? origins : '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret', 'X-Webhook-Secret'],
    });
    return corsMiddleware(c, next);
});

app.get('/', (c) => c.json({ ok: true, service: 'billtap-api', now: new Date().toISOString() }));

// Database Middleware for all API business routes.
apiRoutes.use(async (c, next) => {
    if (c.req.path === '/' || c.req.path === '/api' || c.req.path === '/api/') {
        await next();
        return;
    }

    if (!c.env.DATABASE_URL) {
        return c.json({ ok: false, message: 'Database configuration missing.' }, 500);
    }

    c.set('db', getDbClient(c.env.DATABASE_URL));
    await next();
});

// Mount routes on both `/` and `/api` so clients using either base path work.
apiRoutes.route('/auth', authRoute);
apiRoutes.route('/items', itemsRoute);
apiRoutes.route('/parties', partiesRoute);
apiRoutes.route('/transactions', transactionsRoute); // formerly bills
apiRoutes.route('/staff', staffRoute);
apiRoutes.route('/subscription', subscriptionRoute);
apiRoutes.route('/reporting', reportingRoute);
apiRoutes.route('/analytics', analyticsRoute);
apiRoutes.route('/jobs', jobsRoute);
apiRoutes.route('/users', usersRoute);
apiRoutes.route('/admin', adminRoute);
apiRoutes.route('/accounting', accountingRoute);
apiRoutes.route('/operations', operationsRoute);
apiRoutes.route('/payroll', payrollRoute);
apiRoutes.route('/gst-compliance', gstComplianceRoute);
apiRoutes.route('/treasury', treasuryRoute);
apiRoutes.route('/enterprise', enterpriseRoute);
apiRoutes.route('/organizations', organizationsRoute);
apiRoutes.route('/finance', financeOpsRoute);
apiRoutes.route('/institution', institutionRoute);
apiRoutes.route('/communications', communicationsRoute);
apiRoutes.route('/media', mediaRoute);
app.route('/api', apiRoutes);
app.route('/', apiRoutes);

app.notFound((c) => c.json({ ok: false, message: 'Route not found.' }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ ok: false, message: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
});

export default app;
