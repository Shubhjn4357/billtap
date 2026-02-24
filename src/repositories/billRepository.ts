import { BaseRepository } from './baseRepository';
import { db } from '../db/client';
import { transactions, items, syncQueue } from '../db/schema';
import { eq, and, desc, ne, inArray } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { SyncActionType } from '../services/syncQueueTypes';
import type { DbTransaction, NewDbTransaction } from '../types/db';

export { DbTransaction, NewDbTransaction };

type SnapshotLine = {
    id: string;
    name?: string;
    quantity: number;
};

type StockDeltaEntry = {
    delta: number;
    label: string;
};

export class BillRepository extends BaseRepository {
    private getStockDirection(type: string | null | undefined): -1 | 0 | 1 {
        if (type === 'SALE' || type === 'RETURN_OUTWARD') return -1;
        if (type === 'PURCHASE' || type === 'RETURN_INWARD') return 1;
        return 0;
    }

    private parseItemsSnapshot(itemsSnapshot: string | null | undefined): SnapshotLine[] {
        if (!itemsSnapshot) return [];

        try {
            const parsed = JSON.parse(itemsSnapshot);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .map((line) => {
                    if (!line || typeof line !== 'object') return null;
                    const candidate = line as Record<string, unknown>;
                    const id = typeof candidate.id === 'string' ? candidate.id : '';
                    const quantity = Number(candidate.quantity ?? 0);
                    const name = typeof candidate.name === 'string' ? candidate.name : id;
                    if (!id || !Number.isFinite(quantity) || quantity <= 0) return null;

                    return {
                        id,
                        name,
                        quantity,
                    } as SnapshotLine;
                })
                .filter((line): line is SnapshotLine => line !== null);
        } catch {
            return [];
        }
    }

    private buildStockDelta(type: string | null | undefined, itemsSnapshot: string | null | undefined): Map<string, StockDeltaEntry> {
        const direction = this.getStockDirection(type);
        const lines = this.parseItemsSnapshot(itemsSnapshot);
        const stockDelta = new Map<string, StockDeltaEntry>();

        if (direction === 0 || lines.length === 0) return stockDelta;

        lines.forEach((line) => {
            const signedQty = direction * line.quantity;
            const existing = stockDelta.get(line.id);
            stockDelta.set(line.id, {
                delta: (existing?.delta ?? 0) + signedQty,
                label: existing?.label ?? line.name ?? line.id,
            });
        });

        return stockDelta;
    }

    private mergeStockDelta(
        left: Map<string, StockDeltaEntry>,
        right: Map<string, StockDeltaEntry>,
        rightMultiplier = 1
    ): Map<string, StockDeltaEntry> {
        const output = new Map<string, StockDeltaEntry>();

        left.forEach((entry, itemId) => {
            output.set(itemId, { ...entry });
        });

        right.forEach((entry, itemId) => {
            const existing = output.get(itemId);
            output.set(itemId, {
                delta: (existing?.delta ?? 0) + (entry.delta * rightMultiplier),
                label: existing?.label ?? entry.label,
            });
        });

        return output;
    }

    private async enqueueActionTx(tx: any, action: SyncActionType, data: unknown, now: string) {
        await tx.insert(syncQueue).values({
            id: randomUUID(),
            action,
            data: JSON.stringify(data),
            status: 'PENDING',
            retryCount: 0,
            createdAt: now,
            updatedAt: now,
        });
    }

    private async applyStockDeltaTx(
        tx: any,
        organizationId: string | null | undefined,
        stockDelta: Map<string, StockDeltaEntry>,
        now: string
    ) {
        if (stockDelta.size === 0) return;

        const itemIds = Array.from(stockDelta.keys());
        if (itemIds.length === 0) return;

        const scopedItems = organizationId
            ? await tx
                .select()
                .from(items)
                .where(and(eq(items.organizationId, organizationId), inArray(items.id, itemIds)))
            : await tx
                .select()
                .from(items)
                .where(inArray(items.id, itemIds));

        const itemById = new Map<string, any>(scopedItems.map((entry: any) => [entry.id as string, entry]));
        const missing: string[] = [];
        const insufficient: string[] = [];

        stockDelta.forEach((entry, itemId) => {
            const row = itemById.get(itemId);
            if (!row) {
                missing.push(entry.label || itemId);
                return;
            }

            const currentStock = Number(row.stock ?? 0);
            const nextStock = currentStock + entry.delta;
            if (nextStock < 0) {
                insufficient.push(`${entry.label || itemId} (available ${currentStock}, required ${Math.abs(entry.delta)})`);
            }
        });

        if (missing.length || insufficient.length) {
            const parts: string[] = [];
            if (missing.length) {
                parts.push(`Missing inventory items: ${missing.join(', ')}`);
            }
            if (insufficient.length) {
                parts.push(`Insufficient stock: ${insufficient.join(', ')}`);
            }
            throw new Error(parts.join('\n'));
        }

        for (const [itemId, entry] of stockDelta.entries()) {
            if (entry.delta === 0) continue;
            const row = itemById.get(itemId);
            if (!row) continue;

            const nextStock = Number(row.stock ?? 0) + entry.delta;
            const updatedItem = {
                ...row,
                stock: nextStock,
                updatedAt: now,
            };

            await tx
                .update(items)
                .set({
                    stock: nextStock,
                    updatedAt: now,
                })
                .where(eq(items.id, itemId));

            await this.enqueueActionTx(tx, 'UPDATE_ITEM', updatedItem, now);
        }
    }

