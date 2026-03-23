import { Hono } from 'hono';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { invoices, invoiceItems, items } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    getAccessibleBusiness,
    getRequestedBusinessId,
    getActiveSubscription,
    requireOrganizationAction,
    requireOrganizationCapability,
} from './helpers';
import {
    assertAllowedGstRate,
    assertFeatureFlag,
    assertSubscriptionWriteAllowed,
    bumpMonthlyBillUsage,
} from '../services/subscriptionPolicy';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const posRoute = new Hono<AppEnv>();

posRoute.use('/*', requireAuth);

const posItemSchema = z.object({
    itemId: z.string().optional(),
    description: z.string(),
    quantity: z.number().positive(),
    unit: z.string().optional(),
    rate: z.number().nonnegative(),
    discountPercent: z.number().min(0).max(100).default(0),
    gstRate: z.number().nonnegative().default(0),
    isInterState: z.boolean().default(false),
});

const createPosSaleSchema = z.object({
    partyId: z.string().optional(),
    items: z.array(posItemSchema).min(1),
    paymentMode: z.enum(['CASH', 'CARD', 'UPI', 'BANK']).default('CASH'),
    paidAmount: z.number().nonnegative(),
    discountAmount: z.number().nonnegative().default(0),
    roundOffAmount: z.number().default(0),
    notes: z.string().optional(),
    placeOfSupply: z.string().optional(),
    date: z.string().datetime().optional(),
});

// Create POS sale
posRoute.post('/sale', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const denied = requireOrganizationCapability(c, 'pos.write');
    if (denied) return denied;
    const deniedAction = requireOrganizationAction(c, 'billing.create');
    if (deniedAction) return deniedAction;

    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertFeatureFlag(subscription, 'POS_MODE');
    assertFeatureFlag(subscription, 'GST_INVOICES');

    try {
        const body = createPosSaleSchema.parse(await c.req.json());
        for (const item of body.items) {
            assertAllowedGstRate(Number(item.gstRate ?? 0));
        }

        // Auto-generate POS invoice number
        const [lastInv] = await db
            .select({ num: sql<string>`COALESCE(MAX(CAST(regexp_replace(invoice_number, '[^0-9]', '', 'g') AS INTEGER)), 0)::text` })
            .from(invoices)
            .where(and(eq(invoices.businessId, business.id), eq(invoices.invoiceType, 'POS_BILL')));

        const nextNum = (Number(lastInv?.num ?? 0) + 1).toString().padStart(4, '0');
        const invoiceNumber = `POS-${nextNum}`;
        const now = new Date();
        const invoiceDate = body.date ? new Date(body.date) : now;

        let totalTaxable = 0;
        let totalTax = 0;
        const gstBreakup: Record<string, unknown> = {};

        const lineItems = body.items.map((item, idx) => {
            const discountAmt = (item.rate * item.quantity * item.discountPercent) / 100;
            const taxableVal = item.rate * item.quantity - discountAmt;
            const halfGst = item.gstRate / 2;
            const cgstAmt = item.isInterState ? 0 : (taxableVal * halfGst) / 100;
            const sgstAmt = item.isInterState ? 0 : (taxableVal * halfGst) / 100;
            const igstAmt = item.isInterState ? (taxableVal * item.gstRate) / 100 : 0;
            totalTaxable += taxableVal;
            totalTax += cgstAmt + sgstAmt + igstAmt;

            const key = `${item.gstRate}`;
            const existing = (gstBreakup[key] as { taxable: number; cgst: number; sgst: number; igst: number }) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
            gstBreakup[key] = {
                taxable: existing.taxable + taxableVal,
                cgst: existing.cgst + cgstAmt,
                sgst: existing.sgst + sgstAmt,
                igst: existing.igst + igstAmt,
            };

            return {
                id: `invitm_${nanoid(16)}`,
                invoiceId: '',
                itemId: item.itemId ?? null,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit ?? null,
                rate: item.rate,
                discountPercent: item.discountPercent,
                discountAmount: discountAmt,
                taxableValue: taxableVal,
                cgstRate: item.isInterState ? 0 : halfGst,
                cgstAmount: cgstAmt,
                sgstRate: item.isInterState ? 0 : halfGst,
                sgstAmount: sgstAmt,
                igstRate: item.isInterState ? item.gstRate : 0,
                igstAmount: igstAmt,
                cessRate: 0,
                cessAmount: 0,
                sortOrder: idx,
                createdAt: now,
            };
        });

        const totalInvoiceValue = totalTaxable + totalTax + body.roundOffAmount - body.discountAmount;
        const paymentStatus = body.paidAmount >= totalInvoiceValue ? 'PAID' as const : 'PARTIALLY_PAID' as const;
        const invoiceId = `inv_${nanoid(18)}`;

        await db.transaction(async (tx) => {
            const itemIds = Array.from(new Set(body.items.map((entry) => entry.itemId).filter(Boolean))) as string[];
            const stockRows = itemIds.length > 0
                ? await tx
                    .select()
                    .from(items)
                    .where(and(eq(items.businessId, business.id), inArray(items.id, itemIds)))
                : [];
            const stockById = new Map(stockRows.map((entry) => [entry.id, entry]));

            for (const line of body.items) {
                if (!line.itemId) continue;
                const item = stockById.get(line.itemId);
                if (!item) {
                    throw new Error('Selected item does not exist.');
                }

                const availableStock = Number(item.stock ?? 0);
                const trackStock = true;
                if (trackStock && line.quantity > availableStock) {
                    throw new Error(`Insufficient stock for ${item.name}. Available ${availableStock}, requested ${line.quantity}.`);
                }

                stockById.set(line.itemId, {
                    ...item,
                    stock: trackStock ? availableStock - line.quantity : availableStock,
                });
            }

            await tx.insert(invoices).values({
                id: invoiceId,
                businessId: business.id,
                invoiceType: 'POS_BILL',
                invoiceNumber,
                invoiceDate,
                partyId: body.partyId ?? null,
                placeOfSupply: body.placeOfSupply ?? null,
                totalTaxableValue: totalTaxable,
                totalTaxAmount: totalTax,
                totalInvoiceValue,
                discountAmount: body.discountAmount,
                roundOffAmount: body.roundOffAmount,
                additionalCharges: 0,
                reverseCharge: false,
                gstRateBreakupJson: gstBreakup,
                paymentStatus,
                paidAmount: body.paidAmount,
                notes: body.notes ?? null,
                createdByUserId: authUser.id,
                isDeleted: false,
                createdAt: now,
                updatedAt: now,
            });

            const liWithId = lineItems.map((li) => ({ ...li, invoiceId }));
            if (liWithId.length > 0) await tx.insert(invoiceItems).values(liWithId);

            for (const li of lineItems) {
                if (li.itemId) {
                    await tx.update(items).set({ stock: sql`${items.stock} - ${li.quantity}`, updatedAt: now }).where(eq(items.id, li.itemId));
                }
            }

            await bumpMonthlyBillUsage(tx, business.id, subscription, invoiceDate);
        });

        const [created] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
        return c.json({ ok: true, data: created, invoiceNumber }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'POS sale failed.' }, 400);
    }
});

export default posRoute;
