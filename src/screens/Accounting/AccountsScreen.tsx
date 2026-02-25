import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { accountingService } from '../../api/accountingService';
import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { SummaryCard } from '../../components/common/SummaryCard';
import { DesignSystem } from '../../constants/DesignSystem';
import type { Account, AccountType } from '../../types';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AccountingWorkspaceShell } from './components/AccountingWorkspaceShell';

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

const countByType = (accounts: Account[], type: AccountType) => accounts.filter((entry) => entry.type === type).length;

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
        queryFn: async (): Promise<Account[]> => accountingService.getAccounts(),
        staleTime: 45_000,
    });

    const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
    const queryError = useMemo(() => {
        if (!accountsQuery.error || isNetworkLikeError(accountsQuery.error)) {
            return null;
        }
        return accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load accounts.';
    }, [accountsQuery.error]);

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
        <AccountingWorkspaceShell
            title="Chart Of Accounts"
            subtitle="Simple account setup and category filters."
            activeSegment="accounts"
            refreshing={accountsQuery.isFetching}
            onRefresh={() => { void accountsQuery.refetch(); }}
        >
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

            <View style={styles.summaryRow}>
                <SummaryCard label="Total" value={String(accounts.length)} tone="neutral" />
                <SummaryCard label="Assets" value={String(countByType(accounts, 'ASSET'))} tone="positive" />
                <SummaryCard label="Income" value={String(countByType(accounts, 'INCOME'))} tone="warning" />
            </View>

            <AppAccordion title="Setup Actions" icon="cog-outline" defaultExpanded>
                <AppButton mode="contained-tonal" onPress={() => { void handleSeedDefaults(); }} loading={saving}>
                    Seed Default Accounts
                </AppButton>
            </AppAccordion>

            <AppAccordion title="Add Account" icon="plus-box-outline" defaultExpanded>
                <AppInput label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" inputType="text" />
                <AppInput label="Name" value={name} onChangeText={setName} inputType="name" />
                <View style={styles.chipRow}>
                    {ACCOUNT_TYPES.map((entry) => (
                        <Chip key={entry} selected={entry === type} onPress={() => setType(entry)} style={styles.chipPill}>
                            {entry}
                        </Chip>
                    ))}
                </View>
                <AppButton mode="contained" onPress={() => { void handleCreate(); }} loading={saving}>
                    Save Account
                </AppButton>
            </AppAccordion>

            <AppAccordion title={`Accounts (${filteredAccounts.length})`} icon="shape-outline" defaultExpanded>
                <View style={styles.chipRow}>
                    <Chip selected={filter === 'ALL'} onPress={() => setFilter('ALL')} style={styles.chipPill}>ALL</Chip>
                    {ACCOUNT_TYPES.map((entry) => (
                        <Chip
                            key={entry}
                            selected={filter === entry}
                            onPress={() => setFilter(entry)}
                            style={styles.chipPill}
                        >
                            {entry}
                        </Chip>
                    ))}
                </View>

                {filteredAccounts.map((entry) => (
                    <View key={entry.id} style={[styles.accountRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.accountTitle}>
                            {entry.code} - {entry.name}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {entry.type} • {entry.isSystem ? 'System' : 'Custom'} • {entry.isActive ? 'Active' : 'Inactive'}
                        </Text>
                    </View>
                ))}
            </AppAccordion>
        </AccountingWorkspaceShell>
    );
};

const styles = StyleSheet.create({
    errorText: {
        marginTop: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: DesignSystem.spacing.sm,
    },
    chipPill: {
        borderRadius: DesignSystem.radius.pill,
    },
    accountRow: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
    },
    accountTitle: {
        fontWeight: '700',
    },
});
