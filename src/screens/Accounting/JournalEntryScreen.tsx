import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, useTheme, Menu, Button } from 'react-native-paper';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import type { Account } from '../../types';

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
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [lines, setLines] = useState<DraftLine[]>([
        { id: 'line-1', accountId: '', debit: '', credit: '' },
        { id: 'line-2', accountId: '', debit: '', credit: '' },
    ]);
    const [menuLineId, setMenuLineId] = useState<string | null>(null);
    const [narration, setNarration] = useState('');
    const [entryDate, setEntryDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            const data = await accountingService.getAccounts();
            setAccounts(data.filter((entry) => entry.isActive));
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load accounts.');
        }
    }, []);

    useEffect(() => {
        void loadAccounts();
    }, [loadAccounts]);

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
            setEntryDate('');
        } catch (saveError: unknown) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save journal.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}>
                <PageHeaderCard
                    title="Journal Voucher"
                    subtitle="Post balanced accounting entries manually."
                />

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <AppInput
                        label="Entry Date (YYYY-MM-DD)"
                        value={entryDate}
                        onChangeText={setEntryDate}
                        placeholder="2026-02-14"
                    />
                    <AppInput
                        label="Narration"
                        value={narration}
                        onChangeText={setNarration}
                        multiline
                    />
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>Lines</Text>
                    {lines.map((line, index) => {
                        const selectedAccount = accounts.find((entry) => entry.id === line.accountId);
                        return (
                            <View key={line.id} style={{ marginBottom: 12 }}>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    Line {index + 1}
                                </Text>
                                <Menu
                                    visible={menuLineId === line.id}
                                    onDismiss={() => setMenuLineId(null)}
                                    anchor={(
                                        <Button mode="outlined" onPress={() => setMenuLineId(line.id)} style={{ marginBottom: 8 }}>
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
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <AppInput
                                        label="Debit"
                                        value={line.debit}
                                        onChangeText={(value) => updateLine(line.id, { debit: value })}
                                        keyboardType="numeric"
                                        style={{ flex: 1 }}
                                    />
                                    <AppInput
                                        label="Credit"
                                        value={line.credit}
                                        onChangeText={(value) => updateLine(line.id, { credit: value })}
                                        keyboardType="numeric"
                                        style={{ flex: 1 }}
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
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Totals</Text>
                    <Text variant="bodySmall">Debit: {totals.totalDebit.toFixed(2)}</Text>
                    <Text variant="bodySmall">Credit: {totals.totalCredit.toFixed(2)}</Text>
                    <Text variant="bodySmall" style={{ color: totals.isBalanced ? theme.colors.primary : theme.colors.error }}>
                        {totals.isBalanced ? 'Balanced' : 'Not Balanced'}
                    </Text>
                    <AppButton mode="contained" onPress={() => { void handleSave(); }} loading={saving} style={{ marginTop: 8 }}>
                        Post Entry
                    </AppButton>
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
