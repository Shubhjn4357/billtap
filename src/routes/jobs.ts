import { Hono } from 'hono';
import { and, eq, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { items, offers, phoneVerifications, transactions, users, auditLogs, analyticsEvents } from '../db/schema';
import { withTransaction } from '../db/transaction';
import type { AppEnv } from '../middleware/auth';

const jobsRoute = new Hono<AppEnv>();

const isAuthorized = (provided: string | undefined, expected: string | undefined) => {
    if (!expected) return true;
    return provided === expected;
};

jobsRoute.post('/run-all', async (c) => {
    const headerSecret = c.req.header('X-Cron-Secret');
    const bearer = c.req.header('Authorization');
    const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length).trim() : undefined;

    const expected = c.env.CRON_SECRET;
    const authorized = isAuthorized(headerSecret, expected) || isAuthorized(bearerSecret, expected);
    if (!authorized) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const db = c.get('db');
    const now = new Date();
    const otpRetentionHours = Number(c.env.OTP_RETENTION_HOURS || 24);
    const otpCutoff = new Date(now.getTime() - otpRetentionHours * 60 * 60 * 1000);

    const [expiredUsers, deactivatedOffers, activatedOffers, deletedOtps, deletedItems, rotatedReminders] = await withTransaction(db, async (tx) => {
        const expired = await tx
            .update(users)
            .set({
                subscriptionStatus: 'inactive',
                updatedAt: now,
            })
            .where(and(eq(users.subscriptionStatus, 'active'), lte(users.subscriptionEndsAt, now)))
            .returning({ uid: users.uid });

        const deactivated = await tx
            .update(offers)
            .set({
                isActive: false,
                updatedAt: now,
            })
            .where(and(eq(offers.isActive, true), isNotNull(offers.endsAt), lte(offers.endsAt, now)))
            .returning({ id: offers.id });

        const activated = await tx
            .update(offers)
            .set({
                isActive: true,
                updatedAt: now,
            })
            .where(
                and(
                    eq(offers.isActive, false),
                    isNotNull(offers.startsAt),
                    lte(offers.startsAt, now),
                    or(sql`${offers.endsAt} is null`, sql`${offers.endsAt} >= ${now}`),
                )
            )
            .returning({ id: offers.id });

        const cleanedOtps = await tx
            .delete(phoneVerifications)
            .where(
                or(
                    and(isNotNull(phoneVerifications.consumedAt), lte(phoneVerifications.consumedAt, otpCutoff)),
                    lte(phoneVerifications.expiresAt, otpCutoff)
                )
            )
            .returning({ id: phoneVerifications.id });

        const cleanedItems = await tx
            .delete(items)
            .where(and(eq(items.autoDeleteEnabled, true), isNotNull(items.autoDeleteAt), lte(items.autoDeleteAt, now)))
            .returning({ id: items.id });

        // Cleanup: Keeping max 20 latest audit logs per user
        await tx.execute(sql`
            WITH ranked_audit AS (
                SELECT id, ROW_NUMBER() OVER(PARTITION BY "userId" ORDER BY "createdAt" DESC) as rn
                FROM audit_logs
            )
            DELETE FROM audit_logs WHERE id IN (SELECT id FROM ranked_audit WHERE rn > 20)
        `);

        // Cleanup: Keeping max 20 latest analytics events per user
        await tx.execute(sql`
            WITH ranked_analytics AS (
                SELECT id, ROW_NUMBER() OVER(PARTITION BY "userId" ORDER BY "createdAt" DESC) as rn
                FROM analytics_events
            )
            DELETE FROM analytics_events WHERE id IN (SELECT id FROM ranked_analytics WHERE rn > 20)
        `);

        const pendingCreditTx = await tx
            .select({
                id: transactions.id,
                reminderFrequencyDays: transactions.reminderFrequencyDays,
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.reminderEnabled, true),
                    inArray(transactions.paymentStatus, ['PENDING', 'PARTIAL']),
                    isNotNull(transactions.nextReminderAt),
                    lte(transactions.nextReminderAt, now)
                )
            );

        for (const entry of pendingCreditTx) {
            const nextReminder = new Date(now.getTime() + Number(entry.reminderFrequencyDays || 3) * 24 * 60 * 60 * 1000);
            await tx
                .update(transactions)
                .set({
                    lastReminderAt: now,
                    nextReminderAt: nextReminder,
                    updatedAt: now,
                })
                .where(eq(transactions.id, entry.id));
        }

        return [expired, deactivated, activated, cleanedOtps, cleanedItems, pendingCreditTx] as const;
    });

    return c.json({
        ok: true,
        now: now.toISOString(),
        subscriptionExpiredCount: expiredUsers.length,
        offersDeactivatedCount: deactivatedOffers.length,
        offersActivatedCount: activatedOffers.length,
        otpCleanupCount: deletedOtps.length,
        timeBasedItemCleanupCount: deletedItems.length,
        reminderRotationCount: rotatedReminders.length,
    });
});

export default jobsRoute;
