import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';
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
const app = new Hono();
const apiRoutes = new Hono();
let cachedDatabaseUrl = null;
let cachedDb = null;
const getDbClient = (databaseUrl) => {
    if (cachedDb && cachedDatabaseUrl === databaseUrl) {
        return cachedDb;
    }
    const sql = neon(databaseUrl);
    cachedDb = drizzle(sql, { schema });
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
app.route('/api', apiRoutes);
app.route('/', apiRoutes);
app.notFound((c) => c.json({ ok: false, message: 'Route not found.' }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ ok: false, message: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
});
export default app;
