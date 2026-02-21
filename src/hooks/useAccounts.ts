import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountRepository } from '../repositories/accountRepository';
import { useOrganizationStore } from '../store';
import type { NewDbAccount } from '../types/db';
import type { AccountType } from '../types';

export const useAccounts = () => {
    const queryClient = useQueryClient();
    const organizationId = useOrganizationStore(s => s.selectedOrganizationId);

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts', organizationId],
        queryFn: async () => {
            if (!organizationId) return [];
            const data = await accountRepository.getAll(organizationId);
            return data.map(acc => ({
                ...acc,
                type: acc.type as AccountType,
                isActive: acc.isActive ?? true,
                isSystem: acc.isSystem ?? false,
            }));
        },
        enabled: !!organizationId,
    });

    const createAccount = useMutation({
        mutationFn: (account: NewDbAccount) => accountRepository.create(account),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts', organizationId] });
        },
    });

    return {
        accounts,
        loading: isLoading,
        createAccount,
    };
};
