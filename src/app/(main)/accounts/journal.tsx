import { useState, useMemo } from 'react';
import { StyleSheet, View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAccountingAccountMutations } from '../../../hooks/useAccountingMutations';
import { useAccountingAccounts } from '../../../hooks/useAccountingAccounts';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { getSurfaceStyle, DESIGN_SPACING } from '../../../constants/designSystem';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { AppInput } from '../../../components/ui/AppInput';
import type { Account } from '../../../types/domain';

type JournalLine = {
    key: string;
    accountId: string;
    type: 'Dr' | 'Cr';
    amount: string;
};

const generateRowKey = () => Math.random().toString(36).substring(2, 9);

export default function JournalScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const { createJournal, isCreatingJournal } = useAccountingAccountMutations();
    const { accounts } = useAccountingAccounts();
    const activeAccounts = useMemo(() => accounts.filter((a: Account) => a.isActive !== false), [accounts]);

    const [narration, setNarration] = useState('');
    const [lines, setLines] = useState<JournalLine[]>([
        { key: generateRowKey(), accountId: '', type: 'Dr', amount: '' },
        { key: generateRowKey(), accountId: '', type: 'Cr', amount: '' },
    ]);

    const handleAddLine = () => {
        setLines(prev => [...prev, { key: generateRowKey(), accountId: '', type: 'Dr', amount: '' }]);
    };

    const handleRemoveLine = (key: string) => {
        setLines(prev => prev.filter(l => l.key !== key));
    };

    const handleUpdateLine = (key: string, updates: Partial<JournalLine>) => {
        setLines(prev => prev.map(l => l.key === key ? { ...l, ...updates } : l));
    };

    const totals = useMemo(() => {
        let dr = 0;
        let cr = 0;
        for (const line of lines) {
            const amt = Number(line.amount) || 0;
            if (line.type === 'Dr') dr += amt;
            if (line.type === 'Cr') cr += amt;
        }
        return { dr, cr, isBalanced: Math.abs(dr - cr) < 0.001 };
    }, [lines]);

    const handleSave = async () => {
        if (!totals.isBalanced) {
            Alert.alert('Unbalanced Entry', 'Total Debits must equal Total Credits before saving.');
            return;
        }
        if (totals.dr <= 0) {
            Alert.alert('Invalid Entry', 'Voucher amount must be strictly positive.');
            return;
        }

        const validLines = lines.filter(l => l.accountId && Number(l.amount) > 0);
        if (validLines.length < 2) {
            Alert.alert('Incomplete Entry', 'Please provide at least one debit and one credit line.');
            return;
        }

        try {
            await createJournal({
                date: new Date().toISOString(),
                narration: narration || 'Journal Voucher',
                lines: validLines.map(l => ({
                    accountId: l.accountId,
                    debit: l.type === 'Dr' ? Number(l.amount) : 0,
                    credit: l.type === 'Cr' ? Number(l.amount) : 0,
                })),
            });
            Alert.alert('Success', 'Journal entry recorded successfully.');
            router.back();
        } catch (error) {
            Alert.alert('Failed', error instanceof Error ? error.message : 'Could not save journal entry.');
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar title="New Journal Entry" subtitle="Double entry voucher" onBackPress={() => router.back()} />
            
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={s.content}>
                    <View style={s.totalsRow}>
                        <HubMetricCard label="Total Debit" value={`Rs ${totals.dr.toLocaleString('en-IN')}`} meta="Sum of Dr" tone="info" />
                        <HubMetricCard label="Total Credit" value={`Rs ${totals.cr.toLocaleString('en-IN')}`} meta="Sum of Cr" tone="warning" />
                    </View>

                    <View style={[s.card, getSurfaceStyle(colors, {})]}>
                        {lines.map((line, index) => (
                            <View key={line.key} style={s.lineRow}>
                                <TouchableOpacity 
                                    style={[s.typeBtn, { backgroundColor: line.type === 'Dr' ? colors.success : colors.error }]}
                                    onPress={() => handleUpdateLine(line.key, { type: line.type === 'Dr' ? 'Cr' : 'Dr' })}
                                >
                                    <Text style={s.typeBtnText}>{line.type}</Text>
                                </TouchableOpacity>

                                <View style={s.accountPickerWrap}>
                                    <View style={s.fakeSelect}>
                                        <Text style={{ color: line.accountId ? colors.text : colors.textSecondary }}>
                                            {activeAccounts.find((a: Account) => a.id === line.accountId)?.name || 'Select Account...'}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                                    </View>
                                </View>

                                <AppInput
                                    value={line.amount}
                                    onChangeText={(val: string) => handleUpdateLine(line.key, { amount: val })}
                                    inputType="decimal"
                                    placeholder="0"
                                    containerStyle={s.amountInput}
                                />

                                {lines.length > 2 && (
                                    <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveLine(line.key)}>
                                        <MaterialCommunityIcons name="minus-circle" size={24} color={colors.error} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                        
                        <Pressable 
                            style={{ alignSelf: 'flex-start', marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', padding: Spacing.sm }}
                            onPress={handleAddLine} 
                        >
                            <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 4 }}>Add Line</Text>
                        </Pressable>
                    </View>

                    <View style={[s.card, getSurfaceStyle(colors, {})]}>
                        <AppInput
                            label="Narration"
                            value={narration}
                            onChangeText={setNarration}
                            placeholder="Brief description of the entry..."
                            multiline
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={[s.footer, getSurfaceStyle(colors, { elevated: true })]}>
                <Pressable
                    style={[s.saveButton, { backgroundColor: isCreatingJournal || !totals.isBalanced || totals.dr <= 0 ? colors.border : colors.primary }]}
                    onPress={handleSave}
                    disabled={isCreatingJournal || !totals.isBalanced || totals.dr <= 0}
                >
                    {isCreatingJournal ? <ActivityIndicator color="#ffffff" /> : <Text style={s.saveButtonText}>Save Entry</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: DESIGN_SPACING.screenX, gap: Spacing.md, paddingBottom: 100 },
    totalsRow: { flexDirection: 'row', gap: Spacing.sm },
    card: { padding: Spacing.md, borderRadius: Radius.card, gap: Spacing.sm },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    typeBtn: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    typeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    accountPickerWrap: { flex: 1 },
    fakeSelect: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    amountInput: { width: 90, marginBottom: 0 },
    removeBtn: { padding: Spacing.xs },
    footer: { padding: DESIGN_SPACING.screenX, paddingBottom: Platform.OS === 'ios' ? DESIGN_SPACING.screenX : DESIGN_SPACING.screenX, borderTopWidth: 1, borderColor: colors.border },
    saveButton: { width: '100%', height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