    async getAll(organizationId: string): Promise<DbTransaction[]> {
        return await db.select().from(transactions)
            .where(eq(transactions.organizationId, organizationId))
            .orderBy(desc(transactions.billDate));
    }

    async getById(id: string): Promise<DbTransaction | null> {
        const result = await db.select().from(transactions).where(eq(transactions.id, id));
        return result[0] || null;
    }

    async create(transaction: NewDbTransaction) {
        const now = new Date().toISOString();
        // ensure we always have a snapshot string; avoids undefined during sync
        const data = {
            ...transaction,
            itemsSnapshot: transaction.itemsSnapshot ?? JSON.stringify([]),
            createdAt: now,
            updatedAt: now,
        };

        await db.transaction(async (tx) => {
            await tx.insert(transactions).values(data);

            const stockDelta = this.buildStockDelta(data.type, data.itemsSnapshot);
            await this.applyStockDeltaTx(tx, data.organizationId, stockDelta, now);

            await this.enqueueActionTx(tx, 'CREATE_TRANSACTION', data, now);
        });
    }

    async checkBillNumberAvailability(billNumber: string, organizationId: string): Promise<boolean> {
        const result = await db.select({ id: transactions.id })
            .from(transactions)
            .where(and(
                eq(transactions.billNumber, billNumber),
                eq(transactions.organizationId, organizationId)
            ));
        return result.length === 0;
    }
    async getUnpaid(organizationId: string) {
        const result = await db.select().from(transactions)
            .where(and(
                eq(transactions.organizationId, organizationId),
                ne(transactions.paymentStatus, 'PAID')
            ))
            .orderBy(desc(transactions.dueDate));
        return result;
    }

    async updatePayment(id: string, updates: { paidAmount: number; paymentStatus: string; paymentMode?: string }) {
        const now = new Date().toISOString();
        const updateData = {
            paidAmount: updates.paidAmount,
            paymentStatus: updates.paymentStatus,
            updatedAt: now,
            ...(updates.paymentMode ? { paymentMode: updates.paymentMode } : {}),
        };

        await db.update(transactions)
            .set(updateData)
            .where(eq(transactions.id, id));

        await this.enqueueAction('UPDATE_TRANSACTION', { id, ...updates, updatedAt: now });
    }

    async update(id: string, transaction: NewDbTransaction) {
        const now = new Date().toISOString();
        const data = {
            ...transaction,
            id,
            itemsSnapshot: transaction.itemsSnapshot ?? JSON.stringify([]),
            updatedAt: now,
        };

        await db.transaction(async (tx) => {
            const previous = await tx.select().from(transactions).where(eq(transactions.id, id)).get();
            if (!previous) {
                throw new Error('Transaction not found');
            }

            const previousDelta = this.buildStockDelta(previous.type, previous.itemsSnapshot);
            const nextDelta = this.buildStockDelta(data.type, data.itemsSnapshot);
            const deltaToApply = this.mergeStockDelta(nextDelta, previousDelta, -1);

            await this.applyStockDeltaTx(tx, data.organizationId ?? previous.organizationId, deltaToApply, now);

            await tx.update(transactions)
                .set(data)
                .where(eq(transactions.id, id));

            await this.enqueueActionTx(tx, 'UPDATE_TRANSACTION', data, now);
        });
    }

    async delete(id: string) {
        const now = new Date().toISOString();

        await db.transaction(async (tx) => {
            const existing = await tx.select().from(transactions).where(eq(transactions.id, id)).get();
            if (!existing) {
                return;
            }

            const previousDelta = this.buildStockDelta(existing.type, existing.itemsSnapshot);
            const reverseDelta = new Map<string, StockDeltaEntry>();
            previousDelta.forEach((entry, itemId) => {
                reverseDelta.set(itemId, {
                    delta: -entry.delta,
                    label: entry.label,
                });
            });

            await this.applyStockDeltaTx(tx, existing.organizationId, reverseDelta, now);

            await tx.delete(transactions).where(eq(transactions.id, id));
            await this.enqueueActionTx(tx, 'DELETE_TRANSACTION', { id }, now);
        });
    }
}

export const billRepository = new BillRepository();
