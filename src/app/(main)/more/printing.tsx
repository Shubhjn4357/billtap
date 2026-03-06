import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useCurrentBusiness } from '../../../hooks/useCurrentBusiness';

type PrintTab = 'thermal' | 'standard';
type ThermalPreset = '58MM_COMPACT' | '80MM_STANDARD' | 'A4_CLASSIC';
type PrinterConnection = 'USB' | 'BLUETOOTH' | 'WIFI';
type StandardLayout = 'MODERN' | 'CLASSIC' | 'MINIMAL';

const THERMAL_PRESETS: { key: ThermalPreset; label: string; desc: string }[] = [
    { key: '58MM_COMPACT', label: '58mm Compact', desc: 'Small POS printer, 24 chars/line' },
    { key: '80MM_STANDARD', label: '80mm Standard', desc: 'Full POS counter, 34 chars/line ✓ Recommended' },
    { key: 'A4_CLASSIC', label: 'A4 (Thermal)', desc: 'Wide format, 44 chars/line' },
];

const CONNECTIONS: { key: PrinterConnection; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
    { key: 'USB', icon: 'usb', label: 'USB' },
    { key: 'BLUETOOTH', icon: 'bluetooth', label: 'Bluetooth' },
    { key: 'WIFI', icon: 'wifi', label: 'Wi-Fi' },
];

const STANDARD_LAYOUTS: { key: StandardLayout; label: string; desc: string }[] = [
    { key: 'MODERN', label: 'Modern', desc: 'Clean header, colored accents, logo top-right' },
    { key: 'CLASSIC', label: 'Classic', desc: 'Traditional business layout, black & white' },
    { key: 'MINIMAL', label: 'Minimal', desc: 'Compact spacing for e-invoicing portals' },
];

