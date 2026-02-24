import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme, Menu, Button } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppDateField } from '../../components/common/AppDateField';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import type { Account } from '../../types';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';

interface DraftLine {
    id: string;
    accountId: string;
    debit: string;
    credit: string;
}

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const JournalEntryScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const accountsQuery = useQuery({
        queryKey: ['accounting-journal-accounts'] as const,
        queryFn: async (): Promise<Account[]> => {
            const data = await accountingService.getAccounts();
            return data.filter((entry) => entry.isActive);
        },
        staleTime: 60_000,
    });

    const accounts = accountsQuery.data ?? [];
    const queryError = accountsQuery.error && !isNetworkLikeError(accountsQuery.error)
        ? (accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load accounts.')
        : null;

    const [lines, setLines] = useState<DraftLine[]>([
        { id: 'line-1', accountId: '', debit: '', credit: '' },
        { id: 'line-2', accountId: '', debit: '', credit: '' },
    ]);
    const [menuLineId, setMenuLineId] = useState<string | null>(null);
    const [narration, setNarration] = useState('');
    const [entryDateValue, setEntryDateValue] = useState<Date | undefined>(undefined);
    const entryDate = entryDateValue ? entryDateValue.toISOString().slice(0, 10) : '';
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totals = useMemo(() => {
        const totalDebit = lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
        const totalCredit = lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
        return {
            totalDebit,
            totalCredit,
            isBalanced: Math.abs(totalDebit - totalCredit) < 0.001,
        };
    }, [lines]);

    const updateLine = (lineId: string, updates: Partial<DraftLine>) => {
        setLines((current) => current.map((entry) => (entry.id === lineId ? { ...entry, ...updates } : entry)));
    };

    const addLine = () => {
        setLines((current) => [...current, { id: `line-${Date.now()}`, accountId: '', debit: '', credit: '' }]);
    };

    const removeLine = (lineId: string) => {
        setLines((current) => (current.length <= 2 ? current : current.filter((entry) => entry.id !== lineId)));
    };

    const handleSave = async () => {
        setError(null);
        const normalizedLines = lines
            .map((line) => ({
                accountId: line.accountId,
                debit: toNumber(line.debit),
                credit: toNumber(line.credit),
            }))
            .filter((line) => line.accountId && (line.debit > 0 || line.credit > 0));

        if (normalizedLines.length < 2) {
            setError('Add at least 2 valid lines.');
            return;
        }
        if (!totals.isBalanced) {
            setError('Entry is not balanced.');
            return;
        }

        setSaving(true);
        try {
            await accountingService.createJournalEntry({
                entryDate: entryDate.trim() || undefined,
                narration: narration.trim() || undefined,
                lines: normalizedLines,
            });
            setLines([
                { id: 'line-1', accountId: '', debit: '', credit: '' },
                { id: 'line-2', accountId: '', debit: '', credit: '' },
            ]);
            setNarration('');
            setEntryDateValue(undefined);
        } catch (saveError: unknown) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save journal.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={accountsQuery.isFetching} onRefresh={() => { void accountsQuery.refetch(); }}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Journal Voucher"
                        subtitle="Post balanced accounting entries manually."
                    />

                    {error ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : queryError ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {queryError}
                        </Text>
                    ) : null}

                    <AppCard>
                        <AppDateField
                            label="Entry Date"
                            value={entryDateValue}
                            onChange={setEntryDateValue}
                            placeholder="Select entry date"
                        />
                        <AppInput
                            label="Narration"
                            value={narration}
                            onChangeText={setNarration}
                            multiline
                            inputType="text"
                        />
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>Lines</Text>
                        {accountsQuery.isFetching && accounts.length === 0 ? (
                            <Text variant="bodySmall" style={[styles.loadingText, { color: theme.colors.outline }]}>
                                Loading accounts...
                            </Text>
                        ) : null}
                        {lines.map((line, index) => {
                            const selectedAccount = accounts.find((entry) => entry.id === line.accountId);
                            return (
                                <View key={line.id} style={styles.lineBlock}>
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                        Line {index + 1}
                                    </Text>
                                    <Menu
                                        visible={menuLineId === line.id}
                                        onDismiss={() => setMenuLineId(null)}
                                        anchor={(
                                            <Button mode="outlined" onPress={() => setMenuLineId(line.id)} style={styles.accountSelectButton}>
                                                {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : 'Select Account'}
                                            </Button>
                                        )}
                                    >
                                        {accounts.map((account) => (
                                            <Menu.Item
                                                key={account.id}
                                                title={`${account.code} - ${account.name}`}
                                                onPress={() => {
                                                    updateLine(line.id, { accountId: account.id });
                                                    setMenuLineId(null);
                                                }}
                                            />
                                        ))}
                                    </Menu>
                                    <View style={styles.amountRow}>
                                        <AppInput
                                            label="Debit"
                                            value={line.debit}
                                            onChangeText={(value) => updateLine(line.id, { debit: value })}
                                            inputType="decimal"
                                            style={[styles.amountInput, styles.amountInputRight]}
                                        />
                                        <AppInput
                                            label="Credit"
                                            value={line.credit}
                                            onChangeText={(value) => updateLine(line.id, { credit: value })}
                                            inputType="decimal"
                                            style={styles.amountInput}
                                        />
                                    </View>
                                    <AppButton mode="text" onPress={() => removeLine(line.id)}>
                                        Remove Line
                                    </AppButton>
                                </View>
                            );
                        })}

                        <AppButton mode="contained-tonal" onPress={addLine}>
                            Add Line
                        </AppButton>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Totals</Text>
                        <Text variant="bodySmall">Debit: {totals.totalDebit.toFixed(2)}</Text>
                        <Text variant="bodySmall">Credit: {totals.totalCredit.toFixed(2)}</Text>
                        <Text variant="bodySmall" style={{ color: totals.isBalanced ? theme.colors.primary : theme.colors.error }}>
                            {totals.isBalanced ? 'Balanced' : 'Not Balanced'}
                        </Text>
                        <AppButton mode="contained" onPress={() => { void handleSave(); }} loading={saving} style={styles.postButton}>
                            Post Entry
                        </AppButton>
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
        marginBottom: DesignSystem.spacing.xs,
    },
    loadingText: {
        marginBottom: DesignSystem.spacing.xs,
    },
    lineBlock: {
        marginBottom: DesignSystem.spacing.md - 2,
    },
    accountSelectButton: {
        marginBottom: DesignSystem.spacing.xs,
    },
    amountRow: {
        flexDirection: 'row',
    },
    amountInput: {
        flex: 1,
    },
    amountInputRight: {
        marginRight: DesignSystem.spacing.xs + 2,
    },
    postButton: {
        marginTop: DesignSystem.spacing.xs,
    },
});
