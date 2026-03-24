import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAppColors } from '../../../hooks/useAppColors';
import { Radius, Spacing } from '../../../constants/theme';
import { getSurfaceStyle, DESIGN_SPACING } from '../../../constants/designSystem';
import { AppInput } from '../../../components/ui/AppInput';
import client from '../../../api/client';

export default function ClosePeriodScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const queryClient = useQueryClient();

    const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
    const [narration, setNarration] = useState('Year-end revenue and expense closing entry.');

    const closeMutation = useMutation({
        mutationFn: async () => {
            const res = await client.post('/accounting/close-period', {
                date: new Date(closingDate).toISOString(),
                narration,
            });
            if (!res.data.ok) throw new Error(res.data.message || 'Failed to close period');
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries();
            Alert.alert(
                "Period Closed Successfully",
                `A closing journal entry was generated transferring net profit/loss to Equity.\nLines Generated: ${data.linesCount}`,
                [{ text: "OK", onPress: () => router.back() }]
            );
        },
        onError: (err: any) => {
            Alert.alert("Period Closing Failed", err.response?.data?.message || err.message);
        }
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar title="Close Accounting Period" subtitle="Automated Year-End Closing" onBackPress={() => router.back()} />
            
            <ScrollView contentContainerStyle={s.content}>
                <View style={[s.card, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm }}>
                        What does this do?
                    </Text>
                    <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md, lineHeight: 22 }}>
                        Closing the period will zero out all Income and Expense balances up to the selected date. The net difference (Profit or Loss) will be securely transferred to your Equity (Reserves & Surplus). This guarantees accurate period-over-period balance sheets.
                    </Text>

                    <AppInput
                        label="Closing Date (YYYY-MM-DD)"
                        value={closingDate}
                        onChangeText={setClosingDate}
                        placeholder="2024-03-31"
                    />

                    <AppInput
                        label="Journal Narration"
                        value={narration}
                        onChangeText={setNarration}
                    />

                    <Pressable
                        style={[s.button, { backgroundColor: colors.warning, marginTop: Spacing.md }]}
                        onPress={() => {
                            Alert.alert(
                                "Confirm Period Closing",
                                "Are you sure? This will generate a massive journal entry.",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Yes, Close Period", style: "destructive", onPress: () => closeMutation.mutate() }
                                ]
                            );
                        }}
                        disabled={closeMutation.isPending || !closingDate}
                    >
                        {closeMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Run Closing Entry</Text>}
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: any) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: DESIGN_SPACING.screenX, gap: Spacing.md, paddingBottom: 100 },
    card: { padding: Spacing.lg, borderRadius: Radius.card, gap: Spacing.sm },
    button: { width: '100%', height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