export default function PrintingScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const queryClient = useQueryClient();
    const { business } = useCurrentBusiness();

    const [activeTab, setActiveTab] = useState<PrintTab>('thermal');

    // Thermal state
    const [thermalPreset, setThermalPreset] = useState<ThermalPreset>('80MM_STANDARD');
    const [connection, setConnection] = useState<PrinterConnection>('USB');
    const [pairingName, setPairingName] = useState('');
    const [printLayoutType, setPrintLayoutType] = useState<'THERMAL' | 'REGULAR'>('THERMAL');

    // Standard state
    const [standardLayout, setStandardLayout] = useState<StandardLayout>('MODERN');
    const [showLogo, setShowLogo] = useState(true);
    const [showSignature, setShowSignature] = useState(false);
    const [footerText, setFooterText] = useState('');
    const [termsText, setTermsText] = useState('');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['settings-section', 'INVOICE_PRINT'],
        queryFn: () => settingsApi.get('INVOICE_PRINT'),
        staleTime: 60_000,
    });

    useEffect(() => {
        const raw = (data?.data ?? {}) as Record<string, unknown>;
        setThermalPreset(
            raw.thermal_profile_preset === '58MM_COMPACT' ? '58MM_COMPACT'
                : raw.thermal_profile_preset === 'A4_CLASSIC' ? 'A4_CLASSIC'
                    : '80MM_STANDARD'
        );
        setConnection(
            raw.printer_connection_type === 'BLUETOOTH' ? 'BLUETOOTH'
                : raw.printer_connection_type === 'WIFI' ? 'WIFI'
                    : 'USB'
        );
        setPairingName(typeof raw.printer_pairing_name === 'string' ? raw.printer_pairing_name : '');
        setPrintLayoutType(raw.print_layout_type === 'REGULAR' ? 'REGULAR' : 'THERMAL');
        setStandardLayout(
            raw.standard_layout === 'CLASSIC' ? 'CLASSIC'
                : raw.standard_layout === 'MINIMAL' ? 'MINIMAL'
                    : 'MODERN'
        );
        setShowLogo(raw.show_logo !== false);
        setShowSignature(raw.show_signature === true);
        setFooterText(typeof raw.footer_text === 'string' ? raw.footer_text : '');
        setTermsText(typeof raw.terms_text === 'string' ? raw.terms_text : '');
    }, [data?.data]);

    const preview = useMemo(() => {
        const lineChars = thermalPreset === '58MM_COMPACT' ? 24 : thermalPreset === '80MM_STANDARD' ? 34 : 44;
        const textSize = thermalPreset === '58MM_COMPACT' ? 10 : thermalPreset === '80MM_STANDARD' ? 12 : 13;
        const sampleDivider = '-'.repeat(lineChars);
        return {
            lineChars,
            textSize,
            sampleDivider,
            pageLabel: thermalPreset === 'A4_CLASSIC' ? 'A4 / Thermal' : thermalPreset === '80MM_STANDARD' ? '80mm Thermal' : '58mm Thermal',
        };
    }, [thermalPreset]);

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const existing = (data?.data ?? {}) as Record<string, unknown>;
            return settingsApi.update('INVOICE_PRINT', {
                data: {
                    ...existing,
                    print_layout_type: printLayoutType,
                    thermal_profile_preset: thermalPreset,
                    printer_connection_type: connection,
                    printer_pairing_name: pairingName.trim() || null,
                    page_size: thermalPreset === '58MM_COMPACT' ? '58MM' : thermalPreset === '80MM_STANDARD' ? '80MM' : 'A4',
                    standard_layout: standardLayout,
                    show_logo: showLogo,
                    show_signature: showSignature,
                    footer_text: footerText.trim() || null,
                    terms_text: termsText.trim() || null,
                },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-section', 'INVOICE_PRINT'] });
            dialog.alert('Saved', 'Print settings updated successfully.');
        },
        onError: (error) => dialog.alert('Save failed', error instanceof Error ? error.message : 'Unable to save.'),
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Printing & Templates"
                subtitle="Thermal, PDF and print profiles"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={() => save()} disabled={isPending}>
                        {isPending ? (
                            <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                            <MaterialCommunityIcons name="content-save-outline" size={16} color={colors.onPrimary} />
                        )}
                    </Pressable>
                )}
            />

            {/* Tabs */}
            <View style={s.tabRow}>
                {([
                    { key: 'thermal' as PrintTab, label: 'Thermal / POS', icon: 'printer-pos-outline' as const },
                    { key: 'standard' as PrintTab, label: 'Standard / PDF', icon: 'file-pdf-box' as const },
                ]).map((tab) => {
                    const sel = activeTab === tab.key;
                    return (
                        <Pressable key={tab.key} style={[s.tab, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                            onPress={() => setActiveTab(tab.key)}>
                            <MaterialCommunityIcons name={tab.icon} size={14} color={sel ? colors.onPrimary : colors.textSecondary} />
                            <Text style={[s.tabText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{tab.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {isLoading ? (
                <ListSkeleton rows={5} />
            ) : (
                <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />}>

                        {activeTab === 'thermal' ? (
                            <>
                                {/* Layout Type */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>PRINT LAYOUT</Text>
                                    <View style={s.chipsRow}>
                                        {(['THERMAL', 'REGULAR'] as const).map((layout) => {
                                            const sel = printLayoutType === layout;
                                            return (
                                                <Pressable key={layout} style={[s.chip, sel && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]} onPress={() => setPrintLayoutType(layout)}>
                                                    <Text style={{ color: sel ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{layout}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Thermal Preset */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>PAPER SIZE / PRESET</Text>
                                    {THERMAL_PRESETS.map((preset) => {
                                        const sel = thermalPreset === preset.key;
                                        return (
                                            <Pressable key={preset.key} style={[s.presetRow, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? withAlpha(colors.primary, '10') : 'transparent' }]} onPress={() => setThermalPreset(preset.key)}>
                                                <View style={[s.presetRadio, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent' }]}>
                                                    {sel ? <View style={s.presetRadioInner} /> : null}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: sel ? colors.primary : colors.text, fontWeight: '700', fontSize: 13 }}>{preset.label}</Text>
                                                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{preset.desc}</Text>
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {/* Connection */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>CONNECTION TYPE</Text>
                                    <View style={s.chipsRow}>
                                        {CONNECTIONS.map((conn) => {
                                            const sel = connection === conn.key;
                                            return (
                                                <Pressable key={conn.key} style={[s.chip, sel && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]} onPress={() => setConnection(conn.key)}>
                                                    <MaterialCommunityIcons name={conn.icon} size={13} color={sel ? colors.primary : colors.textSecondary} />
                                                    <Text style={{ color: sel ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{conn.label}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                    <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Printer Name / Pairing Code</Text>
                                    <AppInput value={pairingName} onChangeText={setPairingName} placeholder="e.g. EPSON-TM-T82" containerStyle={s.inputWrap} />
                                    <Pressable style={[s.testBtn, { borderColor: colors.primary }]}
                                        onPress={() => {
                                            if (!pairingName.trim()) { dialog.alert('Name required', 'Enter a printer name first.'); return; }
                                            dialog.alert('Pairing Test', `Attempting ${connection} pairing with "${pairingName.trim()}". Save settings after success.`);
                                        }}>
                                        <Text style={[s.testBtnText, { color: colors.primary }]}>Run Pairing Test</Text>
                                    </Pressable>
                                </View>

                                {/* Live Preview */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>LIVE PREVIEW</Text>
                                    <View style={[s.previewPaper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                        <Text style={[s.previewBizName, { color: colors.text, fontSize: preview.textSize + 1 }]}>{business?.name ?? 'YOUR BUSINESS'}</Text>
                                        <Text style={[s.previewMeta, { color: colors.textSecondary, fontSize: preview.textSize - 1 }]}>{preview.pageLabel} | {connection}</Text>
                                        <Text style={[s.previewLine, { color: colors.border, fontSize: preview.textSize - 1 }]}>{preview.sampleDivider}</Text>
                                        <Text style={[s.previewRow, { color: colors.text, fontSize: preview.textSize }]}>Item A x 2        Rs 240.00</Text>
                                        <Text style={[s.previewRow, { color: colors.text, fontSize: preview.textSize }]}>Item B x 1        Rs  60.00</Text>
                                        <Text style={[s.previewLine, { color: colors.border, fontSize: preview.textSize - 1 }]}>{preview.sampleDivider}</Text>
                                        <Text style={[s.previewRow, { color: colors.text, fontSize: preview.textSize, fontWeight: '700' }]}>TOTAL             Rs 300.00</Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <>
                                {/* Standard Layout */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>INVOICE LAYOUT</Text>
                                    {STANDARD_LAYOUTS.map((layout) => {
                                        const sel = standardLayout === layout.key;
                                        return (
                                            <Pressable key={layout.key} style={[s.presetRow, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? withAlpha(colors.primary, '10') : 'transparent' }]} onPress={() => setStandardLayout(layout.key)}>
                                                <View style={[s.presetRadio, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent' }]}>
                                                    {sel ? <View style={s.presetRadioInner} /> : null}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: sel ? colors.primary : colors.text, fontWeight: '700', fontSize: 13 }}>{layout.label}</Text>
                                                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{layout.desc}</Text>
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {/* Options */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>OPTIONS</Text>
                                    {[
                                        { label: 'Show Business Logo', value: showLogo, onChange: setShowLogo },
                                        { label: 'Show Signature Field', value: showSignature, onChange: setShowSignature },
                                    ].map((opt) => (
                                        <Pressable key={opt.label} style={s.toggleRow} onPress={() => opt.onChange(!opt.value)}>
                                            <Text style={[s.toggleLabel, { color: colors.text }]}>{opt.label}</Text>
                                            <View style={[s.toggle, { backgroundColor: opt.value ? colors.primary : colors.surfaceVariant, borderColor: opt.value ? colors.primary : colors.border }]}>
                                                <View style={[s.toggleThumb, { left: opt.value ? 20 : 2, backgroundColor: colors.onPrimary }]} />
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>

                                {/* Footer & Terms */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>FOOTER & TERMS</Text>
                                    <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Footer Text</Text>
                                    <AppInput value={footerText} onChangeText={setFooterText} placeholder="e.g. Thank you for your business!" containerStyle={s.inputWrap} multiline />
                                    <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Terms & Conditions</Text>
                                    <AppInput value={termsText} onChangeText={setTermsText} placeholder="Goods once sold will not be taken back..." containerStyle={s.inputWrap} multiline />
                                </View>

                                {/* Standard Preview Card */}
                                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>INVOICE PREVIEW</Text>
                                    <View style={[s.standardPreview, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                        <View style={[s.standardPreviewHeader, { borderBottomColor: colors.primary, backgroundColor: withAlpha(colors.primary, '10') }]}>
                                            <View>
                                                <Text style={[s.stdBizName, { color: colors.primary }]}>{business?.name ?? 'YOUR BUSINESS'}</Text>
                                                <Text style={[s.stdBizSub, { color: colors.textSecondary }]}>{business?.gstin ? `GSTIN: ${business.gstin}` : 'GST Invoice'}</Text>
                                            </View>
                                            {showLogo ? <View style={[s.stdLogoPh, { backgroundColor: withAlpha(colors.primary, '22'), borderColor: colors.primary }]}><Text style={{ color: colors.primary, fontSize: 9, fontWeight: '700' }}>LOGO</Text></View> : null}
                                        </View>
                                        <View style={{ padding: 8, gap: 4 }}>
                                            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Invoice No: INV-0001 · Date: 06 Mar 2026</Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Party: Sample Customer</Text>
                                            <View style={[s.stdDivider, { backgroundColor: colors.border }]} />
                                            <Text style={{ color: colors.text, fontSize: 10 }}>Item A  ×2  Rs 240   |  Item B  ×1  Rs 60</Text>
                                            <View style={[s.stdDivider, { backgroundColor: colors.border }]} />
                                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 11 }}>TOTAL: Rs 300</Text>
                                            {footerText ? <Text style={{ color: colors.textSecondary, fontSize: 9, marginTop: 4, textAlign: 'center' }}>{footerText}</Text> : null}
                                        </View>
                                    </View>
                                </View>
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    saveBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', minWidth: 34, justifyContent: 'center' },
    tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border },
    tabText: { fontSize: 12 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.sm },
    card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
    presetRow: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    presetRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    presetRadioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPrimary },
    inputLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
    inputWrap: { marginTop: 2 },
    testBtn: { borderWidth: 1, borderRadius: Radius.pill, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 7, marginTop: 2 },
    testBtnText: { fontSize: 12, fontWeight: '700' },
    previewPaper: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
    previewBizName: { fontWeight: '800', textAlign: 'center', marginBottom: 2 },
    previewMeta: { textAlign: 'center' },
    previewLine: { textAlign: 'center', marginVertical: 2, letterSpacing: 0.5 },
    previewRow: { fontVariant: ['tabular-nums'] },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
    toggleLabel: { fontSize: 13, fontWeight: '600' },
    toggle: { width: 42, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
    toggleThumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9 },
    standardPreview: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
    standardPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, padding: 8 },
    stdBizName: { fontWeight: '800', fontSize: 12 },
    stdBizSub: { fontSize: 9, marginTop: 1 },
    stdLogoPh: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    stdDivider: { height: 1, marginVertical: 2 },
});
