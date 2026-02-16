import { Hono } from 'hono';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { gstNotes, parties, transactions } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePeriodUnlockedForDate,
    getBusinessControls,
    hasModulePermission,
    writeAuditLog,
} from '../operations/controls';

const gstComplianceRoute = new Hono<AppEnv>();

type InvoiceClassification = 'B2B' | 'B2C';

const parseDateInput = (value?: string | null): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

const toSafeCsv = (value: string | number | null | undefined): string => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
};

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const getStateCodeFromGst = (value?: string | null): string | null => {
    if (!value) return null;
    const normalized = value.replace(/\s/g, '').toUpperCase();
    const stateCode = normalized.slice(0, 2);
    return /^\d{2}$/.test(stateCode) ? stateCode : null;
};

const getClassification = (partyGstNumber?: string | null): InvoiceClassification =>
    partyGstNumber ? 'B2B' : 'B2C';

const getPlaceOfSupply = (businessGst?: string | null, partyGstNumber?: string | null): string => {
    const businessState = getStateCodeFromGst(businessGst);
    const partyState = getStateCodeFromGst(partyGstNumber);
    if (!partyState) return 'UNREGISTERED';
    if (!businessState) return `STATE_${partyState}`;
    return businessState === partyState ? `INTRA_STATE_${partyState}` : `INTER_STATE_${partyState}`;
};

const summarizeLineItems = (lines: Array<{ quantity: number; price: number; tax?: number }>) => {
    let taxableAmount = 0;
    let taxAmount = 0;

    for (const line of lines) {
        const lineTaxable = Number(line.quantity) * Number(line.price);
        const lineTax = lineTaxable * (Number(line.tax ?? 0) / 100);
        taxableAmount += lineTaxable;
        taxAmount += lineTax;
    }

    return {
        taxableAmount: roundAmount(taxableAmount),
        taxAmount: roundAmount(taxAmount),
        totalAmount: roundAmount(taxableAmount + taxAmount),
    };
};

gstComplianceRoute.get('/summary', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'GST compliance access denied.' }, 403);
    }

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const db = c.get('db');

    const conditions = [eq(transactions.userId, effectiveUserId)];
    if (start) conditions.push(gte(transactions.billDate, start));
    if (end) conditions.push(lte(transactions.billDate, end));

    const rows = await db
        .select({
            id: transactions.id,
            type: transactions.type,
            partyId: transactions.partyId,
            billDate: transactions.billDate,
            items: transactions.items,
        })
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.billDate));

    const partyRows = await db
        .select({ id: parties.id, gstNumber: parties.gstNumber })
        .from(parties)
        .where(eq(parties.userId, effectiveUserId));
    const gstByPartyId = new Map(partyRows.map((row) => [row.id, row.gstNumber]));

    let outputTax = 0;
    let inputTax = 0;
    let taxableSales = 0;
    let taxablePurchases = 0;
    let b2bSalesCount = 0;
    let b2cSalesCount = 0;
    let itcEligible = 0;
    let itcIneligible = 0;

    for (const row of rows) {
        const { taxableAmount, taxAmount } = summarizeLineItems(row.items);
        const partyGstNumber = row.partyId ? gstByPartyId.get(row.partyId) : null;
        const classification = getClassification(partyGstNumber);

        if (row.type === 'SALE') {
            taxableSales += taxableAmount;
            outputTax += taxAmount;
            if (classification === 'B2B') {
                b2bSalesCount += 1;
            } else {
                b2cSalesCount += 1;
            }
            continue;
        }

        taxablePurchases += taxableAmount;
        inputTax += taxAmount;
        if (partyGstNumber) {
            itcEligible += taxAmount;
        } else {
            itcIneligible += taxAmount;
        }
    }

    return c.json({
        ok: true,
        period: { start, end },
        sales: {
            taxableValue: roundAmount(taxableSales),
            outputTax: roundAmount(outputTax),
            b2bInvoices: b2bSalesCount,
            b2cInvoices: b2cSalesCount,
        },
        purchases: {
            taxableValue: roundAmount(taxablePurchases),
            inputTax: roundAmount(inputTax),
        },
        itc: {
            eligible: roundAmount(itcEligible),
            ineligible: roundAmount(itcIneligible),
        },
        netGstPayable: roundAmount(outputTax - inputTax),
    });
});

