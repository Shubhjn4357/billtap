import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { invoiceRepository, type InvoiceCreateInput } from '../repositories/invoiceRepository';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { invalidateInvoiceQueries } from './useInvoices';
import { invalidatePartyQueries } from './useParties';
import { invalidateItemQueries } from './useInventory';
import { invalidateGodownQueries } from './useGodowns';
import { invalidateCashBankQueries } from './useCashBankAccounts';
import { reportQueryKeys } from '../state/domainQueryKeys';

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
        onSuccess: async () => {
            await invalidateInvoiceViews(queryClient, businessId);
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
        onSuccess: async () => {
            await invalidateInvoiceViews(queryClient, businessId);
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
