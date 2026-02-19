import { db } from '../db/client';
import { syncQueue } from '../db/schema';
import { nanoid } from 'nanoid/non-secure';
import type { SyncActionType } from '../services/syncQueueTypes';

export class BaseRepository {
  protected async enqueueAction(action: SyncActionType, data: any) {
    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(syncQueue).values({
      id,
      action,
      data: JSON.stringify(data),
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }
}
