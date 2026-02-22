/**
 * @file itemService.test.ts
 * @description Strict unit tests for itemService — CRUD, stock management, search, offline paths.
*/
import { itemService } from '../itemService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../../types';

// ─── Hoisted mock references ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
    isOnline: vi.fn().mockResolvedValue(true),
    shouldThrowClientApiError: vi.fn().mockReturnValue(false),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
    flushQueue: vi.fn().mockResolvedValue(undefined),
    getCachedItems: vi.fn().mockResolvedValue([]),
    setCachedItems: vi.fn().mockResolvedValue(undefined),
    upsertCachedItem: vi.fn().mockResolvedValue(undefined),
    removeCachedItem: vi.fn().mockResolvedValue(undefined),
    enqueueMutation: vi.fn().mockResolvedValue(undefined),
    createLocalId: vi.fn((prefix: string) => `${prefix}_local_001`),
}));

vi.mock('../../utils/network', () => ({ isOnline: mocks.isOnline }));
vi.mock('../../utils/errorGuards', () => ({ shouldThrowClientApiError: mocks.shouldThrowClientApiError }));
vi.mock('../httpClient', () => ({
    apiClient: {
        get: mocks.apiGet,
        post: mocks.apiPost,
        patch: mocks.apiPatch,
        delete: mocks.apiDelete,
    },
    ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
        }
    },
}));
vi.mock('../syncService', () => ({
    offlineSyncService: {
        flushQueue: mocks.flushQueue,
        getCachedItems: mocks.getCachedItems,
        setCachedItems: mocks.setCachedItems,
        upsertCachedItem: mocks.upsertCachedItem,
        removeCachedItem: mocks.removeCachedItem,
        enqueueMutation: mocks.enqueueMutation,
        createLocalId: mocks.createLocalId,
    },
}));


// ─── Test Data ──────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'item_001',
    userId: 'user_001',
    name: 'Test Widget',
    nameLowercase: 'test widget',
    price: 99.99,
    stock: 50,
    purchasePrice: 60,
    mrp: 120,
    minimumStock: 5,
    unit: 'pcs',
    gstPercentage: 18,
    category: 'electronics',
    isActive: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
});

