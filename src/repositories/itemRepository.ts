import { api } from '../api/client';
import { offlineSyncService } from '../services/offlineSyncService';
import type { Item } from '../types/domain';
import type { PaginationParams } from '../types/api';

type ItemListParams = { q?: string; limit?: number };
type ItemRecycleBinParams = { limit?: number };
type ItemCreateInput = Omit<Item, 'id' | 'businessId' | 'createdAt' | 'updatedAt'> & {
    godownId?: string | null;
};
type ItemUpdateInput = Partial<Item> & {
    godownId?: string | null;
};
type ItemUpsertInput = Partial<Item> & { price?: number; salePrice?: number; godownId?: string | null };
type ItemAdjustStockInput = {
    type: 'IN' | 'OUT' | 'ADJUST';
    quantity: number;
    reason?: string;
    godownId?: string | null;
};

const nowIso = () => new Date().toISOString();

const queueAndAttemptSync = async (
    mutation: Parameters<typeof offlineSyncService.enqueueMutation>[0],
    successMessage: string
) => {
    await offlineSyncService.enqueueMutation(mutation);
    void offlineSyncService.flushQueue();
    return {
        ok: true,
        message: successMessage,
        syncQueued: true,
    };
};

const mapRemoteItem = (raw: Record<string, unknown>, fallbackId?: string, forceInactive = false): Item => ({
    id: String(raw.id ?? fallbackId ?? ''),
    businessId: String(raw.businessId ?? ''),
    name: String(raw.name ?? ''),
    sku: raw.sku ? String(raw.sku) : null,
    barcode: raw.barcode ? String(raw.barcode) : null,
    hsnCode: raw.hsn ? String(raw.hsn) : raw.hsnCode ? String(raw.hsnCode) : null,
    unit: raw.unit ? String(raw.unit) : null,
    category: raw.category ? String(raw.category) : null,
    mrp: Number(raw.mrp ?? 0),
    purchasePrice: Number(raw.purchasePrice ?? 0),
    salePrice: Number(raw.price ?? raw.salePrice ?? 0),
    gstRate: Number(raw.gstPercentage ?? raw.gstRate ?? 0),
    openingStock: Number(raw.openingStock ?? raw.stock ?? 0),
    stock: Number(raw.stock ?? 0),
    reorderLevel: Number(raw.minimumStock ?? raw.reorderLevel ?? 0),
    description: raw.description ? String(raw.description) : null,
    location: raw.location ? String(raw.location) : null,
    imageUrl: raw.imageUrl ? String(raw.imageUrl) : null,
    expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
    autoDeleteAt: raw.autoDeleteAt ? String(raw.autoDeleteAt) : null,
    autoDeleteEnabled: Boolean(raw.autoDeleteEnabled ?? false),
    isSalesPriceInclusiveGst: Boolean(raw.isSalesPriceInclusiveGst ?? false),
    trackStock: true,
    isActive: forceInactive ? false : Boolean(raw.isActive ?? true),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
});

const buildLocalItem = (params: {
    id: string;
    input: Partial<Item> & { name: string };
    base?: Item;
}): Item => {
    const { id, input, base } = params;
    const now = nowIso();
    return {
        id,
        businessId: base?.businessId ?? 'offline',
        name: input.name,
        sku: input.sku ?? base?.sku ?? null,
        barcode: input.barcode ?? base?.barcode ?? null,
        hsnCode: input.hsnCode ?? base?.hsnCode ?? null,
        unit: input.unit ?? base?.unit ?? 'pcs',
        category: input.category ?? base?.category ?? null,
        mrp: Number(input.mrp ?? base?.mrp ?? 0),
        purchasePrice: Number(input.purchasePrice ?? base?.purchasePrice ?? 0),
        salePrice: Number(input.salePrice ?? base?.salePrice ?? 0),
        gstRate: Number(input.gstRate ?? base?.gstRate ?? 0),
        openingStock: Number(input.openingStock ?? base?.openingStock ?? input.stock ?? 0),
        stock: Number(input.stock ?? base?.stock ?? 0),
        reorderLevel: Number(input.reorderLevel ?? base?.reorderLevel ?? 0),
        description: input.description ?? base?.description ?? null,
        location: input.location ?? base?.location ?? null,
        imageUrl: input.imageUrl ?? base?.imageUrl ?? null,
        expiresAt: input.expiresAt ?? base?.expiresAt ?? null,
        autoDeleteAt: input.autoDeleteAt ?? base?.autoDeleteAt ?? null,
        autoDeleteEnabled: Boolean(input.autoDeleteEnabled ?? base?.autoDeleteEnabled ?? false),
        isSalesPriceInclusiveGst: Boolean(
            input.isSalesPriceInclusiveGst ?? base?.isSalesPriceInclusiveGst ?? false
        ),
        trackStock: Boolean(input.trackStock ?? base?.trackStock ?? true),
        isActive: Boolean(input.isActive ?? base?.isActive ?? true),
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
    };
};

