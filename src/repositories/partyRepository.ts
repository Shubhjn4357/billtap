import { BaseRepository } from './baseRepository';
import { db } from '../db/client';
import { parties } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { DbParty, NewDbParty } from '../types/db';

export class PartyRepository extends BaseRepository {
    async getAll(organizationId: string, type?: 'customer' | 'supplier'): Promise<DbParty[]> {
        const conditions = [
            eq(parties.organizationId, organizationId),
            eq(parties.isActive, true)
        ];

        if (type) {
            conditions.push(eq(parties.type, type));
        }

        return await db.select().from(parties).where(and(...conditions));
    }

    async create(party: NewDbParty) {
        const now = new Date().toISOString();
        const data = {
            ...party,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(parties).values(data);
        await this.enqueueAction('CREATE_PARTY', data);
    }

    async update(id: string, updates: Partial<NewDbParty>) {
        const now = new Date().toISOString();
        const updateData = {
            ...updates,
            updatedAt: now,
        };

        await db.update(parties)
            .set(updateData)
            .where(eq(parties.id, id));

        // For sync, we might want the full object or just the updates + id
        // Usually full object is safer for idempotency, or specific delta.
        // SyncService expects full object usually?
        // Let's assume full object is better, but we don't have it here easily without fetch.
        // However, updates usually contain enough for API if it supports PATCH.
        // If API expects PUT (replace), we need full object.
        // syncService code suggests `apiClient.put` which implies replacement or full update.
        // Let's fetch the updated party to be safe for sync.

        const updatedParty = await db.select().from(parties).where(eq(parties.id, id)).get();
        if (updatedParty) {
            await this.enqueueAction('UPDATE_PARTY', updatedParty);
        }
    }

    async delete(id: string, organizationId: string) {
        const now = new Date().toISOString();
        await db.update(parties)
            .set({ isActive: false, updatedAt: now })
            .where(eq(parties.id, id));

        await this.enqueueAction('DELETE_PARTY', { id, organizationId });
    }
}

export const partyRepository = new PartyRepository();
