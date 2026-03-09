import { api } from '../api/client';
import { buildOfflineGodownStock } from './reportRepository';
import { offlineSyncService } from '../services/offlineSyncService';
import type { ApiListResponse, ApiOkResponse, ApiResponse, PaginationParams } from '../types/api';
import type { Godown, GodownStockEntry, StockTransfer } from '../types/domain';

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

const buildLocalGodown = (payload: { name: string; address?: string; isDefault?: boolean }): Godown => {
    const now = nowIso();
    return {
        id: offlineSyncService.createLocalId('godown'),
        businessId: 'offline',
        name: payload.name,
        address: payload.address ?? null,
        managerName: null,
        isDefault: Boolean(payload.isDefault),
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };
};

export const godownRepository = {
    listRemote: () => api.get<ApiListResponse<Godown>>('/api/godowns'),
    createRemote: (data: { id?: string; name: string; address?: string; isDefault?: boolean }) =>
        api.post<ApiResponse<Godown>>('/api/godowns', data),
    update: (id: string, data: Partial<Godown>) =>
        api.put<ApiResponse<Godown>>(`/api/godowns/${id}`, data),
    getTransfers: (params?: PaginationParams) =>
        api.get<ApiListResponse<StockTransfer>>('/api/godowns/transfers', { params }),
    deleteRemote: (id: string) =>
        api.delete<ApiOkResponse>(`/api/godowns/${id}`),
    getStockRemote: (id: string) =>
        api.get<ApiResponse<GodownStockEntry[]>>(`/api/godowns/${id}/stock`),
    list: async () => {
        try {
            const response = await godownRepository.listRemote();
            await offlineSyncService.setCachedGodowns(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedGodowns();
            if (cached.length > 0) {
                return { ok: true, data: cached };
            }
            throw error;
        }
    },
    create: async (payload: { name: string; address?: string; isDefault?: boolean }) => {
        const localGodown = buildLocalGodown(payload);
        await offlineSyncService.upsertCachedGodown(localGodown);
        await queueAndAttemptSync(
            { type: 'create_godown', payload: { ...payload, id: localGodown.id, localId: localGodown.id } },
            'Godown saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: localGodown,
            message: 'Godown saved locally. Sync pending.',
        };
    },
    transfer: async (payload: { fromGodownId: string; toGodownId: string; itemId: string; quantity: number; notes?: string }) => {
        return queueAndAttemptSync(
            { type: 'transfer_godown_stock', payload },
            'Stock transfer saved locally. Sync pending.'
        );
    },
    delete: async (id: string) => {
        await offlineSyncService.removeCachedGodown(id);
        return queueAndAttemptSync(
            { type: 'delete_godown', payload: { id } },
            'Delete saved locally. Sync pending.'
        );
    },
    getStock: async (id: string) => {
        try {
            return await godownRepository.getStockRemote(id);
        } catch (error) {
            const offline = await buildOfflineGodownStock(id);
            if (offline.data) {
                return offline;
            }
            throw error;
        }
    },
};