const toItemSyncPayload = (
    item: Item,
    godownId?: string | null
): Record<string, unknown> & { id: string } => ({
    id: item.id,
    name: item.name,
    price: item.salePrice,
    stock: item.stock,
    purchasePrice: item.purchasePrice,
    mrp: item.mrp,
    minimumStock: item.reorderLevel,
    unit: item.unit ?? 'pcs',
    hsn: item.hsnCode ?? undefined,
    gstPercentage: item.gstRate,
    category: item.category ?? undefined,
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    barcode: item.barcode ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
    isActive: item.isActive,
    autoDeleteEnabled: item.autoDeleteEnabled,
    autoDeleteAt: item.autoDeleteAt ?? undefined,
    expiresAt: item.expiresAt ?? undefined,
    ...(godownId !== undefined ? { godownId } : {}),
});

const mergeCachedItems = async (items: Item[]) => {
    const current = await offlineSyncService.getCachedItems();
    const merged = new Map(current.map((item) => [item.id, item]));
    items.forEach((item) => {
        merged.set(item.id, item);
    });
    await offlineSyncService.setCachedItems(Array.from(merged.values()));
};

const listRemote = async (params?: ItemListParams) => {
    const res = await api.get<{ ok: boolean; items: Record<string, unknown>[] }>('/api/items', { params });
    return {
        ok: res.ok,
        items: (res.items ?? []).map((raw) => mapRemoteItem(raw)),
    };
};

const recycleBinRemote = async (params?: ItemRecycleBinParams) => {
    const res = await api.get<{ ok: boolean; items: Record<string, unknown>[] }>('/api/items/recycle-bin', { params });
    return {
        ok: res.ok,
        items: (res.items ?? []).map((raw) => mapRemoteItem(raw, undefined, true)),
    };
};

const getRemote = async (id: string) => {
    const res = await api.get<{ ok: boolean; item: Record<string, unknown> }>(`/api/items/${id}`);
    return {
        ok: res.ok,
        item: mapRemoteItem(res.item ?? {}, id),
    };
};

