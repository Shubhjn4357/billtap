import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../../api/endpoints';
import { getSettingsSectionLabel } from '../../../../constants/settingsSchema';
import { getColors, Radius, setThemePreference, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import type { SettingsFieldDefinition } from '../../../../types/api';
import { extractUpiIdFromPayload } from '../../../../utils/upi';
import { SignatureCaptureSheet } from '../../../../components/signature/SignatureCaptureSheet';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { AppSearchBar } from '../../../../components/ui/AppSearchBar';
import {
    parseRoleActionOverrides,
    parseRoleModuleOverrides,
    ROLE_ACTION_OVERRIDES_KEY,
    ROLE_MODULE_OVERRIDES_KEY,
    setRoleAccessOverrides,
} from '../../../../utils/accessControl';
import { useAppDialog } from '@/components/providers/DialogProvider';

const coerceValue = (field: SettingsFieldDefinition, input: unknown) => {
    if ((input === null || input === undefined) && field.nullable) return null;

    switch (field.type) {
        case 'boolean':
            if (typeof input === 'boolean') return input;
            return input === 'true';
        case 'integer': {
            const parsed = Number(input);
            if (!Number.isFinite(parsed)) return Number(field.default ?? 0);
            const int = Math.trunc(parsed);
            const withMin = field.min === undefined ? int : Math.max(field.min, int);
            return field.max === undefined ? withMin : Math.min(field.max, withMin);
        }
        case 'number': {
            const parsed = Number(input);
            if (!Number.isFinite(parsed)) return Number(field.default ?? 0);
            const withMin = field.min === undefined ? parsed : Math.max(field.min, parsed);
            return field.max === undefined ? withMin : Math.min(field.max, withMin);
        }
        case 'enum': {
            const value = String(input ?? field.default ?? '');
            return field.enumValues?.includes(value) ? value : field.default;
        }
        case 'array_of_VoucherType': {
            if (!Array.isArray(input)) return Array.isArray(field.default) ? field.default : [];
            return input.map((entry) => String(entry));
        }
        case 'string':
        default:
            return input == null ? '' : String(input);
    }
};

const inputTypeForField = (field: SettingsFieldDefinition) => {
    const key = field.key.toLowerCase();
    if (field.type === 'integer' || field.type === 'number') return 'decimal' as const;
    if (key.includes('date')) return 'date' as const;
    if (key.includes('url') || key.includes('link')) return 'url' as const;
    if (key.includes('upi')) return 'upi' as const;
    if (key.includes('email')) return 'email' as const;
    if (key.includes('phone') || key.includes('mobile')) return 'phone' as const;
    if (key.includes('passcode') || key.includes('password')) return 'password' as const;
    return 'text' as const;
};

export default function SettingsSectionEditorScreen() {
    const dialog = useAppDialog();
    const { section: rawSection, upiPayload, scanAt } = useLocalSearchParams<{
        section?: string;
        upiPayload?: string | string[];
        scanAt?: string | string[];
    }>();
    const section = (rawSection ?? '').toUpperCase();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();
    const smartBack = useSmartBack('/(main)/more/settings');
    const [draft, setDraft] = useState<Record<string, unknown>>({});
    const [fieldSearch, setFieldSearch] = useState('');
    const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);
    const handledUpiPayloadRef = useRef<string>('');

    const { data: schemaResponse, isLoading: schemaLoading } = useQuery({
        queryKey: ['settings-schema'],
        queryFn: () => settingsApi.getSchema(),
        staleTime: 30 * 60_000,
    });

    const { data: sectionData, isLoading: sectionLoading } = useQuery({
        queryKey: ['settings-section', section],
        queryFn: () => settingsApi.get(section),
        enabled: Boolean(section),
    });

    const fields = useMemo(() => {
        if (!schemaResponse?.schema || !section) return [];
        return (schemaResponse.schema[section] ?? []) as SettingsFieldDefinition[];
    }, [schemaResponse, section]);

    const baselineDraft = useMemo(() => {
        const incoming = (sectionData?.data ?? {}) as Record<string, unknown>;
        const normalized: Record<string, unknown> = {};
        for (const field of fields) {
            const value = Object.prototype.hasOwnProperty.call(incoming, field.key)
                ? incoming[field.key]
                : field.default;
            normalized[field.key] = coerceValue(field, value);
        }
        return normalized;
    }, [fields, sectionData?.data]);

    useEffect(() => {
        setDraft(baselineDraft);
    }, [baselineDraft]);

    useEffect(() => {
        if (section !== 'GENERAL') return;
        const payload = Array.isArray(upiPayload) ? upiPayload[0] : upiPayload;
        const signal = Array.isArray(scanAt) ? scanAt[0] : scanAt;
        const key = `${payload || ''}::${signal || ''}`;
        if (!payload || handledUpiPayloadRef.current === key) return;

        handledUpiPayloadRef.current = key;
        const extractedUpiId = extractUpiIdFromPayload(payload);
        if (!extractedUpiId) {
            dialog.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }

        setDraft((prev) => ({ ...prev, payment_upi_id: extractedUpiId }));
        dialog.alert('UPI', 'UPI ID captured from QR. Save settings to apply.');
    }, [dialog, scanAt, section, upiPayload]);

    useEffect(() => {
        if (section !== 'GENERAL') return;
        const mode = draft.theme_mode;
        setThemePreference(typeof mode === 'string' ? mode : 'SYSTEM');
    }, [draft.theme_mode, section]);

    useEffect(() => {
        if (section !== 'SECURITY') return;
        setRoleAccessOverrides({
            actionOverrides: parseRoleActionOverrides(draft[ROLE_ACTION_OVERRIDES_KEY]),
            moduleOverrides: parseRoleModuleOverrides(draft[ROLE_MODULE_OVERRIDES_KEY]),
        });
    }, [draft, section]);

    const filteredFields = useMemo(() => {
        const needle = fieldSearch.trim().toLowerCase();
        if (!needle) return fields;
        return fields.filter((field) => `${field.label} ${field.key}`.toLowerCase().includes(needle));
    }, [fieldSearch, fields]);
    const changedCount = useMemo(() => {
        return fields.reduce((count, field) => {
            const prev = baselineDraft[field.key];
            const next = draft[field.key];
            return JSON.stringify(prev) === JSON.stringify(next) ? count : count + 1;
        }, 0);
    }, [baselineDraft, draft, fields]);

    const { mutate: saveSettings, isPending } = useMutation({
        mutationFn: () => settingsApi.update(section, { data: draft }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-section', section] });
            dialog.alert('Saved', 'Settings updated successfully.');
        },
        onError: (error) => {
            dialog.alert('Error', error instanceof Error ? error.message : 'Failed to save settings.');
        },
    });

    if (!section) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}>
                    <Text style={{ color: colors.textSecondary }}>Invalid settings section.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const isLoading = schemaLoading || sectionLoading;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={getSettingsSectionLabel(section)}
                subtitle="Section preferences"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={() => saveSettings()} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.saveText, { color: colors.primary }]}>Save</Text>}
                    </Pressable>
                )}
            />

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.content}>
                    <AppSearchBar
                        value={fieldSearch}
                        onChangeText={setFieldSearch}
                        placeholder="Search fields..."
                    />
                    <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>SECTION STATUS</Text>
                        <Text style={s.summaryValue}>{filteredFields.length}</Text>
                        <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>
                            {fieldSearch.trim().length > 0 ? `Filtered from ${fields.length} fields` : `${changedCount} unsaved changes`}
                        </Text>
                    </View>

                    {filteredFields.map((field) => {
                        const value = draft[field.key];
                        return (
                            <View key={field.key} style={[s.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.fieldLabel, { color: colors.text }]}>{field.label}</Text>
                                {field.type === 'boolean' ? (
                                    <Switch
                                        value={Boolean(value)}
                                        onValueChange={(next) => setDraft((prev) => ({ ...prev, [field.key]: next }))}
                                        trackColor={{ true: colors.primary }}
                                    />
                                ) : field.type === 'enum' ? (
                                    <View style={s.enumWrap}>
                                        {(field.enumValues ?? []).map((option) => {
                                            const selected = value === option;
                                            return (
                                                <Pressable
                                                    key={option}
                                                    style={[
                                                        s.enumChip,
                                                        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' },
                                                    ]}
                                                    onPress={() => setDraft((prev) => ({ ...prev, [field.key]: option }))}
                                                >
                                                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                                                        {option}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ) : field.type === 'array_of_VoucherType' ? (
                                    <View style={s.enumWrap}>
                                        {(field.enumValues ?? []).map((option) => {
                                            const selectedValues = Array.isArray(value) ? value.map(String) : [];
                                            const selected = selectedValues.includes(option);
                                            return (
                                                <Pressable
                                                    key={option}
                                                    style={[
                                                        s.enumChip,
                                                        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' },
                                                    ]}
                                                    onPress={() => {
                                                        const next = selected
                                                            ? selectedValues.filter((entry) => entry !== option)
                                                            : [...selectedValues, option];
                                                        setDraft((prev) => ({ ...prev, [field.key]: next }));
                                                    }}
                                                >
                                                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                                                        {option}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <>
                                        <AppInput
                                            inputType={inputTypeForField(field)}
                                            value={value == null ? '' : String(value)}
                                            onChangeText={(text) => setDraft((prev) => ({ ...prev, [field.key]: coerceValue(field, text) }))}
                                        />
                                        {section === 'GENERAL' && field.key === 'payment_upi_id' ? (
                                            <Pressable
                                                style={[s.inlineAction, { borderColor: colors.border }]}
                                                onPress={() => router.push({
                                                    pathname: '/scan',
                                                    params: {
                                                        target: 'upi',
                                                        returnPath: `/(main)/more/settings/${section}`,
                                                    },
                                                })}
                                            >
                                                <Text style={[s.inlineActionText, { color: colors.primary }]}>Scan UPI QR</Text>
                                            </Pressable>
                                        ) : null}
                                        {section === 'GENERAL' && field.key === 'signature_url' ? (
                                            <View style={s.signatureRow}>
                                                <Pressable
                                                    style={[s.inlineAction, { borderColor: colors.border }]}
                                                    onPress={() => setSignatureCaptureVisible(true)}
                                                >
                                                    <Text style={[s.inlineActionText, { color: colors.primary }]}>Draw Signature</Text>
                                                </Pressable>
                                                {value ? (
                                                    <Pressable
                                                        style={[s.inlineAction, { borderColor: colors.border }]}
                                                        onPress={() => setDraft((prev) => ({ ...prev, [field.key]: '' }))}
                                                    >
                                                        <Text style={[s.inlineActionText, { color: colors.error }]}>Clear</Text>
                                                    </Pressable>
                                                ) : null}
                                                {value ? (
                                                    <View style={[s.signaturePreviewWrap, { borderColor: colors.border }]}>
                                                        <Image
                                                            source={{ uri: String(value) }}
                                                            style={s.signaturePreview}
                                                            resizeMode="contain"
                                                        />
                                                    </View>
                                                ) : null}
                                            </View>
                                        ) : null}
                                    </>
                                )}
                            </View>
                        );
                    })}
                    {filteredFields.length === 0 ? (
                        <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No fields found</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Try another search term.</Text>
                        </View>
                    ) : null}
                    <View style={{ height: 80 }} />
                </ScrollView>
            )}
            <SignatureCaptureSheet
                visible={signatureCaptureVisible}
                onClose={() => setSignatureCaptureVisible(false)}
                onSave={(dataUrl) => {
                    setSignatureCaptureVisible(false);
                    setDraft((prev) => ({ ...prev, signature_url: dataUrl }));
                }}
            />
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    saveBtn: {
        minHeight: 34,
        minWidth: 56,
        borderRadius: Radius.pill,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: { fontSize: 12, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    summaryCard: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
    summaryValue: { marginTop: 4, color: colors.text, fontSize: Typography.headline.size, fontWeight: '800' },
    summaryMeta: { marginTop: 2, fontSize: Typography.caption.size },
    fieldCard: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600' },
    enumWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    enumChip: {
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
    },
    inlineAction: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
    },
    inlineActionText: { fontSize: 12, fontWeight: '700' },
    signatureRow: {
        gap: Spacing.xs,
    },
    signaturePreviewWrap: {
        borderWidth: 1,
        borderRadius: Radius.md,
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    signaturePreview: {
        width: '100%',
        height: 110,
    },
    emptyState: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        gap: 2,
    },
    emptyTitle: { fontSize: Typography.body.size, fontWeight: '700' },
    emptySubtitle: { fontSize: Typography.caption.size },
});



