import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Menu, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { accountingService } from '../../api/accountingService';
import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { AppDateField } from '../../components/common/AppDateField';
import { AppInput } from '../../components/common/AppInput';
import { SummaryCard } from '../../components/common/SummaryCard';
import { DesignSystem } from '../../constants/DesignSystem';
import type { Account } from '../../types';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AccountingWorkspaceShell } from './components/AccountingWorkspaceShell';
import { useAccountingRange } from './context/AccountingRangeContext';

interface DraftLine {
    id: string;
    accountId: string;
    debit: string;
    credit: string;
}

const toNumber = (value: string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const JournalEntryScreen = () => {
    const theme = useTheme();
    const { endDate } = useAccountingRange();

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
    const [entryDateValue, setEntryDateValue] = useState<Date | undefined>(endDate);
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
                entryDate: entryDateValue ? entryDateValue.toISOString().slice(0, 10) : undefined,
                narration: narration.trim() || undefined,
                lines: normalizedLines,
            });
            setLines([
                { id: 'line-1', accountId: '', debit: '', credit: '' },
                { id: 'line-2', accountId: '', debit: '', credit: '' },
            ]);
            setNarration('');
            setEntryDateValue(endDate);
        } catch (saveError: unknown) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save journal.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AccountingWorkspaceShell
            title="Journal Voucher"
            subtitle="Fast line posting with live balance checks."
            activeSegment="journal"
            refreshing={accountsQuery.isFetching}
            onRefresh={() => { void accountsQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : queryError ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {queryError}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard label="Debit" value={totals.totalDebit.toFixed(2)} tone="neutral" />
                <SummaryCard label="Credit" value={totals.totalCredit.toFixed(2)} tone="neutral" />
                <SummaryCard label="Status" value={totals.isBalanced ? 'Balanced' : 'Mismatch'} tone={totals.isBalanced ? 'positive' : 'negative'} />
            </View>

            <AppAccordion title="Voucher Header" icon="file-document-edit-outline" defaultExpanded>
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
            </AppAccordion>

            <AppAccordion title="Voucher Lines" icon="format-list-bulleted" defaultExpanded>
                {lines.map((line, index) => {
                    const selectedAccount = accounts.find((entry) => entry.id === line.accountId);
                    return (
                        <View key={line.id} style={[styles.lineBlock, { borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
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
            </AppAccordion>

            <AppAccordion title="Post Entry" icon="send-outline" defaultExpanded>
                <Text variant="bodySmall">Debit: {totals.totalDebit.toFixed(2)}</Text>
                <Text variant="bodySmall">Credit: {totals.totalCredit.toFixed(2)}</Text>
                <Text variant="bodySmall" style={{ color: totals.isBalanced ? theme.colors.primary : theme.colors.error }}>
                    {totals.isBalanced ? 'Balanced' : 'Not Balanced'}
                </Text>
                <AppButton mode="contained" onPress={() => { void handleSave(); }} loading={saving} style={styles.postButton}>
                    Post Entry
                </AppButton>
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
    lineBlock: {
        marginBottom: DesignSystem.spacing.sm,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
    },
    accountSelectButton: {
        marginBottom: DesignSystem.spacing.xs,
        marginTop: 4,
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
        borderRadius: DesignSystem.radius.pill,
    },
});