export const itemRepository = {
    listRemote,
    recycleBinRemote,
    getRemote,
    list: async (params?: ItemListParams) => {
        try {
            const response = await listRemote(params);
            await mergeCachedItems(response.items ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedItems();
            if (cached.length > 0) {
                return { ok: true, items: cached };
            }
            throw error;
        }
    },
    recycleBin: async (params?: ItemRecycleBinParams) => {
        try {
            const response = await recycleBinRemote(params);
            await mergeCachedItems(response.items ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedItems();
            const deleted = cached.filter((item) => item.isActive === false);
            if (deleted.length > 0) {
                return { ok: true, items: deleted };
            }
            throw error;
        }
    },
    get: async (id: string) => {
        try {
            const response = await getRemote(id);
            if (response.item) {
                await offlineSyncService.upsertCachedItem(response.item);
            }
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedItems();
            const entry = cached.find((item) => item.id === id);
            if (entry) {
                return { ok: true, item: entry };
            }
            throw error;
        }
    },
    create: async (data: ItemCreateInput) => {
        const localId = offlineSyncService.createLocalId('item');
        const localItem = buildLocalItem({ id: localId, input: { ...data, name: data.name } });
        await offlineSyncService.upsertCachedItem(localItem);
        const queued = await queueAndAttemptSync(
            {
                type: 'upsert_item',
                payload: toItemSyncPayload(localItem, data.godownId),
            },
            'Saved locally. Sync pending.'
        );
        return {
            ...queued,
            item: localItem,
        };
    },
    upsert: async (data: ItemUpsertInput) => {
        if (data.id) {
            return itemRepository.update(data.id, data);
        }

        return itemRepository.create({
            name: data.name ?? 'Item',
            sku: data.sku ?? null,
            barcode: data.barcode ?? null,
            hsnCode: data.hsnCode ?? null,
            unit: data.unit ?? 'pcs',
            category: data.category ?? null,
            mrp: Number(data.mrp ?? 0),
            purchasePrice: Number(data.purchasePrice ?? 0),
            salePrice: Number(data.salePrice ?? data.price ?? 0),
            gstRate: Number(data.gstRate ?? 0),
            openingStock: Number(data.openingStock ?? data.stock ?? 0),
            stock: Number(data.stock ?? 0),
            reorderLevel: Number(data.reorderLevel ?? 0),
            description: data.description ?? null,
            location: data.location ?? null,
            imageUrl: data.imageUrl ?? null,
            expiresAt: data.expiresAt ?? null,
            autoDeleteAt: data.autoDeleteAt ?? null,
            godownId: data.godownId ?? null,
            autoDeleteEnabled: Boolean(data.autoDeleteEnabled ?? false),
            isSalesPriceInclusiveGst: Boolean(data.isSalesPriceInclusiveGst ?? false),
            trackStock: Boolean(data.trackStock ?? true),
            isActive: Boolean(data.isActive ?? true),
        });
    },
    update: async (id: string, data: ItemUpdateInput) => {
        const cached = await offlineSyncService.getCachedItems();
        const base = cached.find((entry) => entry.id === id);
        const localItem = buildLocalItem({
            id,
            input: {
                ...(base ?? {}),
                ...data,
                name: data.name ?? base?.name ?? 'Item',
            },
            base,
        });
        await offlineSyncService.upsertCachedItem(localItem);
        const queued = await queueAndAttemptSync(
            {
                type: 'upsert_item',
                payload: toItemSyncPayload(localItem, data.godownId),
            },
            'Updated locally. Sync pending.'
        );
        return {
            ...queued,
            item: localItem,
        };
    },
    delete: async (id: string) => {
        await offlineSyncService.archiveCachedItem(id);
        return queueAndAttemptSync(
            {
                type: 'delete_item',
                payload: { id },
            },
            'Delete saved locally. Sync pending.'
        );
    },
    restore: async (id: string) => {
        await offlineSyncService.restoreCachedItem(id);
        return queueAndAttemptSync(
            {
                type: 'restore_item',
                payload: { id },
            },
            'Item restored locally. Sync pending.'
        );
    },
    permanentDelete: async (id: string) => {
        await offlineSyncService.removeCachedItem(id);
        return queueAndAttemptSync(
            {
                type: 'permanent_delete_item',
                payload: { id },
            },
            'Item removed locally. Sync pending.'
        );
    },
    adjustStock: async (id: string, data: ItemAdjustStockInput) => {
        const cached = await offlineSyncService.getCachedItems();
        const existing = cached.find((entry) => entry.id === id);
        if (existing) {
            const current = Number(existing.stock ?? 0);
            const delta =
                data.type === 'IN' ? data.quantity : data.type === 'OUT' ? -data.quantity : data.quantity - current;
            const nextStock = data.type === 'ADJUST' ? data.quantity : current + delta;
            if (nextStock < 0) {
                throw new Error('Insufficient stock.');
            }
            const updated = {
                ...existing,
                stock: nextStock,
                updatedAt: nowIso(),
            };
            await offlineSyncService.upsertCachedItem(updated);
        }
        return queueAndAttemptSync(
            {
                type: 'adjust_item_stock',
                payload: {
                    id,
                    type: data.type,
                    quantity: data.quantity,
                    ...(data.reason ? { reason: data.reason } : {}),
                    ...(data.godownId !== undefined ? { godownId: data.godownId } : {}),
                },
            },
            'Stock adjustment saved locally. Sync pending.'
        );
    },
    getLedger: async (id: string, params?: PaginationParams) => {
        const res = await api.get<{ ok: boolean; ledger?: unknown[]; message?: string }>(`/api/items/${id}/ledger`, { params });
        return {
            ok: res.ok,
            data: res.ledger ?? [],
            message: res.message,
        };
    },
};
