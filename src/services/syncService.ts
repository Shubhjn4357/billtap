import { db } from '../db/client';
import { asc, eq, or, sql } from 'drizzle-orm';
import { SyncActionType } from './syncQueueTypes';
import { apiClient } from '../api/httpClient';
import { useNetworkStore, waitForHydration } from '../store';
import type { NewDbItem, NewDbParty, NewDbTransaction } from '../types/db';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { transactions, parties, items, syncQueue } from '../db/schema';
import { notifySyncComplete } from './notificationService';
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

type ServerListResponse<T> = {
  ok?: boolean;
  message?: string;
  items?: T[];
  parties?: T[];
  transactions?: T[];
};

const toIsoString = (value: unknown, fallback = new Date().toISOString()): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }
  return fallback;
};

const asNumber = (value: unknown, fallback = 0): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

const normalizeItemFromServer = (raw: unknown): NewDbItem | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : '';
  const organizationId = typeof item.organizationId === 'string'
    ? item.organizationId
    : (typeof item.userId === 'string' ? item.userId : '');
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!id || !organizationId || !name) return null;

  const nowIso = new Date().toISOString();
  const createdAt = toIsoString(item.createdAt, nowIso);
  const updatedAt = toIsoString(item.updatedAt, createdAt);

  return {
    id,
    organizationId,
    branchId: typeof item.branchId === 'string' ? item.branchId : null,
    name,
    nameLowercase: typeof item.nameLowercase === 'string' && item.nameLowercase.trim().length > 0
      ? item.nameLowercase
      : name.toLowerCase(),
    price: asNumber(item.price, 0),
    purchasePrice: asNumber(item.purchasePrice, 0),
    mrp: asNumber(item.mrp, 0),
    hsn: typeof item.hsn === 'string' ? item.hsn : null,
    gstPercentage: asNumber(item.gstPercentage, 0),
    stock: Math.trunc(asNumber(item.stock, 0)),
    minimumStock: Math.trunc(asNumber(item.minimumStock, 0)),
    openingStock: Math.trunc(asNumber(item.openingStock, 0)),
    unit: typeof item.unit === 'string' ? item.unit : 'pcs',
    category: typeof item.category === 'string' ? item.category : null,
    subcategory: typeof item.subcategory === 'string' ? item.subcategory : null,
    location: typeof item.location === 'string' ? item.location : null,
    image: typeof item.imageUrl === 'string'
      ? item.imageUrl
      : (typeof item.image === 'string' ? item.image : null),
    barcode: typeof item.barcode === 'string' ? item.barcode : null,
    expiresAt: item.expiresAt ? toIsoString(item.expiresAt, createdAt) : null,
    autoDeleteAt: item.autoDeleteAt ? toIsoString(item.autoDeleteAt, createdAt) : null,
    autoDeleteEnabled: asBoolean(item.autoDeleteEnabled, false),
    isActive: asBoolean(item.isActive, true),
    createdAt,
    updatedAt,
  };
};

const normalizePartyFromServer = (raw: unknown): NewDbParty | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const party = raw as Record<string, unknown>;
  const id = typeof party.id === 'string' ? party.id : '';
  const name = typeof party.name === 'string' ? party.name.trim() : '';
  if (!id || !name) return null;

  const nowIso = new Date().toISOString();
  const createdAt = toIsoString(party.createdAt, nowIso);
  const updatedAt = toIsoString(party.updatedAt, createdAt);
  const type = party.type === 'supplier' ? 'supplier' : 'customer';

  return {
    id,
    organizationId: typeof party.organizationId === 'string'
      ? party.organizationId
      : (typeof party.userId === 'string' ? party.userId : null),
    name,
    nameLowercase: typeof party.nameLowercase === 'string' && party.nameLowercase.trim().length > 0
      ? party.nameLowercase
      : name.toLowerCase(),
    type,
    phone: typeof party.phone === 'string' ? party.phone : null,
    email: typeof party.email === 'string' ? party.email : null,
    address: typeof party.address === 'string' ? party.address : null,
    gstNumber: typeof party.gstNumber === 'string' ? party.gstNumber : null,
    isActive: asBoolean(party.isActive, true),
    createdAt,
    updatedAt,
  };
};

