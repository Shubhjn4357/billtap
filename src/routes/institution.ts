import { Hono } from 'hono';
import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    feeInvoices,
    feeReminderLogs,
    institutionStudents,
    messageLogs,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { requirePermission, withOrganizationContext } from '../middleware/permissions';

const institutionRoute = new Hono<AppEnv>();

const parseDateSafe = (value?: string | null): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

institutionRoute.get('/students', requireAuth, withOrganizationContext, requirePermission('can_manage_payments'), async (c) => {
    const ownerUserId = c.get('organizationOwnerId');
    const organizationId = c.get('organizationId');
    if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const activeOnly = c.req.query('activeOnly') !== 'false';
    const db = c.get('db');
    const rows = await db
        .select()
        .from(institutionStudents)
        .where(and(
            eq(institutionStudents.userId, ownerUserId),
            eq(institutionStudents.organizationId, organizationId),
            ...(activeOnly ? [eq(institutionStudents.isActive, true)] : []),
        ))
        .orderBy(asc(institutionStudents.name));

    return c.json({ ok: true, students: rows });
});

institutionRoute.post('/students', requireAuth, withOrganizationContext, requirePermission('can_manage_payments'), async (c) => {
    try {
        const ownerUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const payload = z.object({
            name: z.string().min(1).max(120),
            className: z.string().max(80).optional(),
            admissionNumber: z.string().max(40).optional(),
            guardianName: z.string().max(120).optional(),
            phoneNumber: z.string().max(20).optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const now = new Date();
        const id = nanoid();
        await db.insert(institutionStudents).values({
            id,
            userId: ownerUserId,
            organizationId,
            name: payload.name.trim(),
            className: payload.className?.trim() || null,
            admissionNumber: payload.admissionNumber?.trim() || null,
            guardianName: payload.guardianName?.trim() || null,
            phoneNumber: payload.phoneNumber?.trim() || null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create student.' }, 400);
    }
});

institutionRoute.get('/fee-invoices', requireAuth, withOrganizationContext, requirePermission('can_manage_payments'), async (c) => {
    const ownerUserId = c.get('organizationOwnerId');
    const organizationId = c.get('organizationId');
    if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const studentId = c.req.query('studentId');
    const status = c.req.query('status');
    const dueBefore = parseDateSafe(c.req.query('dueBefore'));
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);

    const conditions = [
        eq(feeInvoices.userId, ownerUserId),
        eq(feeInvoices.organizationId, organizationId),
    ];
    if (studentId) conditions.push(eq(feeInvoices.studentId, studentId));
    if (status) conditions.push(eq(feeInvoices.status, status));
    if (dueBefore) conditions.push(lte(feeInvoices.dueDate, dueBefore));

    const db = c.get('db');
    const rows = await db
        .select()
        .from(feeInvoices)
        .where(and(...conditions))
        .orderBy(desc(feeInvoices.dueDate), desc(feeInvoices.createdAt))
        .limit(limit);

    return c.json({ ok: true, invoices: rows });
});

institutionRoute.post('/fee-invoices', requireAuth, withOrganizationContext, requirePermission('can_manage_payments'), async (c) => {
    try {
        const ownerUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const payload = z.object({
            studentId: z.string().min(1),
            invoiceNumber: z.string().optional(),
            amount: z.number().positive(),
            dueDate: z.coerce.date().optional(),
            notes: z.string().optional(),
            barcodeValue: z.string().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const studentRows = await db
            .select()
            .from(institutionStudents)
            .where(and(
                eq(institutionStudents.userId, ownerUserId),
                eq(institutionStudents.organizationId, organizationId),
                eq(institutionStudents.id, payload.studentId),
                eq(institutionStudents.isActive, true),
            ))
            .limit(1);
        if (!studentRows[0]) return c.json({ ok: false, message: 'Student not found.' }, 404);

        const now = new Date();
        const id = nanoid();
        const barcodeValue = payload.barcodeValue ?? `FEE-${id.slice(0, 8).toUpperCase()}`;
        await db.insert(feeInvoices).values({
            id,
            userId: ownerUserId,
            organizationId,
            studentId: payload.studentId,
            invoiceNumber: payload.invoiceNumber ?? `INV-${now.getFullYear()}-${id.slice(0, 6).toUpperCase()}`,
            amount: payload.amount,
            paidAmount: 0,
            dueAmount: payload.amount,
            dueDate: payload.dueDate ?? null,
            status: 'DUE',
            paymentMode: null,
            barcodeValue,
            notes: payload.notes ?? null,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id, barcodeValue });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create fee invoice.' }, 400);
    }
});

institutionRoute.post('/fee-invoices/:id/collect', requireAuth, withOrganizationContext, requirePermission('can_manage_payments'), async (c) => {
    try {
        const ownerUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const id = c.req.param('id');
        const payload = z.object({
            amount: z.number().positive(),
            paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CARD', 'ONLINE']).default('CASH'),
        }).parse(await c.req.json());

        const db = c.get('db');
        const rows = await db
            .select()
            .from(feeInvoices)
            .where(and(
                eq(feeInvoices.userId, ownerUserId),
                eq(feeInvoices.organizationId, organizationId),
                eq(feeInvoices.id, id),
            ))
            .limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Fee invoice not found.' }, 404);

        const paidAmount = roundAmount(Number(invoice.paidAmount ?? 0) + payload.amount);
        const totalAmount = roundAmount(Number(invoice.amount ?? 0));
        const dueAmount = roundAmount(Math.max(totalAmount - paidAmount, 0));
        const status = dueAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'DUE';

        await db
            .update(feeInvoices)
            .set({
                paidAmount,
                dueAmount,
                status,
                paymentMode: payload.paymentMode,
                updatedAt: new Date(),
            })
            .where(eq(feeInvoices.id, invoice.id));

        return c.json({
            ok: true,
            status,
            paidAmount,
            dueAmount,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to collect fee.' }, 400);
    }
});

institutionRoute.get('/fee-reminders/due', requireAuth, withOrganizationContext, requirePermission('can_manage_payments'), async (c) => {
    const ownerUserId = c.get('organizationOwnerId');
    const organizationId = c.get('organizationId');
    if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const dueBefore = parseDateSafe(c.req.query('dueBefore')) ?? new Date();
    const db = c.get('db');
    const rows = await db
        .select()
        .from(feeInvoices)
        .where(and(
            eq(feeInvoices.userId, ownerUserId),
            eq(feeInvoices.organizationId, organizationId),
            lte(feeInvoices.dueDate, dueBefore),
        ))
        .orderBy(asc(feeInvoices.dueDate));

    const dueRows = rows.filter((row) => row.status !== 'PAID' && Number(row.dueAmount ?? 0) > 0);
    return c.json({ ok: true, reminders: dueRows });
});

institutionRoute.post('/fee-reminders/:invoiceId/send-whatsapp', requireAuth, withOrganizationContext, requirePermission('can_send_messages'), async (c) => {
    try {
        const ownerUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        const authUser = c.get('authUser');
        if (!ownerUserId || !organizationId || !authUser) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const invoiceId = c.req.param('invoiceId');
        const payload = z.object({
            recipient: z.string().min(6),
            customMessage: z.string().optional(),
            mediaUrl: z.string().url().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const rows = await db
            .select()
            .from(feeInvoices)
            .where(and(
                eq(feeInvoices.userId, ownerUserId),
                eq(feeInvoices.organizationId, organizationId),
                eq(feeInvoices.id, invoiceId),
            ))
            .limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Fee invoice not found.' }, 404);

        const message = payload.customMessage
            ?? `Fee reminder: Invoice ${invoice.invoiceNumber ?? invoice.id} has due amount ${invoice.dueAmount}. Barcode: ${invoice.barcodeValue ?? '-'}`;

        const now = new Date();
        const reminderId = nanoid();
        await db.insert(feeReminderLogs).values({
            id: reminderId,
            userId: ownerUserId,
            organizationId,
            feeInvoiceId: invoice.id,
            channel: 'WHATSAPP',
            recipient: payload.recipient,
            message,
            status: 'pending',
            sentByUid: authUser.uid,
            createdAt: now,
        });

        // Provider integration can be plugged via env vars; currently logs and marks as sent.
        await db.insert(messageLogs).values({
            id: nanoid(),
            userId: ownerUserId,
            organizationId,
            channel: 'WHATSAPP',
            recipient: payload.recipient,
            message,
            mediaUrl: payload.mediaUrl ?? null,
            providerMessageId: null,
            status: 'sent',
            errorMessage: null,
            sentByUid: authUser.uid,
            sentAt: now,
            createdAt: now,
        });

        await db
            .update(feeReminderLogs)
            .set({ status: 'sent' })
            .where(eq(feeReminderLogs.id, reminderId));

        return c.json({ ok: true, reminderId, status: 'sent' });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to send reminder.' }, 400);
    }
});

export default institutionRoute;
