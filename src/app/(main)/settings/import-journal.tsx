import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAccountingAccounts } from '../../../hooks/useAccountingAccounts';
import { useAccountingAccountMutations } from '../../../hooks/useAccountingMutations';
import { useAppColors } from '../../../hooks/useAppColors';
import { Radius, Spacing } from '../../../constants/theme';
import { getSurfaceStyle, DESIGN_SPACING } from '../../../constants/designSystem';

export function parseCSV(text: string) {
    const lines = text.split('\n');
    const result = [];
    for (const l of lines) {
        if (!l.trim()) continue;
        result.push(l.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
    }
    return result;
}

export default function ImportJournalScreen() {
    const colors = useAppColors();
    const s = styles(colors);

    const { accounts } = useAccountingAccounts();
    const { createJournal, isCreatingJournal } = useAccountingAccountMutations();

    const [isParsing, setIsParsing] = useState(false);
    const [previewCount, setPreviewCount] = useState(0);
    const [parsedJournals, setParsedJournals] = useState<any[]>([]);

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

            const headers = parsed[0].map(h => h.toLowerCase());
            const dateIdx = headers.findIndex(h => h.includes('date'));
            const narrIdx = headers.findIndex(h => h.includes('narration') || h.includes('description'));
            const codeIdx = headers.findIndex(h => h.includes('account') || h.includes('code'));
            const drIdx = headers.findIndex(h => h.includes('debit') || h.includes('dr'));
            const crIdx = headers.findIndex(h => h.includes('credit') || h.includes('cr'));

            if (dateIdx === -1 || codeIdx === -1 || drIdx === -1 || crIdx === -1) {
                throw new Error("Missing required columns: Date, Account, Debit, Credit.");
            }

            // Group by Date + Narration
            const groups = new Map<string, any>();

            for (let i = 1; i < parsed.length; i++) {
                const row = parsed[i];
                if (row.length < 4) continue;
                
                const groupKey = `${row[dateIdx]}_${row[narrIdx] || ''}`;
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, { date: row[dateIdx], narration: row[narrIdx], lines: [] });
                }

                const accCode = row[codeIdx];
                const matchedAccount = accounts.find(a => a.code === accCode || a.name === accCode);
                if (!matchedAccount) {
                    throw new Error(`Account code/name "${accCode}" not found in Vahi ledgers (Row ${i+1}).`);
                }

                const drVal = Number(row[drIdx]) || 0;
                const crVal = Number(row[crIdx]) || 0;

                groups.get(groupKey)!.lines.push({
                    accountId: matchedAccount.id,
                    debit: drVal,
                    credit: crVal,
                });
            }

            const validJournals = Array.from(groups.values()).filter(j => {
                const drMap = j.lines.reduce((s: number, l: any) => s + l.debit, 0);
                const crMap = j.lines.reduce((s: number, l: any) => s + l.credit, 0);
                return Math.abs(drMap - crMap) < 0.01 && drMap > 0;
            });

            setParsedJournals(validJournals);
            setPreviewCount(validJournals.length);
        } catch (e) {
            Alert.alert("Upload Failed", e instanceof Error ? e.message : "Error reading CSV");
            setParsedJournals([]);
            setPreviewCount(0);
        } finally {
            setIsParsing(false);
        }
    };

    const handleImport = async () => {
        if (parsedJournals.length === 0) return;
        try {
            for (const j of parsedJournals) {
                createJournal({
                    date: new Date(j.date),
                    narration: j.narration,
                    lines: j.lines,
                });
            }
            Alert.alert("Success", `Queued ${parsedJournals.length} journals for import safely.`);
            router.back();
        } catch (error) {
            Alert.alert("Import Failed", error instanceof Error ? error.message : "Unknown error");
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar title="Bulk Import Journals" subtitle="Import legacy entries via CSV" onBackPress={() => router.back()} />
            
            <ScrollView contentContainerStyle={s.content}>
                <View style={[s.card, getSurfaceStyle(colors, {})]}>
                    <Text style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>
                        Your CSV must contain the following headers: Date, Narration, Account, Debit, Credit.
                    </Text>

                    <Pressable
                        style={[s.button, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
                        onPress={handleUpload}
                        disabled={isParsing}
                    >
                        {isParsing ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Select CSV File</Text>}
                    </Pressable>
                </View>

                {previewCount > 0 && (
                    <View style={[s.card, getSurfaceStyle(colors, { elevated: true })]}>
                        <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} style={{ alignSelf: 'center' }} />
                        <Text style={{ textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>
                            {previewCount} Valid Journals Ready
                        </Text>
                        <Text style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: Spacing.lg }}>
                            All accounts map correctly and Debits match Credits.
                        </Text>
                        
                        <Pressable
                            style={[s.button, { backgroundColor: colors.success }]}
                            onPress={handleImport}
                            disabled={isCreatingJournal}
                        >
                            {isCreatingJournal ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Confirm & Import</Text>}
                        </Pressable>
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
});
