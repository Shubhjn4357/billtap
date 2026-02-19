import { BaseRepository } from './baseRepository';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DbTransaction, NewDbTransaction } from '../types/db';

export class BillRepository extends BaseRepository {
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
        const data = {
            ...transaction,
            createdAt: now,
            updatedAt: now,
        };

        // 1. Local Insert
        await db.insert(transactions).values(data);

        // 2. Sync Queue
        await this.enqueueAction('CREATE_TRANSACTION', data);
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

    async updatePayment(id: string, updates: { paidAmount: number; paymentStatus: string }) {
        const now = new Date().toISOString();
        await db.update(transactions)
            .set({
                paidAmount: updates.paidAmount,
                paymentStatus: updates.paymentStatus,
                updatedAt: now
            })
            .where(eq(transactions.id, id));

        await this.enqueueAction('UPDATE_TRANSACTION', { id, ...updates });
    }

    async update(id: string, transaction: NewDbTransaction) {
        const now = new Date().toISOString();
        const data = {
            ...transaction,
            updatedAt: now,
        };

        // 1. Local Update
        await db.update(transactions)
            .set(data)
            .where(eq(transactions.id, id));

        // 2. Sync Queue
        await this.enqueueAction('UPDATE_TRANSACTION', data);
    }
}

export const billRepository = new BillRepository();
