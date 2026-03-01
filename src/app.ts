import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './db/schema';
import type { AppEnv } from './middleware/auth';
import type { DrizzleClient } from './db/client';
import authRoute from './routes/auth';
import usersRoute from './routes/users';
import itemsRoute from './routes/items';
import partiesRoute from './routes/parties';
import transactionsRoute from './routes/transactions';
import subscriptionRoute from './routes/subscription';
import reportingRoute from './routes/reporting';
import accountingRoute from './routes/accounting';
import analyticsRoute from './routes/analytics';
import adminRoute from './routes/admin';
import organizationsRoute from './routes/organizations';
import staffRoute from './routes/staff';
import operationsRoute from './routes/operations';
import expensesRoute from './routes/expenses';
import posRoute from './routes/pos';
import loansRoute from './routes/loans';
import godownsRoute from './routes/godowns';
import cashBankRoute from './routes/cashBank';
import businessSettingsRoute from './routes/businessSettings';

const app = new Hono<AppEnv>();
const apiRoutes = new Hono<AppEnv>();

const getDbClient = (databaseUrl: string): DrizzleClient => {
    const pool = new Pool({ connectionString: databaseUrl });
    return drizzle(pool, { schema }) as unknown as DrizzleClient;
};

app.use('*', async (c, next) => {
    const configuredOrigins = c.env.CORS_ORIGINS?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];
    const localhostOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

    const corsMiddleware = cors({
        origin: (origin) => {
            if (!origin) return '*';
            if (configuredOrigins.length === 0 || configuredOrigins.includes('*')) return '*';
            if (configuredOrigins.includes(origin) || localhostOriginPattern.test(origin)) {
                return origin;
            }
            return null;
        },
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: [
            'Content-Type',
            'Authorization',
            'X-Organization-Id',
            'x-organization-id',
            'X-Requested-With',
        ],
    });
    return corsMiddleware(c, next);
});

app.get('/', (c) => c.json({ ok: true, service: 'vahi-api', now: new Date().toISOString() }));
app.get('/health', (c) => c.json({ ok: true, service: 'vahi-api', now: new Date().toISOString() }));

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

apiRoutes.get('/health', (c) => c.json({ ok: true, service: 'vahi-api', now: new Date().toISOString() }));

// Core auth & user routes
apiRoutes.route('/auth', authRoute);
apiRoutes.route('/users', usersRoute);
apiRoutes.route('/organizations', organizationsRoute);

// Billing & transactions
apiRoutes.route('/items', itemsRoute);
apiRoutes.route('/parties', partiesRoute);
apiRoutes.route('/transactions', transactionsRoute);
apiRoutes.route('/pos', posRoute);

// Accounting & finance
apiRoutes.route('/accounting', accountingRoute);
apiRoutes.route('/cash-bank', cashBankRoute);
apiRoutes.route('/expenses', expensesRoute);
apiRoutes.route('/loans', loansRoute);

// Inventory & godowns
apiRoutes.route('/godowns', godownsRoute);

// Subscription & settings
apiRoutes.route('/subscription', subscriptionRoute);
apiRoutes.route('/settings', businessSettingsRoute);

// Reporting & analytics
apiRoutes.route('/reporting', reportingRoute);
apiRoutes.route('/analytics', analyticsRoute);

// Staff & operations
apiRoutes.route('/staff', staffRoute);
apiRoutes.route('/operations', operationsRoute);

// Admin
apiRoutes.route('/admin', adminRoute);

app.route('/api', apiRoutes);
app.route('/', apiRoutes);

app.notFound((c) => c.json({ ok: false, message: 'Route not found.' }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ ok: false, message: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
});

export default app;
