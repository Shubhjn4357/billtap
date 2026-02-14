import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import { and, asc, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { verifyGoogleIdentityToken } from './auth/google';
import { signSessionToken, verifySessionToken } from './auth/tokens';
import { DEFAULT_SERVER_PLANS } from './constants/defaultPlans';
import { type DrizzleClient, schema } from './db/client';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Schema imports
const { analyticsEvents, items, offers, orders, paymentIntents, phoneVerifications, plans, users } = schema;
type UserRow = typeof users.$inferSelect;

type Bindings = {
    DATABASE_URL: string;
    CRON_SECRET?: string;
};

type AppVariables = {
    authUser: UserRow | null;
    db: DrizzleClient;
};

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>().basePath('/api');

app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret', 'X-Webhook-Secret'],
}));

// Database middleware
app.use(async (c, next) => {
    if (!c.env.DATABASE_URL) {
        return c.json({ ok: false, message: 'Database configuration missing.' }, 500);
    }
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    c.set('db', db);
    await next();
});

const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

const parseDate = (value: string | undefined): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const asErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Something went wrong.';
};

const getBearerToken = (authHeader: string | undefined) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim() || null;
};

const normalizePhoneNumber = (raw: string) => {
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return '';
    return digits.startsWith('+') ? digits : `+${digits}`;
};

const toUserProfile = (row: UserRow) => ({
    uid: row.uid,
    email: row.email,
    phoneNumber: row.phoneNumber,
    displayName: row.displayName,
    photoURL: row.photoURL,
    businessName: row.businessName,
    address: row.address,
    gstEnabled: row.gstEnabled ?? false,
    gstNumber: row.gstNumber,
    currency: row.currency ?? 'INR',
    role: row.role ?? 'owner',
    subscriptionStatus: row.subscriptionStatus ?? 'inactive',
    subscriptionPlanId: row.subscriptionPlanId,
    subscriptionPlanName: row.subscriptionPlanName,
    subscriptionAmountMonthly: row.subscriptionAmountMonthly,
    subscriptionCurrency: row.subscriptionCurrency,
    subscriptionStartsAt: row.subscriptionStartsAt,
    subscriptionEndsAt: row.subscriptionEndsAt,
});

const getAuthUserFromRequest = async (authorizationHeader: string | undefined, db: DrizzleClient) => {
    const token = getBearerToken(authorizationHeader);
    if (!token) return null;

    const payload = verifySessionToken(token);
    if (!payload) return null;

    const entry = await db.select().from(users).where(eq(users.uid, payload.uid)).limit(1);
    return entry[0] ?? null;
};

const optionalAuth = async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db);
    c.set('authUser', authUser ?? null);
    await next();
};

const requireAuth = async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    c.set('authUser', authUser);
    await next();
};

const requireAdmin = async (c: Context<{ Bindings: Bindings; Variables: AppVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    if (authUser.role !== 'admin') {
        return c.json({ ok: false, message: 'Admin access required.' }, 403);
    }

    c.set('authUser', authUser);
    await next();
};

const ensurePlansSeeded = async (db: DrizzleClient) => {
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(plans);
    const count = Number(countResult[0]?.count ?? 0);
    if (count > 0) {
        return;
    }

    await db.insert(plans).values(
        DEFAULT_SERVER_PLANS.map((plan) => ({
            ...plan,
            createdAt: new Date(),
            updatedAt: new Date(),
        }))
    );
};

const upsertUser = async (uid: string, payload: Partial<UserRow>, db: DrizzleClient) => {
    const now = new Date();

    await db
        .insert(users)
        .values({
            uid,
            email: payload.email ?? null,
            phoneNumber: payload.phoneNumber ?? null,
            displayName: payload.displayName ?? null,
            photoURL: payload.photoURL ?? null,
            businessName: payload.businessName ?? null,
            address: payload.address ?? null,
            gstEnabled: payload.gstEnabled ?? false,
            gstNumber: payload.gstNumber ?? null,
            currency: payload.currency ?? 'INR',
            role: payload.role ?? 'owner',
            subscriptionStatus: payload.subscriptionStatus ?? 'inactive',
            subscriptionPlanId: payload.subscriptionPlanId ?? null,
            subscriptionPlanName: payload.subscriptionPlanName ?? null,
            subscriptionAmountMonthly: payload.subscriptionAmountMonthly ?? null,
            subscriptionCurrency: payload.subscriptionCurrency ?? null,
            subscriptionStartsAt: payload.subscriptionStartsAt ?? null,
            subscriptionEndsAt: payload.subscriptionEndsAt ?? null,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: users.uid,
            set: {
                email: payload.email,
                phoneNumber: payload.phoneNumber,
                displayName: payload.displayName,
                photoURL: payload.photoURL,
                businessName: payload.businessName,
                address: payload.address,
                gstEnabled: payload.gstEnabled,
                gstNumber: payload.gstNumber,
                currency: payload.currency,
                role: payload.role,
                subscriptionStatus: payload.subscriptionStatus,
                subscriptionPlanId: payload.subscriptionPlanId,
                subscriptionPlanName: payload.subscriptionPlanName,
                subscriptionAmountMonthly: payload.subscriptionAmountMonthly,
                subscriptionCurrency: payload.subscriptionCurrency,
                subscriptionStartsAt: payload.subscriptionStartsAt,
                subscriptionEndsAt: payload.subscriptionEndsAt,
                updatedAt: now,
            },
        });

    const nextUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!nextUser[0]) {
        throw new Error('Unable to load user profile after update.');
    }
    return nextUser[0];
};

