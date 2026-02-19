import { BaseRepository } from './baseRepository';
import { db } from '../db/client';
import { items } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { DbItem, NewDbItem } from '../types/db';

export class ItemRepository extends BaseRepository {
  async getAll(organizationId: string): Promise<DbItem[]> {
    return await db.select().from(items).where(
      and(
        eq(items.organizationId, organizationId),
        eq(items.isActive, true)
      )
    );
  }

  async getById(id: string): Promise<DbItem | null> {
    const result = await db.select().from(items).where(eq(items.id, id));
    return result[0] || null;
  }

  async create(item: NewDbItem) {
    const now = new Date().toISOString();
    const itemWithTimestamps = {
      ...item,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(items).values(itemWithTimestamps);
    await this.enqueueAction('CREATE_ITEM', itemWithTimestamps);
  }

  async update(id: string, updates: Partial<NewDbItem>) {
    const now = new Date().toISOString();
    const updateData = {
      ...updates,
      updatedAt: now,
    };

    await db.update(items)
      .set(updateData)
      .where(eq(items.id, id));

    const updatedItem = await db.select().from(items).where(eq(items.id, id)).get();
    if (updatedItem) {
      await this.enqueueAction('UPDATE_ITEM', updatedItem);
    }
  }

  async delete(id: string, organizationId: string) {
    const now = new Date().toISOString();

    // Soft Delete locally
    await db.update(items)
      .set({ isActive: false, updatedAt: now })
      .where(eq(items.id, id));

    // Queue for Sync
    await this.enqueueAction('DELETE_ITEM', { id, organizationId });
  }
}

export const itemRepository = new ItemRepository();
