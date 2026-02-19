import { BaseRepository } from './baseRepository';
import { db } from '../db/client';
import { accounts } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { DbAccount, NewDbAccount } from '../types/db';

export class AccountRepository extends BaseRepository {
    async getAll(organizationId: string): Promise<DbAccount[]> {
        return await db.select().from(accounts).where(eq(accounts.organizationId, organizationId));
    }

    async getById(id: string): Promise<DbAccount | null> {
        const result = await db.select().from(accounts).where(eq(accounts.id, id));
        return result[0] || null;
    }

    async create(account: NewDbAccount) {
        const now = new Date().toISOString();
        const accountWithTimestamps = {
            ...account,
            createdAt: now,
            updatedAt: now,
        };
        await db.insert(accounts).values(accountWithTimestamps);
        // await this.enqueueAction('CREATE_ACCOUNT', accountWithTimestamps); // Sync later
    }

    async updateBalance(id: string, amount: number, operation: 'CREDIT' | 'DEBIT') {
        const account = await this.getById(id);
        if (!account) throw new Error('Account not found');

        const newBalance = operation === 'CREDIT'
            ? (account.balance ?? 0) + amount
            : (account.balance ?? 0) - amount;

        const now = new Date().toISOString();

        await db.update(accounts)
            .set({ balance: newBalance, updatedAt: now })
            .where(eq(accounts.id, id));

        // No sync queue for balance yet, relying on transaction log sync?
        // Or should sync the balance update?
        // For now, local only.
    }
}

export const accountRepository = new AccountRepository();
