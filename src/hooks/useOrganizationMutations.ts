import { useMutation, useQueryClient } from '@tanstack/react-query';
import { businessRepository } from '../repositories/businessRepository';
import { invalidateOrganizationQueries } from './useOrganizations';
import type { Business } from '../types/domain';

type CreateOrganizationInput = {
    name: string;
    code: string;
    currency: string;
    legalName?: string;
    phoneNumber?: string;
    email?: string;
    gstNumber?: string;
    address?: string;
    state?: string;
    city?: string;
    pincode?: string;
    booksStartDate?: string;
    openingCashInHand?: number;
    openingCashInBank?: number;
};

const toBusinessPayload = (input: CreateOrganizationInput): Partial<Business> => ({
    name: input.name,
    code: input.code,
    currency: input.currency,
    legalName: input.legalName ?? null,
    phone: input.phoneNumber ?? null,
    email: input.email ?? null,
    gstin: input.gstNumber ?? null,
    address: input.address ?? null,
    state: input.state ?? null,
    city: input.city ?? null,
    pincode: input.pincode ?? null,
    booksStartDate: input.booksStartDate ?? null,
    openingCashInHand: input.openingCashInHand ?? null,
    openingCashInBank: input.openingCashInBank ?? null,
});

export function useOrganizationMutations() {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (input: CreateOrganizationInput) => {
            return businessRepository.create(toBusinessPayload(input));
        },
        onSuccess: async () => {
            await invalidateOrganizationQueries(queryClient);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (businessId: string) => {
            return businessRepository.remove(businessId);
        },
        onSuccess: async () => {
            await invalidateOrganizationQueries(queryClient);
        },
    });

    return {
        createOrganization: createMutation.mutateAsync,
        deleteOrganization: deleteMutation.mutateAsync,
        isCreatingOrganization: createMutation.isPending,
        isDeletingOrganization: deleteMutation.isPending,
    };
}
