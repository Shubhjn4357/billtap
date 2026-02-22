import { Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountRepository } from '../repositories/accountRepository';
import { accountingService } from '../api/accountingService';
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

            if (Platform.OS === 'web') {
                return await accountingService.getAccounts();
            }

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
        mutationFn: async (account: NewDbAccount) => {
            if (Platform.OS === 'web') {
                return await accountingService.createAccount({
                    code: (account as any).code || '',
                    name: account.name,
                    type: account.type as AccountType,
                    isActive: account.isActive ?? true,
                });
            }
            const result = await accountRepository.create(account);
            return typeof result === 'string' ? result : '';
        },
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
