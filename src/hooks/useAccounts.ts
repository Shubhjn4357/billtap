import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountRepository } from '../repositories/accountRepository';
import { useAuth } from './useAuth';
import type { NewDbAccount } from '../types/db';

export const useAccounts = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const organizationId = user?.uid ?? '';

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts', organizationId],
        queryFn: async () => {
            const data = await accountRepository.getAll(organizationId);
            return data.map(acc => ({
                ...acc,
                type: acc.type as any, // Cast to App AccountType
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
