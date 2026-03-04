import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../../api/endpoints';
import { getSettingsSectionLabel } from '../../../../constants/settingsSchema';
import { getColors, Radius, setThemePreference, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';
import type { SettingsFieldDefinition } from '../../../../types/api';
import { extractUpiIdFromPayload } from '../../../../utils/upi';
import { SignatureCaptureSheet } from '../../../../components/signature/SignatureCaptureSheet';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import {
    parseRoleActionOverrides,
    parseRoleModuleOverrides,
    ROLE_ACTION_OVERRIDES_KEY,
    ROLE_MODULE_OVERRIDES_KEY,
    setRoleAccessOverrides,
} from '../../../../utils/accessControl';

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

export default function SettingsSectionEditorScreen() {
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

    useEffect(() => {
        const incoming = (sectionData?.data ?? {}) as Record<string, unknown>;
        const normalized: Record<string, unknown> = {};
        for (const field of fields) {
            const value = Object.prototype.hasOwnProperty.call(incoming, field.key)
                ? incoming[field.key]
                : field.default;
            normalized[field.key] = coerceValue(field, value);
        }
        setDraft(normalized);
    }, [sectionData, fields]);

    useEffect(() => {
        if (section !== 'GENERAL') return;
        const payload = Array.isArray(upiPayload) ? upiPayload[0] : upiPayload;
        const signal = Array.isArray(scanAt) ? scanAt[0] : scanAt;
        const key = `${payload || ''}::${signal || ''}`;
        if (!payload || handledUpiPayloadRef.current === key) return;

        handledUpiPayloadRef.current = key;
        const extractedUpiId = extractUpiIdFromPayload(payload);
        if (!extractedUpiId) {
            Alert.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }

        setDraft((prev) => ({ ...prev, payment_upi_id: extractedUpiId }));
        Alert.alert('UPI', 'UPI ID captured from QR. Save settings to apply.');
    }, [scanAt, section, upiPayload]);

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

    const { mutate: saveSettings, isPending } = useMutation({
        mutationFn: () => settingsApi.update(section, { data: draft }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-section', section] });
            Alert.alert('Saved', 'Settings updated successfully.');
        },
        onError: (error) => {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save settings.');
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
            <View style={s.header}>
                <Pressable onPress={smartBack}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>{getSettingsSectionLabel(section)}</Text>
                <Pressable onPress={() => saveSettings()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.content}>
                    {fields.map((field) => {
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
                                                        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '22' : 'transparent' },
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
                                                        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '22' : 'transparent' },
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
                                        <TextInput
                                            style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                            value={value == null ? '' : String(value)}
                                            keyboardType={field.type === 'integer' || field.type === 'number' ? 'numeric' : 'default'}
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
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    back: { fontSize: 14, fontWeight: '600' },
    title: {
        fontSize: Typography.title.size,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: Spacing.sm,
    },
    save: { fontSize: 14, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    fieldCard: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600' },
    input: {
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: 14,
    },
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
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    signaturePreview: {
        width: '100%',
        height: 110,
    },
});



