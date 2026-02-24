import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import type { Account, AccountType } from '../../types';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export const AccountsScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
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
        staleTime: 45_000,
    });
    const { refetch: refetchAccounts } = accountsQuery;

    const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
    const queryError = useMemo(() => {
        if (!accountsQuery.error || isNetworkLikeError(accountsQuery.error)) {
            return null;
        }
        return accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load accounts.';
    }, [accountsQuery.error]);

    useFocusRefresh(() => {
        void refetchAccounts();
    }, { minIntervalMs: 10_000 });

    const filteredAccounts = useMemo(() => {
        if (filter === 'ALL') return accounts;
        return accounts.filter((entry) => entry.type === filter);
    }, [accounts, filter]);

    const handleSeedDefaults = async () => {
        setSaving(true);
        setError(null);
        try {
            await accountingService.seedDefaultAccounts();
            await refetchAccounts();
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
            await refetchAccounts();
        } catch (createError: unknown) {
            setError(createError instanceof Error ? createError.message : 'Failed to create account.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={accountsQuery.isFetching} onRefresh={() => { void refetchAccounts(); }}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Chart Of Accounts"
                        subtitle="Create and organize your accounting heads."
                    />

                    {error ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : null}
                    {!error && queryError ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {queryError}
                        </Text>
                    ) : null}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Setup</Text>
                        <AppButton mode="contained-tonal" onPress={() => { void handleSeedDefaults(); }} loading={saving}>
                            Seed Default Accounts
                        </AppButton>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Add Account</Text>
                        <AppInput label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" inputType="text" />
                        <AppInput label="Name" value={name} onChangeText={setName} inputType="name" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {ACCOUNT_TYPES.map((entry) => (
                                <Chip
                                    key={entry}
                                    selected={entry === type}
                                    onPress={() => setType(entry)}
                                    style={styles.chipSpaced}
                                >
                                    {entry}
                                </Chip>
                            ))}
                        </ScrollView>
                        <AppButton mode="contained" onPress={() => { void handleCreate(); }} loading={saving}>
                            Save Account
                        </AppButton>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Accounts ({filteredAccounts.length})
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            <Chip selected={filter === 'ALL'} onPress={() => setFilter('ALL')} style={styles.chipSpaced}>ALL</Chip>
                            {ACCOUNT_TYPES.map((entry) => (
                                <Chip
                                    key={entry}
                                    selected={filter === entry}
                                    onPress={() => setFilter(entry)}
                                    style={styles.chipSpaced}
                                >
                                    {entry}
                                </Chip>
                            ))}
                        </ScrollView>

                        {accountsQuery.isFetching && accounts.length === 0 ? (
                            <Text variant="bodySmall">Loading accounts...</Text>
                        ) : (
                            filteredAccounts.map((entry) => (
                                <View key={entry.id} style={styles.accountRow}>
                                    <Text variant="bodyMedium" style={styles.accountTitle}>
                                        {entry.code} - {entry.name}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                        {entry.type} | {entry.isSystem ? 'System' : 'Custom'} | {entry.isActive ? 'Active' : 'Inactive'}
                                    </Text>
                                </View>
                            ))
                        )}
                    </AppCard>
                </View>
            </ScrollView>
            </AppPullToRefresh>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        gap: DesignSystem.layout.sectionGap,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    errorText: {
        marginTop: DesignSystem.spacing.xs + 2,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    sectionTitleWithGap: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs + 2,
    },
    chipRow: {
        flexDirection: 'row',
        marginBottom: DesignSystem.spacing.sm,
    },
    chipSpaced: {
        marginRight: DesignSystem.spacing.xs + 2,
    },
    accountRow: {
        marginBottom: DesignSystem.spacing.sm,
    },
    accountTitle: {
        fontWeight: '700',
    },
});