gstComplianceRoute.get('/classification', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'GST compliance access denied.' }, 403);
    }

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const typeFilter = c.req.query('type');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 500), 1), 2000);

    const conditions = [eq(transactions.userId, effectiveUserId)];
    if (start) conditions.push(gte(transactions.billDate, start));
    if (end) conditions.push(lte(transactions.billDate, end));
    if (typeFilter === 'SALE' || typeFilter === 'PURCHASE') {
        conditions.push(eq(transactions.type, typeFilter));
    }

    const db = c.get('db');
    const txnRows = await db
        .select({
            id: transactions.id,
            type: transactions.type,
            billNumber: transactions.billNumber,
            billDate: transactions.billDate,
            partyId: transactions.partyId,
            partyName: transactions.partyName,
            items: transactions.items,
            totalAmount: transactions.totalAmount,
        })
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.billDate))
        .limit(limit);

    const partyRows = await db
        .select({ id: parties.id, gstNumber: parties.gstNumber })
        .from(parties)
        .where(eq(parties.userId, effectiveUserId));
    const gstByPartyId = new Map(partyRows.map((row) => [row.id, row.gstNumber]));
    const businessGst = authUser?.gstNumber ?? null;

    const rows = txnRows.map((row) => {
        const partyGstNumber = row.partyId ? (gstByPartyId.get(row.partyId) ?? null) : null;
        const classification = getClassification(partyGstNumber);
        const placeOfSupply = getPlaceOfSupply(businessGst, partyGstNumber);
        const totals = summarizeLineItems(row.items);

        return {
            id: row.id,
            type: row.type,
            billNumber: row.billNumber,
            billDate: row.billDate,
            partyName: row.partyName,
            partyGstNumber,
            classification,
            placeOfSupply,
            taxableAmount: totals.taxableAmount,
            taxAmount: totals.taxAmount,
            totalAmount: roundAmount(Number(row.totalAmount ?? totals.totalAmount)),
        };
    });

    return c.json({
        ok: true,
        period: { start, end },
        rows,
    });
});

gstComplianceRoute.get('/itc-register', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'GST compliance access denied.' }, 403);
    }

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 500), 1), 2000);

    const conditions = [eq(transactions.userId, effectiveUserId), eq(transactions.type, 'PURCHASE')];
    if (start) conditions.push(gte(transactions.billDate, start));
    if (end) conditions.push(lte(transactions.billDate, end));

    const db = c.get('db');
    const txnRows = await db
        .select({
            id: transactions.id,
            billNumber: transactions.billNumber,
            billDate: transactions.billDate,
            partyId: transactions.partyId,
            partyName: transactions.partyName,
            items: transactions.items,
            totalAmount: transactions.totalAmount,
        })
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.billDate))
        .limit(limit);

    const partyRows = await db
        .select({ id: parties.id, gstNumber: parties.gstNumber })
        .from(parties)
        .where(eq(parties.userId, effectiveUserId));
    const gstByPartyId = new Map(partyRows.map((row) => [row.id, row.gstNumber]));

    let eligibleTotal = 0;
    let ineligibleTotal = 0;

    const rows = txnRows.map((row) => {
        const supplierGstNumber = row.partyId ? (gstByPartyId.get(row.partyId) ?? null) : null;
        const totals = summarizeLineItems(row.items);
        const hasAnyTax = totals.taxAmount > 0;
        const eligibleItc = supplierGstNumber && hasAnyTax ? totals.taxAmount : 0;
        const ineligibleItc = roundAmount(totals.taxAmount - eligibleItc);

        eligibleTotal += eligibleItc;
        ineligibleTotal += ineligibleItc;

        let mismatchReason: string | null = null;
        if (!supplierGstNumber) mismatchReason = 'Supplier GST number missing.';
        if (supplierGstNumber && !hasAnyTax) mismatchReason = 'No tax found in purchase line items.';

        return {
            transactionId: row.id,
            billNumber: row.billNumber,
            billDate: row.billDate,
            supplierName: row.partyName,
            supplierGstNumber,
            taxableAmount: totals.taxableAmount,
            inputTax: totals.taxAmount,
            eligibleItc: roundAmount(eligibleItc),
            ineligibleItc,
            mismatchReason,
            totalAmount: roundAmount(Number(row.totalAmount ?? totals.totalAmount)),
        };
    });

    return c.json({
        ok: true,
        period: { start, end },
        totals: {
            eligibleItc: roundAmount(eligibleTotal),
            ineligibleItc: roundAmount(ineligibleTotal),
        },
        rows,
    });
});

