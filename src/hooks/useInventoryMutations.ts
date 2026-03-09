import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateItemQueries } from './useInventory';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { itemRepository } from '../repositories/itemRepository';

type SaveInventoryItemInput = {
    id?: string;
    data: Parameters<typeof itemRepository.create>[0];
};

type AdjustInventoryStockInput = {
    itemId: string;
    type: 'IN' | 'OUT' | 'ADJUST';
    quantity: number;
    reason?: string;
    godownId?: string | null;
};

type BulkInventoryGstInput = {
    ids: string[];
    gstRate: number;
};

export function useInventoryMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveMutation = useMutation({
        mutationFn: ({ id, data }: SaveInventoryItemInput) => (
            id ? itemRepository.update(id, data) : itemRepository.create(data)
        ),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    const adjustStockMutation = useMutation({
        mutationFn: ({ itemId, ...payload }: AdjustInventoryStockInput) => itemRepository.adjustStock(itemId, payload),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    const archiveMutation = useMutation({
        mutationFn: (id: string) => itemRepository.delete(id),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => itemRepository.restore(id),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    const permanentDeleteMutation = useMutation({
        mutationFn: (id: string) => itemRepository.permanentDelete(id),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    const bulkArchiveMutation = useMutation({
        mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => itemRepository.delete(id))),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    const bulkGstMutation = useMutation({
        mutationFn: async ({ ids, gstRate }: BulkInventoryGstInput) =>
            Promise.all(ids.map((id) => itemRepository.update(id, { gstRate }))),
        onSuccess: async () => {
            await invalidateItemQueries(queryClient, businessId);
        },
    });

    return {
        saveItem: saveMutation.mutateAsync,
        adjustStock: adjustStockMutation.mutateAsync,
        archiveItem: archiveMutation.mutateAsync,
        restoreItem: restoreMutation.mutateAsync,
        permanentlyDeleteItem: permanentDeleteMutation.mutateAsync,
        archiveItems: bulkArchiveMutation.mutateAsync,
        updateItemsGstRate: bulkGstMutation.mutateAsync,
        isSavingItem: saveMutation.isPending,
        isAdjustingStock: adjustStockMutation.isPending,
        isArchivingItem: archiveMutation.isPending,
        isRestoringItem: restoreMutation.isPending,
        isDeletingItemPermanently: permanentDeleteMutation.isPending,
        isArchivingItems: bulkArchiveMutation.isPending,
        isUpdatingItemsGstRate: bulkGstMutation.isPending,
    };
}
