import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';

type ThermalPreset = '58MM_COMPACT' | '80MM_STANDARD' | 'A4_CLASSIC';
type PrinterConnection = 'USB' | 'BLUETOOTH' | 'WIFI';

const THERMAL_PRESETS: ThermalPreset[] = ['58MM_COMPACT', '80MM_STANDARD', 'A4_CLASSIC'];
const CONNECTIONS: PrinterConnection[] = ['USB', 'BLUETOOTH', 'WIFI'];

export default function ThermalPrintersScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const queryClient = useQueryClient();

    const [profile, setProfile] = useState<ThermalPreset>('80MM_STANDARD');
    const [connection, setConnection] = useState<PrinterConnection>('USB');
    const [pairingName, setPairingName] = useState('');
    const [printLayoutType, setPrintLayoutType] = useState<'REGULAR' | 'THERMAL'>('THERMAL');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['settings-section', 'INVOICE_PRINT'],
        queryFn: () => settingsApi.get('INVOICE_PRINT'),
        staleTime: 60_000,
    });

    const preview = useMemo(() => {
        const lineChars = profile === '58MM_COMPACT' ? 24 : profile === '80MM_STANDARD' ? 34 : 44;
        const textSize = profile === '58MM_COMPACT' ? 10 : profile === '80MM_STANDARD' ? 12 : 13;
        const sampleDivider = '-'.repeat(lineChars);
        const timestamp = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        return {
            lineChars,
            textSize,
            sampleDivider,
            timestamp,
            pageLabel: profile === 'A4_CLASSIC' ? 'A4 / PDF' : profile === '80MM_STANDARD' ? '80mm Thermal' : '58mm Thermal',
        };
    }, [profile]);

    useEffect(() => {
        const raw = (data?.data ?? {}) as Record<string, unknown>;
        setProfile(
            raw.thermal_profile_preset === '58MM_COMPACT'
                ? '58MM_COMPACT'
                : raw.thermal_profile_preset === 'A4_CLASSIC'
                    ? 'A4_CLASSIC'
                    : '80MM_STANDARD'
        );
        setConnection(
            raw.printer_connection_type === 'BLUETOOTH'
                ? 'BLUETOOTH'
                : raw.printer_connection_type === 'WIFI'
                    ? 'WIFI'
                    : 'USB'
        );
        setPairingName(typeof raw.printer_pairing_name === 'string' ? raw.printer_pairing_name : '');
        setPrintLayoutType(raw.print_layout_type === 'REGULAR' ? 'REGULAR' : 'THERMAL');
    }, [data?.data]);

    const { mutate: saveProfile, isPending } = useMutation({
        mutationFn: async () => {
            const existing = (data?.data ?? {}) as Record<string, unknown>;
            return settingsApi.update('INVOICE_PRINT', {
                data: {
                    ...existing,
                    print_layout_type: printLayoutType,
                    thermal_profile_preset: profile,
                    printer_connection_type: connection,
                    printer_pairing_name: pairingName.trim() || null,
                    page_size:
                        profile === '58MM_COMPACT'
                            ? '58MM'
                            : profile === '80MM_STANDARD'
                                ? '80MM'
                                : 'A4 (210 x 297 mm)',
                },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-section', 'INVOICE_PRINT'] });
            dialog.alert('Saved', 'Thermal printer profile updated.');
        },
        onError: (error) => {
            dialog.alert('Save failed', error instanceof Error ? error.message : 'Unable to save printer profile.');
        },
    });

    const handleTestPair = () => {
        if (!pairingName.trim()) {
            dialog.alert('Pairing name required', 'Enter printer pairing name before running test.');
            return;
        }
        dialog.alert('Pairing test', `Attempting ${connection} pairing with "${pairingName.trim()}".\n\nSave settings after successful test.`);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Thermal Printers"
                subtitle="Profile and pairing setup"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={() => saveProfile()} disabled={isPending}>
                        {isPending ? (
                            <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                            <MaterialCommunityIcons name="content-save-outline" size={16} color={colors.onPrimary} />
                        )}
                    </Pressable>
                )}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <ScrollView
                    contentContainerStyle={s.content}
                    refreshControl={(
                        <RefreshControl
                            refreshing={isRefetching && !isLoading}
                            onRefresh={() => {
                                void refetch();
                            }}
                            tintColor={colors.primary}
                        />
                    )}
                >
                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={s.sectionTitle}>PRINT LAYOUT</Text>
                        <View style={s.chipsRow}>
                            {(['THERMAL', 'REGULAR'] as const).map((layout) => {
                                const selected = printLayoutType === layout;
                                return (
                                    <Pressable
                                        key={layout}
                                        style={[s.chip, selected && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]}
                                        onPress={() => setPrintLayoutType(layout)}
                                    >
                                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                                            {layout}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={s.sectionTitle}>THERMAL PROFILE PRESET</Text>
                        <View style={s.chipsRow}>
                            {THERMAL_PRESETS.map((preset) => {
                                const selected = profile === preset;
                                return (
                                    <Pressable
                                        key={preset}
                                        style={[s.chip, selected && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]}
                                        onPress={() => setProfile(preset)}
                                    >
                                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                                            {preset}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={s.sectionTitle}>CONNECTION</Text>
                        <View style={s.chipsRow}>
                            {CONNECTIONS.map((entry) => {
                                const selected = connection === entry;
                                return (
                                    <Pressable
                                        key={entry}
                                        style={[s.chip, selected && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]}
                                        onPress={() => setConnection(entry)}
                                    >
                                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                                            {entry}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Printer Pairing Name</Text>
                        <AppInput
                            value={pairingName}
                            onChangeText={setPairingName}
                            placeholder="e.g. EPSON-TM-T82"
                            containerStyle={s.pairingInputWrap}
                        />

                        <Pressable style={[s.testBtn, { borderColor: colors.primary }]} onPress={handleTestPair}>
                            <Text style={[s.testBtnText, { color: colors.primary }]}>Run Pairing Test</Text>
                        </Pressable>
                    </View>

                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={s.sectionTitle}>NOTES</Text>
                        <Text style={[s.noteText, { color: colors.textSecondary }]}>
                            For USB scanner/thermal workflows, keep scanner mode on USB in Item Settings and use THERMAL layout here.
                        </Text>
                        <Text style={[s.noteText, { color: colors.textSecondary }]}>
                            58MM profile is compact billing, 80MM is recommended for full POS counters.
                        </Text>
                    </View>

                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={s.sectionTitle}>LIVE PREVIEW</Text>
                        <View style={[s.previewPaper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            <Text style={[s.previewTitle, { color: colors.text, fontSize: preview.textSize + 1 }]}>VAHI BILLING APP</Text>
                            <Text style={[s.previewMeta, { color: colors.textSecondary, fontSize: preview.textSize - 1 }]}>
                                {preview.pageLabel} | {connection}
                            </Text>
                            <Text style={[s.previewMeta, { color: colors.textSecondary, fontSize: preview.textSize - 1 }]}>
                                {pairingName.trim() ? `Pair: ${pairingName.trim()}` : 'Pair: (not set)'}
                            </Text>
                            <Text style={[s.previewMeta, { color: colors.textSecondary, fontSize: preview.textSize - 1 }]}>{preview.timestamp}</Text>
                            <Text style={[s.previewLine, { color: colors.textSecondary, fontSize: preview.textSize - 1 }]}>
                                {preview.sampleDivider}
                            </Text>
                            <Text style={[s.previewRow, { color: colors.text, fontSize: preview.textSize }]}>Item A x 2        Rs 240.00</Text>
                            <Text style={[s.previewRow, { color: colors.text, fontSize: preview.textSize }]}>Item B x 1        Rs  60.00</Text>
                            <Text style={[s.previewLine, { color: colors.textSecondary, fontSize: preview.textSize - 1 }]}>
                                {preview.sampleDivider}
                            </Text>
                            <Text style={[s.previewRow, { color: colors.text, fontSize: preview.textSize, fontWeight: '700' }]}>TOTAL             Rs 300.00</Text>
                            <Text style={[s.previewMeta, { color: colors.textSecondary, fontSize: preview.textSize - 1, marginTop: 6 }]}>
                                Layout: {printLayoutType}
                            </Text>
                        </View>
                    </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        flex: { flex: 1 },
        saveBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minWidth: 76,
            justifyContent: 'center',
        },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.sm },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
        chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        chip: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
        },
        inputLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
        pairingInputWrap: { marginTop: Spacing.xs },
        testBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            alignSelf: 'flex-start',
            paddingHorizontal: Spacing.md,
            paddingVertical: 7,
            marginTop: Spacing.xs,
        },
        testBtnText: { fontSize: 12, fontWeight: '700' },
        noteText: { fontSize: 12, lineHeight: 18 },
        previewPaper: {
            borderWidth: 1,
            borderRadius: Radius.md,
            padding: Spacing.md,
            gap: 2,
        },
        previewTitle: {
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: 2,
        },
        previewMeta: {
            fontWeight: '500',
            textAlign: 'center',
        },
        previewLine: {
            textAlign: 'center',
            marginVertical: 2,
        },
        previewRow: {
            fontVariant: ['tabular-nums'],
        },
    });
