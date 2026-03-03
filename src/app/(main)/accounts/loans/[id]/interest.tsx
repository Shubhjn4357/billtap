import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanApi } from '../../../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../../../constants/theme';

export default function LoanInterestEntryScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const numericAmount = Number(amount);
            if (!numericAmount || numericAmount <= 0) {
                throw new Error('Enter a valid interest amount.');
            }
            return loanApi.addTransaction(id!, {
                transactionType: 'INTEREST',
                amount: numericAmount,
                date,
                notes: notes.trim() || undefined,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['loan', id] });
            qc.invalidateQueries({ queryKey: ['loan-transactions', id] });
            qc.invalidateQueries({ queryKey: ['loans'] });
            Alert.alert('Saved', 'Interest entry recorded.');
            router.back();
        },
        onError: (error) => {
            Alert.alert('Failed', error instanceof Error ? error.message : 'Unable to save interest entry.');
        },
    });

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.headerAction, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Add Interest</Text>
                <Pressable onPress={() => mutate()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.headerAction, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <View style={s.content}>
                <View style={[s.heroCard, { backgroundColor: colors.warning }]}>
                    <Text style={s.heroLabel}>INTEREST AMOUNT</Text>
                    <TextInput
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor="#ffffffaa"
                        style={s.heroInput}
                    />
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                />

                <Text style={[s.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Interest period / remarks"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    textAlignVertical="top"
                    style={[s.input, s.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                />

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => mutate()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Record Interest</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        headerAction: { fontSize: 14, fontWeight: '700' },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
        heroCard: { borderRadius: Radius.card, padding: Spacing.xl, marginBottom: Spacing.md, alignItems: 'center' },
        heroLabel: { color: '#ffffffcc', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        heroInput: { marginTop: Spacing.sm, color: '#fff', fontSize: 38, fontWeight: '800', minWidth: 150, textAlign: 'center' },
        label: { fontSize: 12, fontWeight: '700', marginBottom: Spacing.xs, marginTop: Spacing.md },
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        notesInput: { minHeight: 90 },
        primaryBtn: { marginTop: Spacing.lg, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
        primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    });