const normalizePaymentStatus = (status: unknown, totalAmount: number, paidAmount: number): 'PAID' | 'PARTIAL' | 'PENDING' => {
  if (status === 'PAID' || status === 'PARTIAL' || status === 'PENDING') {
    return status;
  }
  if (paidAmount >= totalAmount) return 'PAID';
  if (paidAmount > 0) return 'PARTIAL';
  return 'PENDING';
};

const normalizeTransactionFromServer = (raw: unknown): NewDbTransaction | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const transaction = raw as Record<string, unknown>;
  const id = typeof transaction.id === 'string' ? transaction.id : '';
  if (!id) return null;

  const totalAmount = asNumber(transaction.totalAmount, 0);
  const paidAmount = asNumber(transaction.paidAmount, 0);
  const nowIso = new Date().toISOString();
  const billDate = toIsoString(transaction.billDate ?? transaction.createdAt, nowIso);
  const createdAt = toIsoString(transaction.createdAt, billDate);
  const updatedAt = toIsoString(transaction.updatedAt, createdAt);
  const itemsSnapshot = Array.isArray(transaction.items)
    ? JSON.stringify(transaction.items)
    : (typeof transaction.itemsSnapshot === 'string' ? transaction.itemsSnapshot : '[]');

  return {
    id,
    organizationId: typeof transaction.organizationId === 'string'
      ? transaction.organizationId
      : (typeof transaction.userId === 'string' ? transaction.userId : null),
    branchId: typeof transaction.branchId === 'string' ? transaction.branchId : null,
    accountId: typeof transaction.accountId === 'string' ? transaction.accountId : null,
    type: transaction.type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
    partyId: typeof transaction.partyId === 'string' ? transaction.partyId : null,
    partyName: typeof transaction.partyName === 'string' ? transaction.partyName : null,
    partyPhone: typeof transaction.partyPhone === 'string' ? transaction.partyPhone : null,
    billNumber: typeof transaction.billNumber === 'string' ? transaction.billNumber : null,
    billDate,
    businessName: typeof transaction.businessName === 'string' ? transaction.businessName : null,
    businessAddress: typeof transaction.businessAddress === 'string' ? transaction.businessAddress : null,
    gstNumber: typeof transaction.gstNumber === 'string' ? transaction.gstNumber : null,
    currency: typeof transaction.currency === 'string' ? transaction.currency : 'INR',
    costCenter: typeof transaction.costCenter === 'string' ? transaction.costCenter : null,
    projectCode: typeof transaction.projectCode === 'string' ? transaction.projectCode : null,
    totalAmount,
    discountAmount: asNumber(transaction.discountAmount, 0),
    taxAmount: asNumber(transaction.taxAmount, 0),
    paidAmount,
    paymentMode: transaction.paymentMode === 'CREDIT' ? 'CREDIT' : 'CASH',
    paymentStatus: normalizePaymentStatus(transaction.paymentStatus, totalAmount, paidAmount),
    billMode: transaction.billMode === 'GST' ? 'GST' : 'ESTIMATE',
    affectsGst: asBoolean(transaction.affectsGst, true),
    createdByUid: typeof transaction.createdByUid === 'string' ? transaction.createdByUid : null,
    dueDate: transaction.dueDate ? toIsoString(transaction.dueDate, billDate) : null,
    reminderEnabled: asBoolean(transaction.reminderEnabled, false),
    reminderFrequencyDays: Math.max(1, Math.trunc(asNumber(transaction.reminderFrequencyDays, 3))),
    nextReminderAt: transaction.nextReminderAt ? toIsoString(transaction.nextReminderAt, billDate) : null,
    lastReminderAt: transaction.lastReminderAt ? toIsoString(transaction.lastReminderAt, billDate) : null,
    remark: typeof transaction.remark === 'string' ? transaction.remark : null,
    billingAddress: typeof transaction.billingAddress === 'string'
      ? transaction.billingAddress
      : (typeof transaction.businessAddress === 'string' ? transaction.businessAddress : null),
    deliveryAddress: typeof transaction.deliveryAddress === 'string' ? transaction.deliveryAddress : null,
    deliveryContactName: typeof transaction.deliveryContactName === 'string' ? transaction.deliveryContactName : null,
    deliveryContactPhone: typeof transaction.deliveryContactPhone === 'string' ? transaction.deliveryContactPhone : null,
    itemsSnapshot,
    createdAt,
    updatedAt,
  };
};