const hasAudienceAccess = (audience: string, subscriptionStatus: string | null) => {
    if (audience === 'all') return true;
    if (audience === 'active_subscribers') return subscriptionStatus === 'active';
    if (audience === 'inactive_subscribers') return subscriptionStatus !== 'active';
    return false;
};

const isCronAuthorized = (provided: string | undefined, authorizationHeader: string | undefined, cronSecret: string | undefined) => {
    const expected = cronSecret;
    if (!expected) return true;
    if (provided === expected) return true;
    const bearer = getBearerToken(authorizationHeader);
    return bearer === expected;
};

app.get("/", async (c) => {
    return c.json({
        ok: true,
        service: 'billtap-api',
        now: new Date().toISOString(),
    });
});

app.get('/health', async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);
    return c.json({
        ok: true,
        service: 'billtap-api',
        now: new Date().toISOString(),
    });
});

app.post('/auth/google', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({
            idToken: z.string().min(20),
        });
        const payload = schema.parse(body);

        const google = await verifyGoogleIdentityToken(payload.idToken);
        const uid = `google_${google.sub}`;

        const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
        const isFirstUser = Number(totalUsers[0]?.count ?? 0) === 0;

        const user = await upsertUser(uid, {
            email: google.email ?? null,
            displayName: google.name ?? null,
            photoURL: google.picture ?? null,
            role: isFirstUser ? 'admin' : undefined,
        }, db);

        const token = signSessionToken({
            uid: user.uid,
            role: user.role,
        });

        return c.json({
            ok: true,
            token,
            user: toUserProfile(user),
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.post('/auth/phone/send', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({
            phoneNumber: z.string().min(6),
        });
        const payload = schema.parse(body);

        const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
        if (!phoneNumber || phoneNumber.length < 8) {
            return c.json({ ok: false, message: 'Invalid phone number.' }, 400);
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const verificationId = nanoid(24);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.insert(phoneVerifications).values({
            id: verificationId,
            phoneNumber,
            code,
            expiresAt,
            consumedAt: null,
            attempts: 0,
            createdAt: new Date(),
        });

        // TODO(phone-sms): Integrate real SMS provider (Twilio/MSG91/etc.) and stop returning testCode in production.
        return c.json({
            ok: true,
            verificationId,
            testCode: code,
            expiresAt,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.post('/auth/phone/verify', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({
            verificationId: z.string().min(8),
            verificationCode: z.string().length(6),
        });
        const payload = schema.parse(body);

        const verificationRows = await db
            .select()
            .from(phoneVerifications)
            .where(eq(phoneVerifications.id, payload.verificationId))
            .limit(1);

        const verification = verificationRows[0];
        if (!verification) {
            return c.json({ ok: false, message: 'Verification session not found.' }, 404);
        }

        if (verification.consumedAt) {
            return c.json({ ok: false, message: 'Verification code already used.' }, 400);
        }

        if (verification.expiresAt.getTime() < Date.now()) {
            return c.json({ ok: false, message: 'Verification code expired.' }, 400);
        }

        if (verification.code !== payload.verificationCode) {
            await db
                .update(phoneVerifications)
                .set({ attempts: verification.attempts + 1 })
                .where(eq(phoneVerifications.id, verification.id));
            return c.json({ ok: false, message: 'Invalid verification code.' }, 400);
        }

        await db
            .update(phoneVerifications)
            .set({ consumedAt: new Date() })
            .where(eq(phoneVerifications.id, verification.id));

        const normalizedPhone = normalizePhoneNumber(verification.phoneNumber);
        const phoneKey = normalizedPhone.replace(/\D/g, '');
        const uid = `phone_${phoneKey}`;

        const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
        const isFirstUser = Number(totalUsers[0]?.count ?? 0) === 0;

        const user = await upsertUser(uid, {
            phoneNumber: normalizedPhone,
            displayName: normalizedPhone,
            role: isFirstUser ? 'admin' : undefined,
        }, db);

        const token = signSessionToken({
            uid: user.uid,
            role: user.role,
        });

        return c.json({
            ok: true,
            token,
            user: toUserProfile(user),
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.get('/auth/me', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    return c.json({
        ok: true,
        user: toUserProfile(authUser),
    });
});

app.post('/auth/logout', requireAuth, async (c) => {
    return c.json({ ok: true });
});

app.get('/plans', optionalAuth, async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);

    const includeInactive = parseBoolean(c.req.query('includeInactive'), false);
    const authUser = c.get('authUser') as UserRow | null;

    if (includeInactive && authUser?.role !== 'admin') {
        return c.json({ ok: false, message: 'Admin access required.' }, 403);
    }

    const data = await db
        .select()
        .from(plans)
        .where(includeInactive ? sql`true` : eq(plans.isActive, true))
        .orderBy(asc(plans.displayOrder));

    return c.json({ ok: true, plans: data });
});

app.get('/offers/active', optionalAuth, async (c) => {
    const authUser = c.get('authUser');
    const db = c.get('db');
    const now = new Date();

    const data = await db
        .select()
        .from(offers)
        .where(
            and(
                eq(offers.isActive, true),
                sql`(${offers.startsAt} is null or ${offers.startsAt} <= ${now})`,
                sql`(${offers.endsAt} is null or ${offers.endsAt} >= ${now})`
            )
        )
        .orderBy(desc(offers.priority));

    const filtered = data.filter((entry) => hasAudienceAccess(entry.audience, authUser?.subscriptionStatus ?? null));

    return c.json({ ok: true, offers: filtered });
});

app.patch('/users/me', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const body = await c.req.json();

        const schema = z.object({
            email: z.string().email().nullable().optional(),
            phoneNumber: z.string().nullable().optional(),
            displayName: z.string().nullable().optional(),
            photoURL: z.string().url().nullable().optional(),
            businessName: z.string().nullable().optional(),
            address: z.string().nullable().optional(),
            gstEnabled: z.boolean().optional(),
            gstNumber: z.string().nullable().optional(),
            currency: z.string().min(3).max(6).optional(),
            subscriptionStatus: z.enum(['inactive', 'active', 'expired', 'canceled']).optional(),
            subscriptionPlanId: z.string().nullable().optional(),
            subscriptionPlanName: z.string().nullable().optional(),
            subscriptionAmountMonthly: z.number().nullable().optional(),
            subscriptionCurrency: z.string().nullable().optional(),
            subscriptionStartsAt: z.coerce.date().nullable().optional(),
            subscriptionEndsAt: z.coerce.date().nullable().optional(),
        });

        const payload = schema.parse(body);
        const db = c.get('db');
        const nextUser = await upsertUser(authUser.uid, {
            ...payload,
            role: authUser.role,
        }, db);

        return c.json({
            ok: true,
            user: toUserProfile(nextUser),
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});
app.get('/items', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    const db = c.get('db');
    const queryText = c.req.query('q')?.trim();

    if (queryText) {
        const normalized = queryText.toLowerCase();
        const data = await db
            .select()
            .from(items)
            .where(
                and(
                    eq(items.userId, authUser.uid),
                    or(
                        sql`${items.nameLowercase} like ${`%${normalized}%`}`,
                        sql`coalesce(${items.barcode}, '') like ${`%${queryText}%`}`
                    )
                )
            )
            .orderBy(asc(items.nameLowercase));

        return c.json({ ok: true, items: data });
    }

    const data = await db
        .select()
        .from(items)
        .where(eq(items.userId, authUser.uid))
        .orderBy(asc(items.nameLowercase));

    return c.json({ ok: true, items: data });
});

app.get('/items/:id', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    const db = c.get('db');
    const id = c.req.param('id');

    const data = await db
        .select()
        .from(items)
        .where(and(eq(items.id, id), eq(items.userId, authUser.uid)))
        .limit(1);

    if (!data[0]) {
        return c.json({ ok: false, message: 'Item not found.' }, 404);
    }

    return c.json({ ok: true, item: data[0] });
});

app.post('/items', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const db = c.get('db');
        const body = await c.req.json();

        const schema = z.object({
            id: z.string().min(6).optional(),
            name: z.string().min(1),
            price: z.number().nonnegative(),
            stock: z.number().int().nonnegative(),
            category: z.string().optional(),
            barcode: z.string().optional(),
        });

        const payload = schema.parse(body);
        const id = payload.id ?? nanoid();
        const now = new Date();

        if (payload.id) {
            const existing = await db
                .select({ id: items.id, userId: items.userId })
                .from(items)
                .where(eq(items.id, id))
                .limit(1);

            if (existing[0]) {
                if (existing[0].userId !== authUser.uid) {
                    return c.json({ ok: false, message: 'Item ID already exists.' }, 409);
                }
                return c.json({ ok: true, id });
            }
        }

        await db.insert(items).values({
            id,
            userId: authUser.uid,
            name: payload.name.trim(),
            nameLowercase: payload.name.trim().toLowerCase(),
            price: payload.price,
            stock: payload.stock,
            category: payload.category?.trim() || null,
            barcode: payload.barcode?.trim() || null,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.patch('/items/:id', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const db = c.get('db');
        const id = c.req.param('id');
        const body = await c.req.json();

        const schema = z.object({
            name: z.string().min(1).optional(),
            price: z.number().nonnegative().optional(),
            stock: z.number().int().nonnegative().optional(),
            category: z.string().nullable().optional(),
            barcode: z.string().nullable().optional(),
        });

        const payload = schema.parse(body);

        const updatePayload: Partial<typeof items.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (payload.name !== undefined) {
            updatePayload.name = payload.name.trim();
            updatePayload.nameLowercase = payload.name.trim().toLowerCase();
        }
        if (payload.price !== undefined) {
            updatePayload.price = payload.price;
        }
        if (payload.stock !== undefined) {
            updatePayload.stock = payload.stock;
        }
        if (payload.category !== undefined) {
            updatePayload.category = payload.category ? payload.category.trim() : null;
        }
        if (payload.barcode !== undefined) {
            updatePayload.barcode = payload.barcode ? payload.barcode.trim() : null;
        }

        const updated = await db
            .update(items)
            .set(updatePayload)
            .where(and(eq(items.id, id), eq(items.userId, authUser.uid)))
            .returning({ id: items.id });

        if (!updated[0]) {
            return c.json({ ok: false, message: 'Item not found.' }, 404);
        }

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.delete('/items/:id', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    const db = c.get('db');
    const id = c.req.param('id');

    const deleted = await db
        .delete(items)
        .where(and(eq(items.id, id), eq(items.userId, authUser.uid)))
        .returning({ id: items.id });

    if (!deleted[0]) {
        return c.json({ ok: false, message: 'Item not found.' }, 404);
    }

    return c.json({ ok: true });
});

app.post('/bills', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const body = await c.req.json();

        const lineItemSchema = z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            price: z.number().nonnegative(),
            quantity: z.number().int().positive(),
        });

        const schema = z.object({
            id: z.string().min(6).optional(),
            customerName: z.string().optional(),
            customerPhone: z.string().optional(),
            businessName: z.string().optional(),
            businessAddress: z.string().optional(),
            gstNumber: z.string().optional(),
            currency: z.string().optional(),
            items: z.array(lineItemSchema).min(1),
            total: z.number().nonnegative(),
            createdAt: z.coerce.date().optional(),
        });

        const payload = schema.parse(body);

        const grouped = new Map<string, number>();
        for (const line of payload.items) {
            grouped.set(line.id, (grouped.get(line.id) ?? 0) + line.quantity);
        }

        const billId = payload.id ?? nanoid();
        const createdAt = payload.createdAt ?? new Date();
        const db = c.get('db');

        if (payload.id) {
            const existingOrder = await db
                .select({ id: orders.id, userId: orders.userId })
                .from(orders)
                .where(eq(orders.id, billId))
                .limit(1);

            if (existingOrder[0]) {
                if (existingOrder[0].userId !== authUser.uid) {
                    return c.json({ ok: false, message: 'Bill ID already exists.' }, 409);
                }
                return c.json({ ok: true, id: billId });
            }
        }

        await db.transaction(async (tx) => {
            for (const [itemId, qty] of grouped.entries()) {
                const updatedRows = await tx
                    .update(items)
                    .set({
                        stock: sql`${items.stock} - ${qty}`,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(items.id, itemId), eq(items.userId, authUser.uid), gte(items.stock, qty)))
                    .returning({ id: items.id, name: items.name });

                if (!updatedRows[0]) {
                    const existing = await tx
                        .select({ id: items.id, name: items.name, stock: items.stock })
                        .from(items)
                        .where(and(eq(items.id, itemId), eq(items.userId, authUser.uid)))
                        .limit(1);

                    if (!existing[0]) {
                        throw new Error(`Item ${itemId} no longer exists.`);
                    }

                    throw new Error(`Insufficient stock for "${existing[0].name}".`);
                }
            }

            await tx.insert(orders).values({
                id: billId,
                userId: authUser.uid,
                customerName: payload.customerName?.trim() || null,
                customerPhone: payload.customerPhone?.trim() || null,
                businessName: payload.businessName?.trim() || null,
                businessAddress: payload.businessAddress?.trim() || null,
                gstNumber: payload.gstNumber?.trim() || null,
                currency: (payload.currency ?? authUser.currency ?? 'INR').toUpperCase(),
                items: payload.items,
                total: payload.total,
                createdAt,
            });
        });

        return c.json({ ok: true, id: billId });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.get('/bills', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    const db = c.get('db');

    const max = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 2000);
    const start = parseDate(c.req.query('start'));
    const end = parseDate(c.req.query('end'));

    const conditions = [eq(orders.userId, authUser.uid)];
    if (start) {
        conditions.push(gte(orders.createdAt, start));
    }
    if (end) {
        conditions.push(lte(orders.createdAt, end));
    }

    const data = await db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(max);

    return c.json({ ok: true, bills: data });
});

app.post('/analytics/events', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const body = await c.req.json();

        const schema = z.object({
            eventType: z.enum([
                'offer_impression',
                'offer_click',
                'subscription_screen_view',
                'plan_selected',
                'checkout_started',
                'checkout_redirected',
                'payment_success',
                'payment_failed',
            ]),
            source: z.string().optional(),
            planId: z.string().optional(),
            offerId: z.string().optional(),
            value: z.number().optional(),
            currency: z.string().optional(),
            metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        });

        const payload = schema.parse(body);
        const db = c.get('db');

        await db.insert(analyticsEvents).values({
            id: nanoid(),
            userId: authUser.uid,
            eventType: payload.eventType,
            source: payload.source ?? null,
            planId: payload.planId ?? null,
            offerId: payload.offerId ?? null,
            value: payload.value ?? null,
            currency: payload.currency ?? null,
            metadata: payload.metadata ?? null,
            createdAt: new Date(),
        });

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.get('/analytics/events', requireAdmin, async (c) => {
    const startDate = parseDate(c.req.query('startDate')) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const max = Math.min(Math.max(Number(c.req.query('limit') ?? 2000), 1), 10000);
    const db = c.get('db');

    const data = await db
        .select()
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, startDate))
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(max);

    return c.json({ ok: true, events: data });
});
app.get('/admin/users', requireAdmin, async (c) => {
    const max = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 2000);
    const db = c.get('db');
    const data = await db.select().from(users).orderBy(desc(users.updatedAt)).limit(max);

    return c.json({
        ok: true,
        users: data.map(toUserProfile),
    });
});

app.patch('/admin/users/:uid', requireAdmin, async (c) => {
    try {
        const uid = c.req.param('uid');
        const body = await c.req.json();

        const schema = z.object({
            email: z.string().email().nullable().optional(),
            phoneNumber: z.string().nullable().optional(),
            displayName: z.string().nullable().optional(),
            photoURL: z.string().url().nullable().optional(),
            businessName: z.string().nullable().optional(),
            address: z.string().nullable().optional(),
            gstEnabled: z.boolean().optional(),
            gstNumber: z.string().nullable().optional(),
            currency: z.string().optional(),
            role: z.enum(['owner', 'staff', 'admin']).optional(),
            subscriptionStatus: z.enum(['inactive', 'active', 'expired', 'canceled']).optional(),
            subscriptionPlanId: z.string().nullable().optional(),
            subscriptionPlanName: z.string().nullable().optional(),
            subscriptionAmountMonthly: z.number().nullable().optional(),
            subscriptionCurrency: z.string().nullable().optional(),
            subscriptionStartsAt: z.coerce.date().nullable().optional(),
            subscriptionEndsAt: z.coerce.date().nullable().optional(),
        });

        const payload = schema.parse(body);
        const db = c.get('db');
        const nextUser = await upsertUser(uid, payload, db);

        return c.json({ ok: true, user: toUserProfile(nextUser) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.patch('/admin/users/:uid/role', requireAdmin, async (c) => {
    try {
        const uid = c.req.param('uid');
        const body = await c.req.json();

        const schema = z.object({ role: z.enum(['owner', 'staff', 'admin']) });
        const payload = schema.parse(body);
        const db = c.get('db');

        const nextUser = await upsertUser(uid, {
            role: payload.role,
        }, db);

        return c.json({ ok: true, user: toUserProfile(nextUser) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.put('/admin/plans/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const schema = z.object({
            name: z.string().min(1),
            description: z.string().default(''),
            monthlyPrice: z.number().nonnegative(),
            currency: z.string().min(3).max(6),
            isActive: z.boolean(),
            displayOrder: z.number().int(),
            features: z.array(z.string()),
        });

        const payload = schema.parse(body);
        const now = new Date();
        const db = c.get('db');

        await db
            .insert(plans)
            .values({
                id,
                ...payload,
                currency: payload.currency.toUpperCase(),
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: plans.id,
                set: {
                    name: payload.name,
                    description: payload.description,
                    monthlyPrice: payload.monthlyPrice,
                    currency: payload.currency.toUpperCase(),
                    isActive: payload.isActive,
                    displayOrder: payload.displayOrder,
                    features: payload.features,
                    updatedAt: now,
                },
            });

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.get('/admin/plans', requireAdmin, async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);

    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);

    const data = await db
        .select()
        .from(plans)
        .where(includeInactive ? sql`true` : eq(plans.isActive, true))
        .orderBy(asc(plans.displayOrder));

    return c.json({ ok: true, plans: data });
});

app.put('/admin/offers/:id', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const schema = z.object({
            title: z.string().min(1),
            message: z.string().min(1),
            bannerUrl: z.string().nullable().optional(),
            bannerBackground: z.string().nullable().optional(),
            ctaText: z.string().nullable().optional(),
            ctaRoute: z.string().nullable().optional(),
            audience: z.enum(['all', 'active_subscribers', 'inactive_subscribers']),
            isActive: z.boolean(),
            priority: z.number().int(),
            startsAt: z.coerce.date().nullable().optional(),
            endsAt: z.coerce.date().nullable().optional(),
        });

        const payload = schema.parse(body);
        const now = new Date();
        const db = c.get('db');

        await db
            .insert(offers)
            .values({
                id,
                title: payload.title,
                message: payload.message,
                bannerUrl: payload.bannerUrl ?? null,
                bannerBackground: payload.bannerBackground ?? null,
                ctaText: payload.ctaText ?? null,
                ctaRoute: payload.ctaRoute ?? null,
                audience: payload.audience,
                isActive: payload.isActive,
                priority: payload.priority,
                startsAt: payload.startsAt ?? null,
                endsAt: payload.endsAt ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: offers.id,
                set: {
                    title: payload.title,
                    message: payload.message,
                    bannerUrl: payload.bannerUrl ?? null,
                    bannerBackground: payload.bannerBackground ?? null,
                    ctaText: payload.ctaText ?? null,
                    ctaRoute: payload.ctaRoute ?? null,
                    audience: payload.audience,
                    isActive: payload.isActive,
                    priority: payload.priority,
                    startsAt: payload.startsAt ?? null,
                    endsAt: payload.endsAt ?? null,
                    updatedAt: now,
                },
            });

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.patch('/admin/offers/:id/active', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const schema = z.object({ isActive: z.boolean() });
        const payload = schema.parse(body);
        const db = c.get('db');

        await db
            .update(offers)
            .set({ isActive: payload.isActive, updatedAt: new Date() })
            .where(eq(offers.id, id));

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.get('/admin/offers', requireAdmin, async (c) => {
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);
    const db = c.get('db');

    const data = await db
        .select()
        .from(offers)
        .where(includeInactive ? sql`true` : eq(offers.isActive, true))
        .orderBy(desc(offers.priority));

    return c.json({ ok: true, offers: data });
});

app.post('/admin/seed/default-plans', requireAdmin, async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);
    return c.json({ ok: true, count: DEFAULT_SERVER_PLANS.length });
});

app.post('/payments/subscription-checkout', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const body = await c.req.json();

        const schema = z.object({
            planId: z.string().min(1),
            planName: z.string().min(1),
            amount: z.number().positive(),
            currency: z.string().min(3).max(6),
        });

        const payload = schema.parse(body);

        const provider = ['stripe', 'razorpay'].includes(String(process.env.PAYMENT_PROVIDER || '').toLowerCase())
            ? String(process.env.PAYMENT_PROVIDER || '').toLowerCase()
            : 'mock';

        const intentId = nanoid();
        const checkoutBase = process.env.CHECKOUT_BASE_URL || 'https://example.com/checkout';
        const checkoutUrl = `${checkoutBase}?intentId=${encodeURIComponent(intentId)}&provider=${provider}`;
        const now = new Date();
        const db = c.get('db');

        await db.insert(paymentIntents).values({
            id: intentId,
            userId: authUser.uid,
            planId: payload.planId,
            planName: payload.planName,
            amount: payload.amount,
            currency: payload.currency.toUpperCase(),
            provider,
            status: 'pending',
            checkoutUrl,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(analyticsEvents).values({
            id: nanoid(),
            userId: authUser.uid,
            eventType: 'checkout_started',
            source: 'api_checkout',
            planId: payload.planId,
            value: payload.amount,
            currency: payload.currency.toUpperCase(),
            metadata: { provider },
            createdAt: now,
        });

        return c.json({
            ok: true,
            intentId,
            checkoutUrl,
            provider,
            message: 'Checkout scaffold created.',
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.get('/payments/intents/:intentId/status', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    const db = c.get('db');
    const intentId = c.req.param('intentId');

    const rows = await db.select().from(paymentIntents).where(eq(paymentIntents.id, intentId)).limit(1);
    const intent = rows[0];

    if (!intent) {
        return c.json({ ok: false, message: 'Payment intent not found.' }, 404);
    }

    if (intent.userId !== authUser.uid && authUser.role !== 'admin') {
        return c.json({ ok: false, message: 'Forbidden.' }, 403);
    }

    return c.json({
        ok: true,
        status: intent.status,
        provider: intent.provider,
        updatedAt: intent.updatedAt,
    });
});

app.post('/payments/webhook', async (c) => {
    const provided = c.req.header('X-Webhook-Secret');
    const expected = process.env.PAYMENT_WEBHOOK_SECRET;

    if (expected && provided !== expected) {
        return c.json({ ok: false, message: 'Invalid webhook signature.' }, 401);
    }

    try {
        const body = await c.req.json();
        const schema = z.object({
            intentId: z.string().min(1),
            status: z.enum(['pending', 'succeeded', 'failed', 'canceled']),
            providerReference: z.string().nullable().optional(),
            failureReason: z.string().nullable().optional(),
        });

        const payload = schema.parse(body);
        const db = c.get('db');

        const rows = await db.select().from(paymentIntents).where(eq(paymentIntents.id, payload.intentId)).limit(1);
        const intent = rows[0];

        if (!intent) {
            return c.json({ ok: false, message: 'Payment intent not found.' }, 404);
        }

        const now = new Date();

        await db
            .update(paymentIntents)
            .set({
                status: payload.status,
                providerReference: payload.providerReference ?? null,
                failureReason: payload.failureReason ?? null,
                updatedAt: now,
            })
            .where(eq(paymentIntents.id, payload.intentId));

        if (payload.status === 'succeeded') {
            const startsAt = now;
            const endsAt = new Date(now);
            endsAt.setMonth(endsAt.getMonth() + 1);

            await upsertUser(intent.userId, {
                subscriptionStatus: 'active',
                subscriptionPlanId: intent.planId,
                subscriptionPlanName: intent.planName,
                subscriptionAmountMonthly: intent.amount,
                subscriptionCurrency: intent.currency,
                subscriptionStartsAt: startsAt,
                subscriptionEndsAt: endsAt,
            }, db);

            await db.insert(analyticsEvents).values({
                id: nanoid(),
                userId: intent.userId,
                eventType: 'payment_success',
                source: 'payment_webhook',
                planId: intent.planId,
                value: intent.amount,
                currency: intent.currency,
                metadata: { provider: intent.provider },
                createdAt: now,
            });
        }

        if (payload.status === 'failed') {
            await db.insert(analyticsEvents).values({
                id: nanoid(),
                userId: intent.userId,
                eventType: 'payment_failed',
                source: 'payment_webhook',
                planId: intent.planId,
                value: intent.amount,
                currency: intent.currency,
                metadata: {
                    provider: intent.provider,
                    reason: payload.failureReason ?? 'unknown',
                },
                createdAt: now,
            });
        }

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: asErrorMessage(error) }, 400);
    }
});

app.post('/jobs/expire-subscriptions', async (c) => {
    if (!isCronAuthorized(c.req.header('X-Cron-Secret'), c.req.header('Authorization'), c.env.CRON_SECRET)) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const now = new Date();
    const db = c.get('db');

    const updated = await db
        .update(users)
        .set({
            subscriptionStatus: 'expired',
            updatedAt: now,
        })
        .where(and(eq(users.subscriptionStatus, 'active'), lte(users.subscriptionEndsAt, now)))
        .returning({ uid: users.uid });

    return c.json({ ok: true, expired: updated.length });
});

app.post('/jobs/sync-offers', async (c) => {
    if (!isCronAuthorized(c.req.header('X-Cron-Secret'), c.req.header('Authorization'), c.env.CRON_SECRET)) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const now = new Date();
    const db = c.get('db');

    const activated = await db
        .update(offers)
        .set({ isActive: true, updatedAt: now })
        .where(and(eq(offers.isActive, false), lte(offers.startsAt, now), or(sql`${offers.endsAt} is null`, gte(offers.endsAt, now))))
        .returning({ id: offers.id });

    const deactivated = await db
        .update(offers)
        .set({ isActive: false, updatedAt: now })
        .where(and(eq(offers.isActive, true), lte(offers.endsAt, now)))
        .returning({ id: offers.id });

    return c.json({ ok: true, activated: activated.length, deactivated: deactivated.length });
});

app.post('/jobs/run-all', async (c) => {
    if (!isCronAuthorized(c.req.header('X-Cron-Secret'), c.req.header('Authorization'), c.env.CRON_SECRET)) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const now = new Date();
    const db = c.get('db');

    // Expire subscriptions
    const expired = await db
        .update(users)
        .set({
            subscriptionStatus: 'expired',
            updatedAt: now,
        })
        .where(and(eq(users.subscriptionStatus, 'active'), lte(users.subscriptionEndsAt, now)))
        .returning({ uid: users.uid });

    // Sync offers
    const activated = await db
        .update(offers)
        .set({ isActive: true, updatedAt: now })
        .where(and(eq(offers.isActive, false), lte(offers.startsAt, now), or(sql`${offers.endsAt} is null`, gte(offers.endsAt, now))))
        .returning({ id: offers.id });

    const deactivated = await db
        .update(offers)
        .set({ isActive: false, updatedAt: now })
        .where(and(eq(offers.isActive, true), lte(offers.endsAt, now)))
        .returning({ id: offers.id });

    return c.json({
        ok: true,
        subscriptions: { expired: expired.length },
        offers: { activated: activated.length, deactivated: deactivated.length }
    });
});

app.notFound((c) => {
    return c.json({ ok: false, message: 'Route not found.' }, 404);
});

app.onError((error, c) => {
    return c.json({ ok: false, message: asErrorMessage(error) }, 500);
});

export default app;