/** Returns a full Omit<Item, 'id'> shape for addItem calls. */
const makeNewItem = (overrides: Partial<Omit<Item, 'id'>> = {}): Omit<Item, 'id'> => ({
    userId: 'user_test',
    name: 'New Widget',
    nameLowercase: 'new widget',
    price: 100,
    stock: 20,
    purchasePrice: 0,
    mrp: 0,
    minimumStock: 0,
    unit: 'pcs',
    gstPercentage: 0,
    category: undefined,
    isActive: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('itemService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isOnline.mockResolvedValue(true);
        mocks.shouldThrowClientApiError.mockReturnValue(false);
        mocks.getCachedItems.mockResolvedValue([]);
    });

    // ── ADD ITEM ────────────────────────────────────────────────────────────────

    describe('addItem — online', () => {
        it('returns the server-issued item ID', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'item_server_001' });
            const id = await itemService.addItem(makeNewItem({ name: 'Widget', stock: 20 }));
            expect(id).toBe('item_server_001');
        });

        it('calls POST /items with correct payload', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'item_api' });
            await itemService.addItem(makeNewItem({ name: 'Pen', nameLowercase: 'pen', price: 10, stock: 100 }));

            const [url, body] = mocks.apiPost.mock.calls[0] as [string, Record<string, unknown>];
            expect(url).toBe('/items');
            expect(body.name).toBe('Pen');
            expect(body.price).toBe(10);
        });

        it('stores the item in local cache with server ID', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'item_cached' });
            await itemService.addItem(makeNewItem({ name: 'Widget', stock: 10 }));

            expect(mocks.upsertCachedItem).toHaveBeenCalled();
            const lastUpsert = mocks.upsertCachedItem.mock.calls[mocks.upsertCachedItem.mock.calls.length - 1][0];
            expect(lastUpsert.id).toBe('item_cached');
        });

        it('auto-fills nameLowercase from name when empty', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'item_name' });
            await itemService.addItem(makeNewItem({ name: 'Bluetooth Speaker', nameLowercase: '', stock: 5 }));

            expect(mocks.upsertCachedItem.mock.calls[0][0].nameLowercase).toBe('bluetooth speaker');
        });
    });

    describe('addItem — offline', () => {
        beforeEach(() => { mocks.isOnline.mockResolvedValue(false); });

        it('returns local ID when offline', async () => {
            const id = await itemService.addItem(makeNewItem({ name: 'X', nameLowercase: 'x', price: 1, stock: 1 }));
            expect(id).toBe('item_local_001');
        });

        it('enqueues upsert_item mutation', async () => {
            await itemService.addItem(makeNewItem({ name: 'Y', nameLowercase: 'y', price: 2, stock: 2 }));
            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
            expect(mocks.enqueueMutation.mock.calls[0][0].type).toBe('upsert_item');
        });

        it('does not call API when offline', async () => {
            await itemService.addItem(makeNewItem({ name: 'Z', nameLowercase: 'z', price: 3, stock: 3 }));
            expect(mocks.apiPost).not.toHaveBeenCalled();
        });
    });

    // ── UPDATE ITEM ─────────────────────────────────────────────────────────────

    describe('updateItem', () => {
        it('merges partial update with existing item', async () => {
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_merge', name: 'Original', price: 100, stock: 10 })]);
            mocks.apiPatch.mockResolvedValueOnce({ ok: true });

            await itemService.updateItem('item_merge', { price: 150 });

            expect(mocks.upsertCachedItem).toHaveBeenCalled();
            const merged = mocks.upsertCachedItem.mock.calls[0][0];
            expect(merged.price).toBe(150);
            expect(merged.name).toBe('Original');
            expect(merged.stock).toBe(10);
        });

        it('updates nameLowercase when name changes', async () => {
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_rename', name: 'Old Name', nameLowercase: 'old name' })]);
            mocks.apiPatch.mockResolvedValueOnce({ ok: true });

            await itemService.updateItem('item_rename', { name: 'New Name' });

            expect(mocks.upsertCachedItem.mock.calls[0][0].nameLowercase).toBe('new name');
        });

        it('throws when item does not exist', async () => {
            mocks.getCachedItems.mockResolvedValue([]);
            mocks.apiGet.mockResolvedValue({ ok: false, item: null });

            await expect(itemService.updateItem('nonexistent', { price: 99 })).rejects.toThrow('Item not found.');
        });

        it('calls PATCH /items/:id', async () => {
            mocks.apiGet.mockResolvedValue({ ok: true, item: makeItem({ id: 'item_patch' }) });
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_patch' })]);
            mocks.apiPatch.mockResolvedValueOnce({ ok: true });

            await itemService.updateItem('item_patch', { price: 200 });

            expect(mocks.apiPatch).toHaveBeenCalledWith('/items/item_patch', expect.any(Object));
        });
    });

    // ── UPDATE STOCK ────────────────────────────────────────────────────────────

    describe('updateStock', () => {
        it('increases stock when type is IN', async () => {
            mocks.apiGet.mockResolvedValue({ ok: true, item: makeItem({ id: 'item_in', stock: 10 }) });
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_in', stock: 10 })]);
            mocks.apiPost.mockResolvedValueOnce({ ok: true });

            await itemService.updateStock('item_in', 5, 'IN');

            const lastUpsert = mocks.upsertCachedItem.mock.calls[mocks.upsertCachedItem.mock.calls.length - 1][0];
            expect(lastUpsert.stock).toBe(15);
        });

        it('decreases stock when type is OUT', async () => {
            mocks.apiGet.mockResolvedValue({ ok: true, item: makeItem({ id: 'item_out', stock: 20 }) });
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_out', stock: 20 })]);
            mocks.apiPost.mockResolvedValueOnce({ ok: true });

            await itemService.updateStock('item_out', 8, 'OUT');

            const lastUpsert = mocks.upsertCachedItem.mock.calls[mocks.upsertCachedItem.mock.calls.length - 1][0];
            expect(lastUpsert.stock).toBe(12);
        });

        it('throws when OUT quantity exceeds available stock', async () => {
            mocks.apiGet.mockResolvedValue({ ok: true, item: makeItem({ id: 'item_noenough', stock: 3 }) });
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_noenough', stock: 3 })]);

            await expect(itemService.updateStock('item_noenough', 10, 'OUT')).rejects.toThrow('Insufficient stock');
        });

        it('throws when quantity is 0 or negative', async () => {
            await expect(itemService.updateStock('item_001', 0, 'IN')).rejects.toThrow(
                'Quantity must be greater than 0.'
            );
        });

        it('throws when item not found', async () => {
            mocks.getCachedItems.mockResolvedValue([]);
            mocks.apiGet.mockResolvedValue({ ok: false, item: null });

            await expect(itemService.updateStock('nonexistent', 5, 'IN')).rejects.toThrow('Item not found.');
        });

        it('calls POST /items/:id/adjust with correct payload', async () => {
            mocks.apiGet.mockResolvedValue({ ok: true, item: makeItem({ id: 'item_adjust', stock: 10 }) });
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_adjust', stock: 10 })]);
            mocks.apiPost.mockResolvedValueOnce({ ok: true });

            await itemService.updateStock('item_adjust', 3, 'IN', 'Purchase');

            expect(mocks.apiPost).toHaveBeenCalledWith('/items/item_adjust/adjust', {
                type: 'IN', quantity: 3, reason: 'Purchase',
            });
        });
    });

    // ── CONSUME STOCK ───────────────────────────────────────────────────────────

    describe('consumeStock', () => {
        it('groups duplicate item IDs and deducts combined quantity', async () => {
            mocks.apiGet.mockResolvedValue({ ok: true, item: makeItem({ id: 'item_group', stock: 100 }) });
            mocks.getCachedItems.mockResolvedValue([makeItem({ id: 'item_group', stock: 100 })]);
            mocks.apiPost.mockResolvedValue({ ok: true });

            await itemService.consumeStock([
                { id: 'item_group', quantity: 5 },
                { id: 'item_group', quantity: 3 },
            ]);

            expect(mocks.apiPost).toHaveBeenCalledTimes(1);
            expect(mocks.apiPost).toHaveBeenCalledWith('/items/item_group/adjust', {
                type: 'OUT', quantity: 8, reason: undefined,
            });
        });

        it('skips items with 0 or negative quantity', async () => {
            mocks.getCachedItems.mockResolvedValue([]);
            mocks.apiPost.mockResolvedValue({ ok: true });

            await itemService.consumeStock([
                { id: 'item_skip', quantity: 0 },
                { id: 'item_skip2', quantity: -1 },
            ]);

            expect(mocks.apiPost).not.toHaveBeenCalled();
        });
    });

    // ── DELETE ITEM ─────────────────────────────────────────────────────────────

    describe('deleteItem', () => {
        it('removes from local cache first', async () => {
            mocks.apiDelete.mockResolvedValueOnce({ ok: true });
            await itemService.deleteItem('item_del');
            expect(mocks.removeCachedItem).toHaveBeenCalledWith('item_del');
        });

        it('calls DELETE /items/:id', async () => {
            mocks.apiDelete.mockResolvedValueOnce({ ok: true });
            await itemService.deleteItem('item_to_del');
            expect(mocks.apiDelete).toHaveBeenCalledWith('/items/item_to_del');
        });

        it('enqueues delete_item mutation when offline', async () => {
            mocks.isOnline.mockResolvedValue(false);
            await itemService.deleteItem('item_offline_del');

            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
            const mutation = mocks.enqueueMutation.mock.calls[0][0];
            expect(mutation.type).toBe('delete_item');
            expect(mutation.payload.id).toBe('item_offline_del');
        });
    });

    // ── GET ITEMS ───────────────────────────────────────────────────────────────

    describe('getUserItems', () => {
        it('fetches items from API and normalizes nameLowercase', async () => {
            const serverItem = makeItem({ nameLowercase: undefined as unknown as string });
            mocks.apiGet.mockResolvedValueOnce({ ok: true, items: [serverItem] });

            const items = await itemService.getUserItems('user_abc');

            expect(items).toHaveLength(1);
            expect(items[0].nameLowercase).toBe('test widget');
        });

        it('caches items locally after API fetch', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, items: [makeItem()] });
            await itemService.getUserItems('user_abc');
            expect(mocks.setCachedItems).toHaveBeenCalledOnce();
        });

        it('returns cached items when offline', async () => {
            mocks.isOnline.mockResolvedValue(false);
            mocks.getCachedItems.mockResolvedValueOnce([makeItem()]);

            const items = await itemService.getUserItems('user_abc');
            expect(items).toHaveLength(1);
            expect(mocks.apiGet).not.toHaveBeenCalled();
        });
    });

    // ── SEARCH ITEMS ────────────────────────────────────────────────────────────

    describe('searchItems', () => {
        it('searches offline cache by nameLowercase', async () => {
            mocks.isOnline.mockResolvedValue(false);
            mocks.getCachedItems.mockResolvedValueOnce([
                makeItem({ id: 'i1', name: 'Bluetooth Speaker', nameLowercase: 'bluetooth speaker' }),
                makeItem({ id: 'i2', name: 'HDMI Cable', nameLowercase: 'hdmi cable' }),
            ]);

            const items = await itemService.searchItems('user_abc', 'bluetooth');
            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('Bluetooth Speaker');
        });

        it('searches offline cache by barcode', async () => {
            mocks.isOnline.mockResolvedValue(false);
            mocks.getCachedItems.mockResolvedValueOnce([
                makeItem({ id: 'i_barcode', barcode: 'ABC123', nameLowercase: 'widget' }),
                makeItem({ id: 'i_other', barcode: 'XYZ789', nameLowercase: 'gadget' }),
            ]);

            const items = await itemService.searchItems('user_abc', 'ABC123');
            expect(items).toHaveLength(1);
            expect(items[0].id).toBe('i_barcode');
        });

        it('sends encoded query to GET /items when online', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, items: [] });
            mocks.getCachedItems.mockResolvedValue([]);

            await itemService.searchItems('user_abc', 'pen');

            const url = mocks.apiGet.mock.calls[0][0] as string;
            expect(url).toContain('/items?q=pen');
        });

        it('returns all cached items when query is empty and offline', async () => {
            mocks.isOnline.mockResolvedValue(false);
            mocks.getCachedItems.mockResolvedValueOnce([makeItem({ id: 'i1' }), makeItem({ id: 'i2' })]);

            const items = await itemService.searchItems('user_abc', '');
            expect(items).toHaveLength(2);
        });
    });
});