const normalizeApiTransactionType = (value: unknown): 'SALE' | 'PURCHASE' => {
  if (value === 'SALE' || value === 'PURCHASE') return value;
  if (value === 'RETURN_OUTWARD') return 'SALE';
  if (value === 'RETURN_INWARD') return 'PURCHASE';
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (upper.includes('PURCHASE') || upper.includes('INWARD')) return 'PURCHASE';
    if (upper.includes('SALE') || upper.includes('OUTWARD')) return 'SALE';
  }
  return 'SALE';
};

const extractMissingItemId = (message: string): string | null => {
  const match = /item\s+([a-z0-9-]{8,})\s+not found/i.exec(message);
  return match?.[1] ?? null;
};

const isNotFoundLikeError = (error: unknown): boolean => {
  const message = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
  return message.includes('request failed (404)') || message.includes('not found');
};

const sanitizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeTransactionLineItems = (raw: unknown): {
  id: string;
  name: string;
  quantity: number;
  price: number;
  tax: number;
  total: number;
}[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const line = entry as Record<string, unknown>;
      const id = typeof line.id === 'string' ? line.id.trim() : '';
      const name = typeof line.name === 'string' ? line.name.trim() : '';
      const quantity = asNumber(line.quantity, 0);
      const price = asNumber(line.price, 0);
      const tax = asNumber(line.tax, 0);
      const computedTotal = quantity * price * (1 + tax / 100);
      const total = asNumber(line.total, computedTotal);

      if (!id || !name || quantity <= 0) return null;

      return {
        id,
        name,
        quantity,
        price,
        tax,
        total,
      };
    })
    .filter((line): line is {
      id: string;
      name: string;
      quantity: number;
      price: number;
      tax: number;
      total: number;
    } => line !== null);
};

const mapItemPayloadForApi = (raw: Partial<NewDbItem> & { id?: string }) => {
  const payload: Record<string, unknown> = { ...raw };

  payload.branchId = sanitizeOptionalString(raw.branchId);
  payload.unit = sanitizeOptionalString(raw.unit) ?? 'pcs';
  payload.hsn = sanitizeOptionalString(raw.hsn);
  payload.category = sanitizeOptionalString(raw.category);
  payload.subcategory = sanitizeOptionalString(raw.subcategory);
  payload.location = sanitizeOptionalString(raw.location);
  payload.barcode = sanitizeOptionalString(raw.barcode);
  payload.imageUrl = sanitizeOptionalString((raw as Record<string, unknown>).imageUrl) ?? sanitizeOptionalString(raw.image);
  payload.expiresAt = raw.expiresAt ?? undefined;
  payload.autoDeleteAt = raw.autoDeleteAt ?? undefined;
  payload.autoDeleteEnabled = typeof raw.autoDeleteEnabled === 'boolean' ? raw.autoDeleteEnabled : false;

  delete payload.image;
  return payload;
};

const mapPartyPayloadForApi = (raw: Partial<NewDbParty> & { id?: string }) => {
  const payload: Record<string, unknown> = { ...raw };

  payload.phone = sanitizeOptionalString(raw.phone);
  payload.email = sanitizeOptionalString(raw.email);
  payload.address = sanitizeOptionalString(raw.address);
  payload.gstNumber = sanitizeOptionalString(raw.gstNumber);

  return payload;
};

