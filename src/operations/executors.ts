import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DrizzleClient } from '../db/client';
import { accounts, inventoryMovements, items, journalEntries, journalLines } from '../db/schema';

export interface JournalLineInput {
    accountId: string;
    partyId?: string;
    debit: number;
    credit: number;
    hsn?: string;
    gstRate?: number;
    taxType?: 'CGST' | 'SGST' | 'IGST' | 'CESS';
}

export interface JournalEntryInput {
    branchId?: string;
    costCenter?: string;
    projectCode?: string;
    entryDate?: Date;
    batchNumber?: string;
    referenceType?: string;
    referenceId?: string;
    narration?: string;
    currency?: string;
    lines: JournalLineInput[];
}

export interface StockAdjustmentInput {
    itemId: string;
    type: 'IN' | 'OUT';
    quantity: number;
    reason?: string;
}

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const createJournalEntryInTx = async (
    tx: DrizzleClient,
    userId: string,
    payload: JournalEntryInput,
    now = new Date()
): Promise<string> => {
    if (payload.lines.length < 2) {
        throw new Error('Journal entry requires at least two lines.');
    }

    const totalDebit = roundAmount(payload.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0));
    const totalCredit = roundAmount(payload.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0));
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error('Journal entry is not balanced.');
    }

    const uniqueAccountIds = [...new Set(payload.lines.map((line) => line.accountId))];
    const accountRows = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), inArray(accounts.id, uniqueAccountIds)));

    if (accountRows.length !== uniqueAccountIds.length) {
        throw new Error('One or more accounts are invalid for this business.');
    }

    const entryId = nanoid();
    await tx.insert(journalEntries).values({
        id: entryId,
        userId,
        branchId: payload.branchId ?? null,
        costCenter: payload.costCenter ?? null,
        projectCode: payload.projectCode ?? null,
        entryDate: payload.entryDate ?? now,
        batchNumber: payload.batchNumber ?? null,
        referenceType: payload.referenceType ?? null,
        referenceId: payload.referenceId ?? null,
        narration: payload.narration ?? null,
        currency: (payload.currency ?? 'INR').toUpperCase(),
        createdAt: now,
    });

    for (const line of payload.lines) {
        await tx.insert(journalLines).values({
            id: nanoid(),
            entryId,
            userId,
            accountId: line.accountId,
            partyId: line.partyId ?? null,
            debit: Number(line.debit ?? 0),
            credit: Number(line.credit ?? 0),
            hsn: line.hsn ?? null,
            gstRate: Number(line.gstRate ?? 0),
            taxType: line.taxType ?? null,
            createdAt: now,
        });
    }

    return entryId;
};

export const applyStockAdjustmentInTx = async (
    tx: DrizzleClient,
    userId: string,
    payload: StockAdjustmentInput,
    now = new Date()
): Promise<{ itemId: string; previousStock: number; newStock: number }> => {
    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
        throw new Error('Quantity must be greater than 0.');
    }

    const itemRows = await tx
        .select()
        .from(items)
        .where(and(eq(items.id, payload.itemId), eq(items.userId, userId)))
        .limit(1);

    const item = itemRows[0];
    if (!item) throw new Error('Item not found.');

    const previousStock = Number(item.stock ?? 0);
    let newStock = previousStock;
    if (payload.type === 'IN') {
        newStock += payload.quantity;
    } else {
        if (previousStock < payload.quantity) {
            throw new Error(`Insufficient stock. Available: ${previousStock}`);
        }
        newStock -= payload.quantity;
    }

    const updateConditions = [eq(items.id, payload.itemId), eq(items.userId, userId)];
    if (payload.type === 'OUT') {
        updateConditions.push(gte(items.stock, payload.quantity));
    }

    const updatedRows = await tx
        .update(items)
        .set({
            stock: sql`${items.stock} + ${payload.type === 'IN' ? payload.quantity : -payload.quantity}`,
            updatedAt: now,
        })
        .where(and(...updateConditions))
        .returning({ stock: items.stock });

    const updated = updatedRows[0];
    if (!updated) {
        throw new Error(`Insufficient stock. Available: ${previousStock}`);
    }

    newStock = Number(updated.stock ?? newStock);

    await tx.insert(inventoryMovements).values({
        id: nanoid(),
        userId,
        itemId: payload.itemId,
        transactionId: null,
        movementType: payload.type === 'IN' ? 'ADJUST_IN' : 'ADJUST_OUT',
        quantity: payload.quantity,
        balanceAfter: newStock,
        unitCost: null,
        createdAt: now,
    });

    return {
        itemId: payload.itemId,
        previousStock,
        newStock,
    };
};
