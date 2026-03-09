import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidatePartyQueries } from './useParties';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { partyRepository } from '../repositories/partyRepository';

type SavePartyInput = {
    id?: string;
    data: Parameters<typeof partyRepository.create>[0];
};

export function usePartyMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveMutation = useMutation({
        mutationFn: ({ id, data }: SavePartyInput) => (
            id ? partyRepository.update(id, data) : partyRepository.create(data)
        ),
        onSuccess: async () => {
            await invalidatePartyQueries(queryClient, businessId);
        },
    });

    const archiveMutation = useMutation({
        mutationFn: (id: string) => partyRepository.delete(id),
        onSuccess: async () => {
            await invalidatePartyQueries(queryClient, businessId);
        },
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => partyRepository.restore(id),
        onSuccess: async () => {
            await invalidatePartyQueries(queryClient, businessId);
        },
    });

    const permanentDeleteMutation = useMutation({
        mutationFn: (id: string) => partyRepository.permanentDelete(id),
        onSuccess: async () => {
            await invalidatePartyQueries(queryClient, businessId);
        },
    });

    const bulkArchiveMutation = useMutation({
        mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => partyRepository.delete(id))),
        onSuccess: async () => {
            await invalidatePartyQueries(queryClient, businessId);
        },
    });

    const bulkResetCreditLimitMutation = useMutation({
        mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => partyRepository.update(id, { creditLimit: 0 }))),
        onSuccess: async () => {
            await invalidatePartyQueries(queryClient, businessId);
        },
    });

    return {
        saveParty: saveMutation.mutateAsync,
        archiveParty: archiveMutation.mutateAsync,
        restoreParty: restoreMutation.mutateAsync,
        permanentlyDeleteParty: permanentDeleteMutation.mutateAsync,
        archiveParties: bulkArchiveMutation.mutateAsync,
        resetPartyCreditLimits: bulkResetCreditLimitMutation.mutateAsync,
        isSavingParty: saveMutation.isPending,
        isArchivingParty: archiveMutation.isPending,
        isRestoringParty: restoreMutation.isPending,
        isDeletingPartyPermanently: permanentDeleteMutation.isPending,
        isArchivingParties: bulkArchiveMutation.isPending,
        isResettingPartyCreditLimits: bulkResetCreditLimitMutation.isPending,
    };
}