gstComplianceRoute.get('/export/gstr1', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'export')) {
        return c.json({ ok: false, message: 'GST export access denied.' }, 403);
    }

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const format = (c.req.query('format') ?? 'json').toLowerCase();

    const conditions = [eq(transactions.userId, effectiveUserId), eq(transactions.type, 'SALE')];
    if (start) conditions.push(gte(transactions.billDate, start));
    if (end) conditions.push(lte(transactions.billDate, end));

    const db = c.get('db');
    const txnRows = await db
        .select({
            id: transactions.id,
            billNumber: transactions.billNumber,
            billDate: transactions.billDate,
            partyId: transactions.partyId,
            partyName: transactions.partyName,
            items: transactions.items,
            totalAmount: transactions.totalAmount,
        })
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.billDate));

    const partyRows = await db
        .select({ id: parties.id, gstNumber: parties.gstNumber })
        .from(parties)
        .where(eq(parties.userId, effectiveUserId));
    const gstByPartyId = new Map(partyRows.map((row) => [row.id, row.gstNumber]));
    const businessGst = authUser?.gstNumber ?? null;

    const rows = txnRows.map((row) => {
        const partyGstNumber = row.partyId ? (gstByPartyId.get(row.partyId) ?? null) : null;
        const totals = summarizeLineItems(row.items);
        return {
            invoiceId: row.id,
            billNumber: row.billNumber,
            billDate: row.billDate,
            customerName: row.partyName,
            customerGstNumber: partyGstNumber,
            invoiceType: getClassification(partyGstNumber),
            placeOfSupply: getPlaceOfSupply(businessGst, partyGstNumber),
            taxableAmount: totals.taxableAmount,
            taxAmount: totals.taxAmount,
            invoiceTotal: roundAmount(Number(row.totalAmount ?? totals.totalAmount)),
        };
    });

    if (format === 'csv' || format === 'excel') {
        const headers = [
            'invoiceId',
            'billNumber',
            'billDate',
            'customerName',
            'customerGstNumber',
            'invoiceType',
            'placeOfSupply',
            'taxableAmount',
            'taxAmount',
            'invoiceTotal',
        ];
        const dataRows = rows.map((row) => [
            row.invoiceId,
            row.billNumber,
            row.billDate.toISOString(),
            row.customerName,
            row.customerGstNumber,
            row.invoiceType,
            row.placeOfSupply,
            row.taxableAmount,
            row.taxAmount,
            row.invoiceTotal,
        ].map(toSafeCsv).join(','));

        return new Response([headers.join(','), ...dataRows].join('\n'), {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="gstr1-export.csv"',
            },
        });
    }

    return c.json({
        ok: true,
        period: { start, end },
        format: 'json',
        gstr1: rows,
    });
});

gstComplianceRoute.get('/export/gstr3b', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'export')) {
        return c.json({ ok: false, message: 'GST export access denied.' }, 403);
    }

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const format = (c.req.query('format') ?? 'json').toLowerCase();

    const db = c.get('db');
    const conditions = [eq(transactions.userId, effectiveUserId)];
    if (start) conditions.push(gte(transactions.billDate, start));
    if (end) conditions.push(lte(transactions.billDate, end));

    const rows = await db
        .select({
            type: transactions.type,
            partyId: transactions.partyId,
            items: transactions.items,
        })
        .from(transactions)
        .where(and(...conditions));

    const partyRows = await db
        .select({ id: parties.id, gstNumber: parties.gstNumber })
        .from(parties)
        .where(eq(parties.userId, effectiveUserId));
    const gstByPartyId = new Map(partyRows.map((row) => [row.id, row.gstNumber]));

    let outwardTaxable = 0;
    let outwardTax = 0;
    let inwardTaxable = 0;
    let inwardTax = 0;
    let itcEligible = 0;

    for (const row of rows) {
        const partyGstNumber = row.partyId ? (gstByPartyId.get(row.partyId) ?? null) : null;
        const totals = summarizeLineItems(row.items);
        if (row.type === 'SALE') {
            outwardTaxable += totals.taxableAmount;
            outwardTax += totals.taxAmount;
            continue;
        }

        inwardTaxable += totals.taxableAmount;
        inwardTax += totals.taxAmount;
        if (partyGstNumber) {
            itcEligible += totals.taxAmount;
        }
    }

    const summary = {
        outwardTaxable: roundAmount(outwardTaxable),
        outwardTax: roundAmount(outwardTax),
        inwardTaxable: roundAmount(inwardTaxable),
        inwardTax: roundAmount(inwardTax),
        itcEligible: roundAmount(itcEligible),
        itcIneligible: roundAmount(Math.max(inwardTax - itcEligible, 0)),
        netPayable: roundAmount(outwardTax - inwardTax),
    };

    if (format === 'csv' || format === 'excel') {
        const headers = ['field', 'value'];
        const entries = Object.entries(summary).map(([field, value]) => `${toSafeCsv(field)},${toSafeCsv(value)}`);
        return new Response([headers.join(','), ...entries].join('\n'), {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="gstr3b-export.csv"',
            },
        });
    }

    return c.json({
        ok: true,
        period: { start, end },
        format: 'json',
        gstr3b: summary,
    });
});

