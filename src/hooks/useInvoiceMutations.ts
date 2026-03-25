import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { invoiceRepository, type InvoiceCreateInput } from '../repositories/invoiceRepository';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { invalidateInvoiceQueries } from './useInvoices';
import { invalidatePartyQueries } from './useParties';
import { invalidateItemQueries } from './useInventory';
import { invalidateGodownQueries } from './useGodowns';
import { invalidateCashBankQueries } from './useCashBankAccounts';
import { reportQueryKeys } from '../state/domainQueryKeys';
import { offlineSyncService } from '../services/offlineSyncService';
import { notifyLowStockAlert, requestNotificationPermissions } from '../services/notificationService';

const invalidateInvoiceViews = async (queryClient: QueryClient, businessId?: string | null) => {
    await Promise.all([
        invalidateInvoiceQueries(queryClient, businessId),
        invalidatePartyQueries(queryClient, businessId),
        invalidateItemQueries(queryClient, businessId),
        invalidateGodownQueries(queryClient, businessId),
        invalidateCashBankQueries(queryClient, businessId),
        queryClient.invalidateQueries({ queryKey: reportQueryKeys.all(businessId) }),
    ]);
};

export function useInvoiceMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveInvoiceMutation = useMutation({
        mutationFn: (payload: InvoiceCreateInput) => invoiceRepository.create(payload),
        onSuccess: async (_, payload) => {
            await invalidateInvoiceViews(queryClient, businessId);

            try {
                const isDeduction = payload.transactionType === 'SALE'
                    || payload.transactionType === 'RETURN_OUTWARD'
                    || payload.invoiceType === 'POS_BILL';

                if (isDeduction && payload.items && payload.items.length > 0) {
                    const catalog = await offlineSyncService.getCachedItems();
                    for (const line of payload.items) {
                        if (!line.itemId) continue;
                        const match = catalog.find((i) => i.id === line.itemId);
                        if (!match || !match.trackStock || match.reorderLevel === null) continue;

                        const qty = Number(line.quantity) || 0;
                        const newStock = (Number(match.stock) || 0) - qty;

                        if (newStock <= match.reorderLevel) {
                            const granted = await requestNotificationPermissions();
                            if (granted) {
                                void notifyLowStockAlert(match.name, newStock, match.reorderLevel);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('[low-stock] evaluation failed', error);
            }
        },
    });

    const recordPaymentMutation = useMutation({
        mutationFn: ({
            invoiceId,
            payload,
        }: {
            invoiceId: string;
            payload: Parameters<typeof invoiceRepository.recordPayment>[1];
        }) => invoiceRepository.recordPayment(invoiceId, payload),
        onSuccess: async () => {
            await invalidateInvoiceViews(queryClient, businessId);
        },
    });

    const createPosSaleMutation = useMutation({
        mutationFn: (payload: Parameters<typeof invoiceRepository.createPosSale>[0]) => invoiceRepository.createPosSale(payload),
        onSuccess: async (_, payload) => {
            await invalidateInvoiceViews(queryClient, businessId);

            try {
                const catalog = await offlineSyncService.getCachedItems();
                for (const line of payload.items) {
                    if (!line.itemId) continue;
                    const match = catalog.find((i) => i.id === line.itemId);
                    if (!match || !match.trackStock || match.reorderLevel === null) continue;

                    const qty = Number(line.quantity) || 0;
                    const newStock = (Number(match.stock) || 0) - qty;

                    if (newStock <= match.reorderLevel) {
                        const granted = await requestNotificationPermissions();
                        if (granted) {
                            void notifyLowStockAlert(match.name, newStock, match.reorderLevel);
                        }
                    }
                }
            } catch (error) {
                console.warn('[low-stock] pos evaluation failed', error);
            }
        },
    });

    return {
        saveInvoice: saveInvoiceMutation.mutateAsync,
        recordInvoicePayment: recordPaymentMutation.mutateAsync,
        createPosSale: createPosSaleMutation.mutateAsync,
        isSavingInvoice: saveInvoiceMutation.isPending,
        isRecordingInvoicePayment: recordPaymentMutation.isPending,
        isCreatingPosSale: createPosSaleMutation.isPending,
    };
}
