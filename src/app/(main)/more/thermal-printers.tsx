import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';

type ThermalPreset = '58MM_COMPACT' | '80MM_STANDARD' | 'A4_CLASSIC';
type PrinterConnection = 'USB' | 'BLUETOOTH' | 'WIFI';

const THERMAL_PRESETS: ThermalPreset[] = ['58MM_COMPACT', '80MM_STANDARD', 'A4_CLASSIC'];
const CONNECTIONS: PrinterConnection[] = ['USB', 'BLUETOOTH', 'WIFI'];

export default function ThermalPrintersScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();

    const [profile, setProfile] = useState<ThermalPreset>('80MM_STANDARD');
    const [connection, setConnection] = useState<PrinterConnection>('USB');
    const [pairingName, setPairingName] = useState('');
    const [printLayoutType, setPrintLayoutType] = useState<'REGULAR' | 'THERMAL'>('THERMAL');

    const { data, isLoading } = useQuery({
        queryKey: ['settings-section', 'INVOICE_PRINT'],
        queryFn: () => settingsApi.get('INVOICE_PRINT'),
        staleTime: 60_000,
    });

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
            Alert.alert('Saved', 'Thermal printer profile updated.');
        },
        onError: (error) => {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save printer profile.');
        },
    });

    const handleTestPair = () => {
        if (!pairingName.trim()) {
            Alert.alert('Pairing name required', 'Enter printer pairing name before running test.');
            return;
        }
        Alert.alert('Pairing test', `Attempting ${connection} pairing with "${pairingName.trim()}".\n\nSave settings after successful test.`);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Thermal Printers</Text>
                <Pressable onPress={() => saveProfile()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.saveText, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <ScrollView contentContainerStyle={s.content}>
                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={s.sectionTitle}>PRINT LAYOUT</Text>
                        <View style={s.chipsRow}>
                            {(['THERMAL', 'REGULAR'] as const).map((layout) => {
                                const selected = printLayoutType === layout;
                                return (
                                    <Pressable
                                        key={layout}
                                        style={[s.chip, selected && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
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
                                        style={[s.chip, selected && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
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
                                        style={[s.chip, selected && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
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
                        <TextInput
                            style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                            value={pairingName}
                            onChangeText={setPairingName}
                            placeholder="e.g. EPSON-TM-T82"
                            placeholderTextColor={colors.textSecondary}
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
                </ScrollView>
            )}
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
        backText: { fontSize: 14, fontWeight: '700' },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        saveText: { fontSize: 14, fontWeight: '700' },
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
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
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
    });
