import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { loans, loanTransactions } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    getAccessibleBusiness,
    getRequestedBusinessId,
    getActiveSubscription,
    requireOrganizationCapability,
} from './helpers';
import { nanoid } from 'nanoid';
import { assertModuleEnabled, assertSubscriptionWriteAllowed } from '../services/subscriptionPolicy';

const loansRoute = new Hono<AppEnv>();

loansRoute.use('/*', requireAuth);

const createLoanSchema = z.object({
    id: z.string().trim().min(1).optional(),
    lenderBorrowerName: z.string().min(1).max(200),
    loanType: z.enum(['BORROWED', 'GIVEN']),
    openingDate: z.string().date(),
    openingBalance: z.number().nonnegative().default(0),
    interestRatePercent: z.number().nonnegative().default(0),
    emiAmount: z.number().positive().optional(),
    partyId: z.string().optional(),
    accountId: z.string().optional(),
    notes: z.string().max(500).optional(),
});

const loanTransactionSchema = z.object({
    transactionType: z.enum(['DISBURSEMENT', 'REPAYMENT', 'INTEREST']),
    amount: z.number().positive(),
    date: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
});

// List loans
loansRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'loans.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'accounts');

    const rows = await db.select().from(loans)
        .where(and(eq(loans.businessId, business.id), eq(loans.isActive, true)))
        .orderBy(desc(loans.createdAt));

    return c.json({ ok: true, data: rows });
});

// Get loan with transactions
loansRoute.get('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'loans.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.businessId, business.id)));
    if (!loan) return c.json({ ok: false, message: 'Loan not found' }, 404);

    const txns = await db.select().from(loanTransactions)
        .where(eq(loanTransactions.loanId, id))
        .orderBy(desc(loanTransactions.date));

    return c.json({ ok: true, data: { ...loan, transactions: txns } });
});

// Create loan
loansRoute.post('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'loans.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    try {
        const body = createLoanSchema.parse(await c.req.json());
        const now = new Date();
        if (body.id) {
            const existing = await db.select().from(loans).where(and(
                eq(loans.id, body.id),
                eq(loans.businessId, business.id),
            )).limit(1);
            if (existing[0]) {
                return c.json({ ok: true, data: existing[0] });
            }
        }
        const id = body.id?.trim() || `loan_${nanoid(16)}`;

        const [loan] = await db.insert(loans).values({
            id,
            businessId: business.id,
            lenderBorrowerName: body.lenderBorrowerName,
            loanType: body.loanType,
            openingDate: new Date(body.openingDate),
            openingBalance: body.openingBalance,
            currentBalance: body.openingBalance,
            interestRatePercent: body.interestRatePercent,
            emiAmount: body.emiAmount,
            partyId: body.partyId,
            accountId: body.accountId,
            notes: body.notes,
            isActive: true,
            createdByUserId: authUser.id,
            createdAt: now,
            updatedAt: now,
        }).returning();

        return c.json({ ok: true, data: loan }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to create loan.' }, 400);
    }
});

// Update loan
loansRoute.put('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'loans.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    try {
        const body = createLoanSchema.partial().parse(await c.req.json());
        const [loan] = await db.update(loans)
            .set({ ...body, openingDate: body.openingDate ? new Date(body.openingDate) : undefined, updatedAt: new Date() })
            .where(and(eq(loans.id, id), eq(loans.businessId, business.id)))
            .returning();
        if (!loan) return c.json({ ok: false, message: 'Loan not found' }, 404);
        return c.json({ ok: true, data: loan });
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to update loan.' }, 400);
    }
});

// Deactivate loan
loansRoute.delete('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'loans.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    await db.update(loans).set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(loans.id, id), eq(loans.businessId, business.id)));
    return c.json({ ok: true, message: 'Loan deactivated' });
});

// Add loan transaction
loansRoute.post('/:id/transactions', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'loans.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const loanId = c.req.param('id');
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.businessId, business.id)));
    if (!loan) return c.json({ ok: false, message: 'Loan not found' }, 404);

    try {
        const body = loanTransactionSchema.parse(await c.req.json());
        const now = new Date();
        const signed = body.transactionType === 'DISBURSEMENT' ? body.amount : -body.amount;
        const newBalance = loan.currentBalance + signed;

        const txn = await db.transaction(async (tx) => {
            const [t] = await tx.insert(loanTransactions).values({
                id: `ltxn_${nanoid(16)}`,
                loanId,
                businessId: business.id,
                transactionType: body.transactionType,
                amount: body.amount,
                balanceAfter: newBalance,
                date: body.date ? new Date(body.date) : now,
                notes: body.notes,
                createdByUserId: authUser.id,
                createdAt: now,
            }).returning();
            await tx.update(loans).set({ currentBalance: newBalance, updatedAt: now }).where(eq(loans.id, loanId));
            return t;
        });

        return c.json({ ok: true, data: txn }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to add transaction.' }, 400);
    }
});

export default loansRoute;