gstComplianceRoute.get('/notes', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'GST compliance access denied.' }, 403);
    }

    const type = c.req.query('type');
    const status = c.req.query('status');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 1000);

    const conditions = [eq(gstNotes.userId, effectiveUserId)];
    if (type === 'CREDIT' || type === 'DEBIT') conditions.push(eq(gstNotes.type, type));
    if (status === 'open' || status === 'applied' || status === 'canceled') {
        conditions.push(eq(gstNotes.status, status));
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(gstNotes)
        .where(and(...conditions))
        .orderBy(desc(gstNotes.noteDate))
        .limit(limit);

    return c.json({ ok: true, notes: rows });
});

gstComplianceRoute.post('/notes', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'GST note create access denied.' }, 403);
        }

        const payload = z.object({
            type: z.enum(['CREDIT', 'DEBIT']),
            relatedTransactionId: z.string().optional(),
            noteNumber: z.string().optional(),
            noteDate: z.coerce.date().optional(),
            partyId: z.string().optional(),
            partyName: z.string().optional(),
            partyGstNumber: z.string().optional(),
            reason: z.string().optional(),
            items: z.array(z.object({
                itemId: z.string().optional(),
                name: z.string().min(1),
                quantity: z.number().positive(),
                price: z.number().nonnegative(),
                tax: z.number().nonnegative().default(0),
                total: z.number().nonnegative().optional(),
            })).default([]),
        }).parse(await c.req.json());

        const db = c.get('db');
        const noteDate = payload.noteDate ?? new Date();
        const controls = await getBusinessControls(db, effectiveUserId);
        if (controls.periodLockEnabled) {
            await ensurePeriodUnlockedForDate(db, effectiveUserId, noteDate);
        }

        const totals = summarizeLineItems(payload.items);
        const id = nanoid();
        const now = new Date();

        await db.insert(gstNotes).values({
            id,
            userId: effectiveUserId,
            type: payload.type,
            relatedTransactionId: payload.relatedTransactionId ?? null,
            noteNumber: payload.noteNumber ?? null,
            noteDate,
            partyId: payload.partyId ?? null,
            partyName: payload.partyName ?? null,
            partyGstNumber: payload.partyGstNumber ?? null,
            reason: payload.reason ?? null,
            taxableAmount: totals.taxableAmount,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
            status: 'open',
            items: payload.items.map((line) => ({
                itemId: line.itemId,
                name: line.name,
                quantity: line.quantity,
                price: line.price,
                tax: line.tax,
                total: line.total ?? roundAmount((line.quantity * line.price) * (1 + (line.tax / 100))),
            })),
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'gst.note_created',
            entityType: 'gst_note',
            entityId: id,
            after: {
                type: payload.type,
                totalAmount: totals.totalAmount,
                itemCount: payload.items.length,
            },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create GST note.' }, 400);
    }
});

gstComplianceRoute.post('/notes/:id/apply', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'update')) {
        return c.json({ ok: false, message: 'GST note update access denied.' }, 403);
    }

    const id = c.req.param('id');
    const db = c.get('db');
    const updated = await db
        .update(gstNotes)
        .set({ status: 'applied', updatedAt: new Date() })
        .where(and(eq(gstNotes.id, id), eq(gstNotes.userId, effectiveUserId), eq(gstNotes.status, 'open')))
        .returning({ id: gstNotes.id });

    if (!updated[0]) {
        return c.json({ ok: false, message: 'GST note not found or cannot be applied.' }, 404);
    }

    await writeAuditLog(db, {
        userId: effectiveUserId,
        actorUid: authUser.uid,
        actorRole: authUser.role,
        module: 'accounting',
        action: 'gst.note_applied',
        entityType: 'gst_note',
        entityId: id,
        after: { status: 'applied' },
    });

    return c.json({ ok: true, status: 'applied' });
});

gstComplianceRoute.post('/notes/:id/cancel', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'update')) {
        return c.json({ ok: false, message: 'GST note update access denied.' }, 403);
    }

    const id = c.req.param('id');
    const db = c.get('db');
    const updated = await db
        .update(gstNotes)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(and(eq(gstNotes.id, id), eq(gstNotes.userId, effectiveUserId)))
        .returning({ id: gstNotes.id });

    if (!updated[0]) {
        return c.json({ ok: false, message: 'GST note not found.' }, 404);
    }

    await writeAuditLog(db, {
        userId: effectiveUserId,
        actorUid: authUser.uid,
        actorRole: authUser.role,
        module: 'accounting',
        action: 'gst.note_canceled',
        entityType: 'gst_note',
        entityId: id,
        after: { status: 'canceled' },
    });

    return c.json({ ok: true, status: 'canceled' });
});

export default gstComplianceRoute;
