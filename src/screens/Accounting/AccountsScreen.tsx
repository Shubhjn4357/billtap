import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import type { Account, AccountType } from '../../types';
import { isNetworkLikeError } from '../../utils/errorGuards';

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export const AccountsScreen = () => {
    const theme = useTheme();
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<AccountType | 'ALL'>('ALL');
    const [saving, setSaving] = useState(false);

    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState<AccountType>('ASSET');

    const accountsQuery = useQuery({
        queryKey: ['accounting-accounts'] as const,
        queryFn: async (): Promise<Account[]> => {
            return await accountingService.getAccounts();
        },
        staleTime: 30_000,
    });

    const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
    const queryError = useMemo(() => {
        if (!accountsQuery.error || isNetworkLikeError(accountsQuery.error)) {
            return null;
        }
        return accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load accounts.';
    }, [accountsQuery.error]);

    useFocusEffect(
        useCallback(() => {
            void accountsQuery.refetch();
        }, [accountsQuery])
    );

    const filteredAccounts = useMemo(() => {
        if (filter === 'ALL') return accounts;
        return accounts.filter((entry) => entry.type === filter);
    }, [accounts, filter]);

    const handleSeedDefaults = async () => {
        setSaving(true);
        setError(null);
        try {
            await accountingService.seedDefaultAccounts();
            await accountsQuery.refetch();
        } catch (seedError: unknown) {
            setError(seedError instanceof Error ? seedError.message : 'Failed to seed default accounts.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if (!code.trim() || !name.trim()) {
            setError('Code and name are required.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await accountingService.createAccount({
                code: code.trim().toUpperCase(),
                name: name.trim(),
                type,
            });
            setCode('');
            setName('');
            await accountsQuery.refetch();
        } catch (createError: unknown) {
            setError(createError instanceof Error ? createError.message : 'Failed to create account.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}>
                <PageHeaderCard
                    title="Chart Of Accounts"
                    subtitle="Create and organize your accounting heads."
                />

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
                        {error}
                    </Text>
                ) : null}
                {!error && queryError ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
                        {queryError}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Setup</Text>
                    <AppButton mode="contained-tonal" onPress={() => { void handleSeedDefaults(); }} loading={saving}>
                        Seed Default Accounts
                    </AppButton>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Add Account</Text>
                    <AppInput label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
                    <AppInput label="Name" value={name} onChangeText={setName} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row' }}>
                            {ACCOUNT_TYPES.map((entry) => (
                                <Chip
                                    key={entry}
                                    selected={entry === type}
                                    onPress={() => setType(entry)}
                                    style={{ marginRight: 8 }}
                                >
                                    {entry}
                                </Chip>
                            ))}
                        </View>
                    </ScrollView>
                    <AppButton mode="contained" onPress={() => { void handleCreate(); }} loading={saving}>
                        Save Account
                    </AppButton>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Accounts ({filteredAccounts.length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row' }}>
                            <Chip selected={filter === 'ALL'} onPress={() => setFilter('ALL')} style={{ marginRight: 8 }}>ALL</Chip>
                            {ACCOUNT_TYPES.map((entry) => (
                                <Chip
                                    key={entry}
                                    selected={filter === entry}
                                    onPress={() => setFilter(entry)}
                                    style={{ marginRight: 8 }}
                                >
                                    {entry}
                                </Chip>
                            ))}
                        </View>
                    </ScrollView>

                    {accountsQuery.isFetching && accounts.length === 0 ? (
                        <Text variant="bodySmall">Loading accounts...</Text>
                    ) : (
                        filteredAccounts.map((entry) => (
                            <View key={entry.id} style={{ marginBottom: 10 }}>
                                <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
                                    {entry.code} - {entry.name}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    {entry.type} | {entry.isSystem ? 'System' : 'Custom'} | {entry.isActive ? 'Active' : 'Inactive'}
                                </Text>
                            </View>
                        ))
                    )}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
