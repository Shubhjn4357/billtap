import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAccountingAccounts } from '../../../hooks/useAccountingAccounts';
import { SelectField } from '../../../components/ui/SelectField';
import { useAppColors } from '../../../hooks/useAppColors';
import { Radius, Spacing } from '../../../constants/theme';
import { getSurfaceStyle, DESIGN_SPACING } from '../../../constants/designSystem';
import { useQuery } from '@tanstack/react-query';
import client from '../../../api/client';

export function parseCSV(text: string) {
    const lines = text.split('\n');
    const result = [];
    for (const l of lines) {
        if (!l.trim()) continue;
        result.push(l.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
    }
    return result;
}

type BankRow = { date: string; narration: string; amount: number; type: 'Dr' | 'Cr' };

export default function BankReconciliationScreen() {
    const colors = useAppColors();
    const s = styles(colors);

    const { accounts } = useAccountingAccounts({ type: 'ASSET' });
    const bankAccounts = useMemo(() => accounts.filter(a => a.code.startsWith('1010')), [accounts]);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

    const ledgerQuery = useQuery({
        queryKey: ['accounting', 'ledger', selectedBankId],
        queryFn: async () => {
            const res = await client.get(`/accounting/ledgers/${selectedBankId}?limit=1000`);
            return res.data;
        },
        enabled: Boolean(selectedBankId),
    });
    
    const ledgerEntriesRaw = ledgerQuery.data?.data?.entries;
    const ledgerEntries = useMemo(() => ledgerEntriesRaw || [], [ledgerEntriesRaw]);

    const [bankRows, setBankRows] = useState<BankRow[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    const handleUpload = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '.csv'] });
            if (res.canceled) return;
            const file = res.assets[0];
            setIsParsing(true);
            
            let text = '';
            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                text = await response.text();
            } else {
                text = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' });
            }

            const parsed = parseCSV(text);
            if (parsed.length < 2) throw new Error("CSV appears empty or invalid.");

            // Extremely basic mapping: assumes Date, Narration, Withdrawals (Dr), Deposits (Cr)
            const headers = parsed[0].map(h => h.toLowerCase());
            const dateIdx = headers.findIndex(h => h.includes('date'));
            const narrIdx = headers.findIndex(h => h.includes('particulars') || h.includes('narration') || h.includes('description'));
            const drIdx = headers.findIndex(h => h.includes('withdraw') || h.includes('debit'));
            const crIdx = headers.findIndex(h => h.includes('deposit') || h.includes('credit'));

            if (dateIdx === -1 || narrIdx === -1) {
                throw new Error("Could not find standard columns (Date, Description) in CSV header.");
            }

            const extracted: BankRow[] = [];
            for (let i = 1; i < parsed.length; i++) {
                const row = parsed[i];
                if (row.length < 2) continue;
                
                let amount = 0;
                let type: 'Dr' | 'Cr' = 'Dr';

                const drVal = drIdx !== -1 ? Number(row[drIdx]) || 0 : 0;
                const crVal = crIdx !== -1 ? Number(row[crIdx]) || 0 : 0;

                if (drVal > 0) { amount = drVal; type = 'Dr'; }
                else if (crVal > 0) { amount = crVal; type = 'Cr'; }

                if (amount > 0) {
                    extracted.push({
                        date: row[dateIdx],
                        narration: row[narrIdx],
                        amount,
                        type,
                    });
                }
            }

            setBankRows(extracted);
        } catch (e) {
            Alert.alert("Upload Failed", e instanceof Error ? e.message : "Error reading CSV");
        } finally {
            setIsParsing(false);
        }
    };

    const matcher = useMemo(() => {
        if (!selectedBankId || bankRows.length === 0) return { matched: [], unmatchedBank: [], unmatchedLedger: [] };
        
        const matched = [];
        const unmatchedBank = [];
        const unmatchedLedger = [...(ledgerEntries || [])];

        for (const bRow of bankRows) {
            let foundIdx = -1;
            for (let i = 0; i < unmatchedLedger.length; i++) {
                const lRow = unmatchedLedger[i];
                const lAmount = lRow.debit > 0 ? Number(lRow.debit) : Number(lRow.credit);
                const lType = lRow.debit > 0 ? 'Dr' : 'Cr';

                // Note: Bank Deposits (Cr in bank) map to Asset Dr in Ledger.
                // Bank Withdrawals (Dr in bank) map to Asset Cr in Ledger.
                const mappedType = bRow.type === 'Cr' ? 'Dr' : 'Cr';

                if (lType === mappedType && Math.abs(lAmount - bRow.amount) < 0.01) {
                    foundIdx = i;
                    break;
                }
            }

            if (foundIdx !== -1) {
                matched.push({ bank: bRow, ledger: unmatchedLedger[foundIdx] });
                unmatchedLedger.splice(foundIdx, 1);
            } else {
                unmatchedBank.push(bRow);
            }
        }

        return { matched, unmatchedBank, unmatchedLedger };
    }, [bankRows, ledgerEntries, selectedBankId]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar title="Bank Reconciliation" subtitle="Match CSV statement with internal Ledgers" onBackPress={() => router.back()} />
            
            <ScrollView contentContainerStyle={s.content}>
                <View style={[s.card, getSurfaceStyle(colors, {})]}>
                    <SelectField
                        title="Bank Account"
                        placeholder="Select Bank Ledger"
                        value={selectedBankId}
                        onChange={setSelectedBankId}
                        options={bankAccounts.map(b => ({ label: `${b.code} - ${b.name}`, value: b.id }))}
                    />

                    <Pressable
                        style={[s.button, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
                        onPress={handleUpload}
                        disabled={isParsing || !selectedBankId}
                    >
                        {isParsing ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Upload Bank CSV</Text>}
                    </Pressable>
                </View>

                {selectedBankId && bankRows.length > 0 && (
                    <View style={s.results}>
                        <View style={s.statsRow}>
                            <View style={[s.statBox, { backgroundColor: colors.success }]}>
                                <Text style={s.statNum}>{matcher.matched.length}</Text>
                                <Text style={s.statLabel}>Matched</Text>
                            </View>
                            <View style={[s.statBox, { backgroundColor: colors.warning }]}>
                                <Text style={s.statNum}>{matcher.unmatchedBank.length}</Text>
                                <Text style={s.statLabel}>Missing in Vahi</Text>
                            </View>
                            <View style={[s.statBox, { backgroundColor: colors.error }]}>
                                <Text style={s.statNum}>{matcher.unmatchedLedger.length}</Text>
                                <Text style={s.statLabel}>Missing in Bank</Text>
                            </View>
                        </View>

                        {matcher.unmatchedBank.length > 0 && (
                            <View style={[s.card, getSurfaceStyle(colors, {})]}>
                                <Text style={[s.sectionTitle, { color: colors.warning }]}>Unmatched Bank Entries (Action Req.)</Text>
                                {matcher.unmatchedBank.map((r, i) => (
                                    <View key={i} style={s.row}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text, fontSize: 13 }}>{r.date} | {r.narration}</Text>
                                        </View>
                                        <Text style={{ color: colors.text, fontWeight: '700' }}>Rs {r.amount}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: any) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: DESIGN_SPACING.screenX, gap: Spacing.md, paddingBottom: 100 },
    card: { padding: Spacing.md, borderRadius: Radius.card, gap: Spacing.sm },
    button: { width: '100%', height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    results: { gap: Spacing.md },
    statsRow: { flexDirection: 'row', gap: Spacing.sm },
    statBox: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
    statNum: { color: '#fff', fontSize: 24, fontWeight: '700' },
    statLabel: { color: '#fff', fontSize: 12, opacity: 0.9 },
    sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderColor: colors.border },
});