const sanitizeTransactionPayloadForApi = (raw: Record<string, unknown>) => {
  const payload: Record<string, unknown> = { ...raw };
  const optionalStringKeys = [
    'organizationId',
    'branchId',
    'partyId',
    'partyName',
    'partyPhone',
    'billNumber',
    'businessName',
    'businessAddress',
    'gstNumber',
    'costCenter',
    'projectCode',
    'createdByUid',
    'remark',
  ];
  const optionalDateKeys = ['dueDate', 'nextReminderAt', 'billDate'];

  for (const key of optionalStringKeys) {
    const value = payload[key];
    if (value === null || value === undefined) {
      delete payload[key];
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        delete payload[key];
      } else {
        payload[key] = trimmed;
      }
    }
  }

  for (const key of optionalDateKeys) {
    const value = payload[key];
    if (value === null || value === undefined || value === '') {
      delete payload[key];
    }
  }

  return payload;
};

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
    const pendingBefore = (await this.getQueueStats()).pendingCount;

    try {
      await this.flushQueue();
      await this.pullChanges();

      if (pendingBefore > 0) {
        await notifySyncComplete(pendingBefore);
      }

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
      const response = await apiClient.get<ServerListResponse<unknown>>('/items', { params });
      const itemsData = Array.isArray(response.items)
        ? response.items.map(normalizeItemFromServer).filter((entry): entry is NewDbItem => entry !== null)
        : [];

      if (itemsData.length > 0) {

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
      const response = await apiClient.get<ServerListResponse<unknown>>('/parties', { params });
      const partiesData = Array.isArray(response.parties)
        ? response.parties.map(normalizePartyFromServer).filter((entry): entry is NewDbParty => entry !== null)
        : [];

      if (partiesData.length > 0) {

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
      const response = await apiClient.get<ServerListResponse<unknown>>('/transactions', { params });
      const transactionsData = Array.isArray(response.transactions)
        ? response.transactions.map(normalizeTransactionFromServer).filter((entry): entry is NewDbTransaction => entry !== null)
        : [];

      if (transactionsData.length > 0) {

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
    const retryCutoffIso = new Date(Date.now() - 60_000).toISOString();

    // 1. Get pending entries first, then failed entries with bounded retries/backoff.
    const pendingItems = await db.select()
      .from(syncQueue)
      .where(or(
        eq(syncQueue.status, 'PENDING'),
        sql`(${syncQueue.status} = 'FAILED' and coalesce(${syncQueue.retryCount}, 0) < 3 and ${syncQueue.updatedAt} <= ${retryCutoffIso})`
      ))
      .orderBy(
        sql`case when ${syncQueue.status} = 'PENDING' then 0 else 1 end`,
        asc(syncQueue.createdAt)
      )
      .limit(50);

    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      try {
        // Mark as syncing (optional, usually we just keep pending until success)
        // await db.update(syncQueue).set({ status: 'SYNCING' }).where(eq(syncQueue.id, item.id));

        const payload = JSON.parse(item.data) as SyncData;
        await this.processItem(item.action as SyncActionType, payload);

        await db.delete(syncQueue).where(eq(syncQueue.id, item.id));
      } catch (error: any) {
        const rawErrorMessage = String(error?.message || error || '');
        const errorMessage = rawErrorMessage.toLowerCase();
        const missingItemId = extractMissingItemId(rawErrorMessage);
        const hasMissingItemReference = Boolean(missingItemId);
        const isNonRetryable =
          errorMessage.includes('already exists')
          || errorMessage.includes('duplicate')
          || (!hasMissingItemReference && errorMessage.includes('not found'))
          || (!hasMissingItemReference && errorMessage.includes('request failed (404)'))
          || errorMessage.includes('invalid option')
          || errorMessage.includes('expected one of')
          || errorMessage.includes('"code":"invalid_value"')
          || errorMessage.includes('expected string, received null')
          || errorMessage.includes('"code":"invalid_type"');

        // If server indicates the item already exists or no longer exists, remove the queue entry.
        if (isNonRetryable) {
          console.log(`Discarding sync item ${item.id} due to non-retryable server state.`);
          await db.delete(syncQueue).where(eq(syncQueue.id, item.id)).catch(err => console.error('Delete failed:', err));
        } else {
          console.error(`Failed to process sync item ${item.id}`, error);
          // Mark as FAILED to prevent infinite recursion in the same sync cycle.
          // It can be retried later or fixed manually.
          await db.update(syncQueue)
            .set({
              status: 'FAILED',
              updatedAt: new Date().toISOString(),
              retryCount: (item.retryCount || 0) + 1
            })
            .where(eq(syncQueue.id, item.id))
            .catch(err => console.error('Update failed:', err));
        }
      }
    }

    // Recursive check if more items exist
    const remaining = await db.select({ id: syncQueue.id })
      .from(syncQueue)
      .where(eq(syncQueue.status, 'PENDING'))
      .limit(1);
    if (remaining.length > 0) {
      await this.flushQueue();
    }
  }


  private async syncMissingItemIfAvailable(itemId: string): Promise<boolean> {
    const localRows = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    const localItem = localRows[0];
    if (!localItem) return false;

    const serverItemPayload = mapItemPayloadForApi(localItem);

    try {
      await apiClient.post('/items', serverItemPayload);
      return true;
    } catch (error: any) {
      const message = String(error?.message || error || '').toLowerCase();
      if (message.includes('already exists') || message.includes('duplicate')) {
        return true;
      }
      return false;
    }
  }

  private async sendTransactionWithMissingItemRecovery(send: () => Promise<void>) {
    try {
      await send();
    } catch (error: any) {
      const message = String(error?.message || error || '');
      const missingItemId = extractMissingItemId(message);
      if (!missingItemId) throw error;

      const recovered = await this.syncMissingItemIfAvailable(missingItemId);
      if (!recovered) throw error;

      await send();
    }
  }


  private async processItem(action: SyncActionType, data: SyncData) {
    // Ensure IDs are present
    switch (action) {
      case 'CREATE_ITEM': {
        const payload = data as NewDbItem;
        await apiClient.post('/items', mapItemPayloadForApi(payload));
        break;
      }
      case 'UPDATE_ITEM': {
        const payload = data as Partial<NewDbItem> & { id: string };
        const apiPayload = mapItemPayloadForApi(payload);
        try {
          await apiClient.patch(`/items/${payload.id}`, apiPayload);
        } catch (error) {
          if (!isNotFoundLikeError(error)) throw error;
          await apiClient.post('/items', apiPayload);
        }
        break;
      }
      case 'DELETE_ITEM': {
        const payload = data as { id: string };
        await apiClient.delete(`/items/${payload.id}`);
        break;
      }

      case 'CREATE_PARTY': {
        const payload = data as NewDbParty;
        await apiClient.post('/parties', mapPartyPayloadForApi(payload));
        break;
      }
      case 'UPDATE_PARTY': {
        const payload = data as Partial<NewDbParty> & { id: string };
        const apiPayload = mapPartyPayloadForApi(payload);
        try {
          await apiClient.patch(`/parties/${payload.id}`, apiPayload);
        } catch (error) {
          if (!isNotFoundLikeError(error)) throw error;
          await apiClient.post('/parties', apiPayload);
        }
        break;
      }
      case 'DELETE_PARTY': {
        const payload = data as { id: string };
        await apiClient.patch(`/parties/${payload.id}`, { isActive: false });
        break;
      }

      case 'CREATE_TRANSACTION': {
        const payload = data as NewDbTransaction;
        // Convert local itemsSnapshot JSON string to API `items` array.
        let itemsArray: unknown[] = [];
        try {
          itemsArray = payload.itemsSnapshot ? JSON.parse(payload.itemsSnapshot) : [];
        } catch {
          itemsArray = [];
        }
        const apiPayload = {
          ...payload,
          type: normalizeApiTransactionType(payload.type),
          items: normalizeTransactionLineItems(itemsArray),
          businessAddress: payload.billingAddress ?? undefined,
        } as any;
        // Remove local-only fields before posting to API.
        delete apiPayload.itemsSnapshot;
        delete apiPayload.updatedAt;
        delete apiPayload.createdAt;
        delete apiPayload.billingAddress;
        delete apiPayload.deliveryAddress;
        delete apiPayload.deliveryContactName;
        delete apiPayload.deliveryContactPhone;
        delete apiPayload.accountId;

        const sanitizedPayload = sanitizeTransactionPayloadForApi(apiPayload);
        await this.sendTransactionWithMissingItemRecovery(async () => {
          await apiClient.post('/transactions', sanitizedPayload);
        });
        break;
      }
      case 'UPDATE_TRANSACTION': {
        const payload = data as Partial<NewDbTransaction> & { id: string };

        const paymentOnlyKeys = new Set([
          'id',
          'paidAmount',
          'paymentStatus',
          'paymentMode',
          'dueDate',
          'reminderEnabled',
          'reminderFrequencyDays',
          'nextReminderAt',
          'updatedAt',
          'markAsPaid',
        ]);

        const payloadKeys = Object.keys(payload).filter((key) => (payload as Record<string, unknown>)[key] !== undefined);
        const isPaymentOnly = payloadKeys.length > 0 && payloadKeys.every((key) => paymentOnlyKeys.has(key));

        if (isPaymentOnly) {
          const paymentPayload = {
            paidAmount: typeof payload.paidAmount === 'number' ? payload.paidAmount : undefined,
            markAsPaid: payload.paymentStatus === 'PAID' && typeof payload.paidAmount !== 'number' ? true : undefined,
            dueDate: payload.dueDate ?? undefined,
            reminderEnabled: (payload as any).reminderEnabled,
            reminderFrequencyDays: (payload as any).reminderFrequencyDays,
            nextReminderAt: (payload as any).nextReminderAt,
          };
          await apiClient.patch(`/transactions/${payload.id}/payment`, paymentPayload);
          break;
        }

        let itemsArray: unknown[] = [];
        try {
          if (payload.itemsSnapshot) {
            itemsArray = JSON.parse(payload.itemsSnapshot as string);
          }
        } catch {
          itemsArray = [];
        }
        const apiPayload: any = {
          ...payload,
          type: normalizeApiTransactionType(payload.type),
          items: normalizeTransactionLineItems(itemsArray),
          businessAddress: payload.billingAddress ?? undefined,
        };
        delete apiPayload.itemsSnapshot;
        delete apiPayload.updatedAt;
        delete apiPayload.createdAt;
        delete apiPayload.billingAddress;
        delete apiPayload.deliveryAddress;
        delete apiPayload.deliveryContactName;
        delete apiPayload.deliveryContactPhone;
        delete apiPayload.accountId;
        const sanitizedPayload = sanitizeTransactionPayloadForApi(apiPayload);
        try {
          await this.sendTransactionWithMissingItemRecovery(async () => {
            await apiClient.patch(`/transactions/${payload.id}`, sanitizedPayload);
          });
        } catch (error) {
          if (!isNotFoundLikeError(error)) throw error;
          await this.sendTransactionWithMissingItemRecovery(async () => {
            await apiClient.post('/transactions', sanitizedPayload);
          });
        }
        break;
      }
      case 'DELETE_TRANSACTION': {
        const payload = data as { id: string };
        await apiClient.delete(`/transactions/${payload.id}`);
        break;
      }

      case 'UPDATE_SETTINGS': {
        // Local settings are device-only; no server endpoint exists for this legacy action.
        console.warn('Skipping UPDATE_SETTINGS sync action (local-only setting).');
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
