import { db } from '../db/client';
import { eq } from 'drizzle-orm';
import { SyncActionType } from './syncQueueTypes';
import { apiClient } from '../api/httpClient';
import { useNetworkStore, waitForHydration } from '../store';
import type { NewDbItem, NewDbParty, NewDbTransaction } from '../types/db';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { transactions, parties, items, syncQueue } from '../db/schema';
const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

type SyncData =
  | NewDbItem
  | NewDbParty
  | NewDbTransaction
  | { id: string }
  | (Partial<NewDbItem> & { id: string })
  | (Partial<NewDbParty> & { id: string })
  | (Partial<NewDbTransaction> & { id: string })
  | { key: string; value: string };

class SyncService {
  private isSyncing = false;
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private networkConnected = true;

  onNetworkStateChange(isConnected: boolean) {
    this.networkConnected = isConnected;
    if (isConnected) {
      void this.startSync();
    }
  }

  async registerBackgroundSync() {
    try {
      const status = await BackgroundTask.getStatusAsync();
      if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
        console.warn('Background fetch is restricted');
        return;
      }

      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
      });
      console.log('Background sync registered');
    } catch (err) {
      console.error('Task Register failed:', err);
    }
  }

  startAutoSync(intervalMs = 60000) {
    this.stopAutoSync();
    this.autoSyncInterval = setInterval(() => {
      void this.startSync();
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  async startSync() {
    if (this.isSyncing) return;

    // Check network store (redundant safety)
    const netState = useNetworkStore.getState();
    if (netState.isConnected === false) return;

    this.isSyncing = true;
    useNetworkStore.getState().setSyncStatus('SYNCING');

    try {
      await this.flushQueue();
      await this.pullChanges();

      useNetworkStore.getState().setSyncStatus('IDLE');
      useNetworkStore.getState().setLastSyncTime(new Date().toISOString());
    } catch (error) {
      console.error('Sync failed:', error);
      useNetworkStore.getState().setSyncStatus('ERROR');
    } finally {
      this.isSyncing = false;
    }
  }

  async pullChanges() {
    const lastSync = useNetworkStore.getState().lastSyncTime;
    const params = lastSync ? { after: lastSync } : {};

    // 1. Items
    try {
      const itemsData = await apiClient.get<NewDbItem[]>('/items', { params });
      if (Array.isArray(itemsData) && itemsData.length > 0) {

        await db.transaction(async (tx) => {
          for (const item of itemsData) {
            await tx.insert(items)
              .values(item)
              .onConflictDoUpdate({ target: items.id, set: item });
          }
        });
      }
    } catch (e) {
      console.error('Failed to pull items', e);
    }

    // 2. Parties
    try {
      const partiesData = await apiClient.get<NewDbParty[]>('/parties', { params });
      if (Array.isArray(partiesData) && partiesData.length > 0) {

        await db.transaction(async (tx) => {
          for (const party of partiesData) {
            await tx.insert(parties)
              .values(party)
              .onConflictDoUpdate({ target: parties.id, set: party });
          }
        });
      }
    } catch (e) {
      console.error('Failed to pull parties', e);
    }

    // 3. Transactions
    try {
      const transactionsData = await apiClient.get<NewDbTransaction[]>('/transactions', { params });
      if (Array.isArray(transactionsData) && transactionsData.length > 0) {

        await db.transaction(async (tx) => {
          for (const txData of transactionsData) {
            await tx.insert(transactions)
              .values(txData)
              .onConflictDoUpdate({ target: transactions.id, set: txData });
          }
        });
      }
    } catch (e) {
      console.error('Failed to pull transactions', e);
    }
  }

  async getQueueStats() {
    const result = await db.select({
      count: syncQueue.id,
      createdAt: syncQueue.createdAt,
    })
      .from(syncQueue)
      .where(eq(syncQueue.status, 'PENDING'));

    const pendingCount = result.length;
    const oldestCreatedAt = result.length > 0
      ? result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt
      : null;

    return {
      pendingCount,
      oldestCreatedAt,
    };
  }

  async flushQueue() {
    // 1. Get Pending Items
    const pendingItems = await db.select()
      .from(syncQueue)
      .where(eq(syncQueue.status, 'PENDING'))
      .limit(50);

    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      try {
        // Mark as syncing (optional, usually we just keep pending until success)
        // await db.update(syncQueue).set({ status: 'SYNCING' }).where(eq(syncQueue.id, item.id));

        const payload = JSON.parse(item.data) as SyncData;
        await this.processItem(item.action as SyncActionType, payload);

        await db.delete(syncQueue).where(eq(syncQueue.id, item.id));
      } catch (error) {
        console.error(`Failed to process sync item ${item.id}`, error);
        // Increment retry or keep pending
      }
    }

    // Recursive check if more items exist
    const remaining = await db.select({ id: syncQueue.id }).from(syncQueue).where(eq(syncQueue.status, 'PENDING')).limit(1);
    if (remaining.length > 0) {
      await this.flushQueue();
    }
  }


  private async processItem(action: SyncActionType, data: SyncData) {
    // Ensure IDs are present
    switch (action) {
      case 'CREATE_ITEM': {
        const payload = data as NewDbItem;
        await apiClient.post('/items', payload);
        break;
      }
      case 'UPDATE_ITEM': {
        const payload = data as Partial<NewDbItem> & { id: string };
        await apiClient.put(`/items/${payload.id}`, payload);
        break;
      }
      case 'DELETE_ITEM': {
        const payload = data as { id: string };
        await apiClient.delete(`/items/${payload.id}`);
        break;
      }

      case 'CREATE_PARTY': {
        const payload = data as NewDbParty;
        await apiClient.post('/parties', payload);
        break;
      }
      case 'UPDATE_PARTY': {
        const payload = data as Partial<NewDbParty> & { id: string };
        await apiClient.put(`/parties/${payload.id}`, payload);
        break;
      }
      case 'DELETE_PARTY': {
        const payload = data as { id: string };
        await apiClient.delete(`/parties/${payload.id}`);
        break;
      }

      case 'CREATE_TRANSACTION': {
        const payload = data as NewDbTransaction;
        // Prepare payload for API (remove internal fields if any)
        // The API likely expects 'items' array which we have in data
        await apiClient.post('/transactions', payload);
        break;
      }
      case 'UPDATE_TRANSACTION': {
        const payload = data as Partial<NewDbTransaction> & { id: string };
        await apiClient.put(`/transactions/${payload.id}`, payload);
        break;
      }

      case 'UPDATE_SETTINGS': {
        const payload = data as { key: string; value: string };
        await apiClient.put(`/settings/${payload.key}`, { value: payload.value });
        break;
      }

      default:
        console.warn('Unknown sync action:', action);
    }
  }
}

export const syncService = new SyncService();

// Register the background task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await waitForHydration();
    const now = new Date();
    await syncService.startSync();
    console.log(`Background sync executed at ${now.toISOString()}`);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('Background sync failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
