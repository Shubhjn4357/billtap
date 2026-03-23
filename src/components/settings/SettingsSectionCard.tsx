import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppInput } from '../ui/AppInput';
import { ChipButton } from '../ui/ChipBlocks';
import { DateField } from '../ui/DateField';
import { SelectField } from '../ui/SelectField';
import { SettingsStatusPill } from './SettingsBlocks';
import { DESIGN_SPACING, getInsetPanelStyle, getPillStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { getSettingsSectionLabel } from '../../constants/settingsSchema';
import { useAppColors } from '../../hooks/useAppColors';
import { useSettingsSection } from '../../hooks/useSettingsSection';
import { useSettingsSectionMutation } from '../../hooks/useSettingsSectionMutation';
import type { SettingsFieldDefinition } from '../../types/api';
import { SignatureCaptureSheet } from '../signature/SignatureCaptureSheet';
import { extractUpiIdFromPayload } from '../../utils/upi';
import { isCloudWriteBlockedError, toUserMessage } from '../../api/client';
import { useAppDialog } from '@/components/providers/DialogProvider';

type SettingsSectionCardProps = {
    section: string;
    subtitle?: string;
    upiPayload?: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'local' | 'error';

const coerceValue = (field: SettingsFieldDefinition, input: unknown) => {
    if ((input === null || input === undefined || input === '') && field.nullable) return null;

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
            const next = String(input ?? field.default ?? '');
            const allowed = field.enumValues ?? field.allowed ?? [];
            return allowed.includes(next) ? next : field.default ?? allowed[0] ?? '';
        }
        case 'array_of_VoucherType':
            if (!Array.isArray(input)) return Array.isArray(field.default) ? field.default : [];
            return input.map((entry) => String(entry));
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

const labelForState = (state: SaveState, isOffline: boolean) => {
    if (state === 'saving') return { label: 'Saving', tone: 'info' as const };
    if (state === 'saved') return { label: 'Saved', tone: 'success' as const };
    if (state === 'local' || isOffline) return { label: 'Saved locally', tone: 'warning' as const };
    if (state === 'error') return { label: 'Retry needed', tone: 'warning' as const };
    return { label: 'Ready', tone: 'neutral' as const };
};

export function SettingsSectionCard({
    section,
    subtitle,
    upiPayload,
}: SettingsSectionCardProps) {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const [draft, setDraft] = useState<Record<string, unknown>>({});
    const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const handledUpiPayloadRef = useRef<string>('');

    const {
        sectionFields,
        sectionData: rawSectionData,
        isLoading,
        isOffline,
        refetch,
    } = useSettingsSection(section);

    const fields = sectionFields as SettingsFieldDefinition[];

    const baselineDraft = useMemo(() => {
        const normalized: Record<string, unknown> = {};
        for (const field of fields) {
            const source = Object.prototype.hasOwnProperty.call(rawSectionData, field.key)
                ? rawSectionData[field.key]
                : field.default;
            normalized[field.key] = coerceValue(field, source);
        }
        return normalized;
    }, [fields, rawSectionData]);

    useEffect(() => {
        setDraft(baselineDraft);
    }, [baselineDraft]);

    const mutation = useSettingsSectionMutation(section, {
        onSuccess: async () => {
            setSaveState(isOffline ? 'local' : 'saved');
            await refetch();
        },
        onError: (error) => {
            if (isCloudWriteBlockedError(error)) {
                setSaveState('local');
                return;
            }
            setSaveState('error');
            dialog.alert('Save failed', toUserMessage(error, 'Failed to save settings.'));
        },
    });

    const commitWholeDraft = useCallback(async (nextDraft: Record<string, unknown>) => {
        setDraft(nextDraft);
        setSaveState('saving');
        try {
            await mutation.mutateAsync({ data: nextDraft, silent: true });
        } catch {
            // handled in mutation callbacks
        }
    }, [mutation]);

    const commitFieldValue = useCallback(async (field: SettingsFieldDefinition, nextRawValue: unknown) => {
        const nextDraft = {
            ...draft,
            [field.key]: coerceValue(field, nextRawValue),
        };
        await commitWholeDraft(nextDraft);
    }, [commitWholeDraft, draft]);

    useEffect(() => {
        if (section !== 'GENERAL') return;
        if (!upiPayload) return;
        if (handledUpiPayloadRef.current === upiPayload) return;

        handledUpiPayloadRef.current = upiPayload;
        const extractedUpiId = extractUpiIdFromPayload(upiPayload);
        if (!extractedUpiId) {
            dialog.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }

        const targetField = fields.find((field) => field.key === 'payment_upi_id');
        if (!targetField) return;
        void commitFieldValue(targetField, extractedUpiId);
    }, [commitFieldValue, dialog, fields, section, upiPayload]);

    const statusMeta = labelForState(saveState, isOffline);

    return (
        <View style={[s.card, getSurfaceStyle(colors, { elevated: true })]}>
            <View style={s.header}>
                <View style={s.headerCopy}>
                    <Text style={s.title}>{getSettingsSectionLabel(section)}</Text>
                    <Text style={s.subtitle}>{subtitle ?? 'Changes save automatically.'}</Text>
                </View>
                <SettingsStatusPill label={statusMeta.label} tone={statusMeta.tone} />
            </View>

            {isLoading ? (
                <Text style={s.loadingText}>Loading preferences…</Text>
            ) : (
                <View style={s.fieldStack}>
                    {fields.map((field) => {
                        const value = draft[field.key];
                        const selectOptions = (field.enumValues ?? field.allowed ?? []).map((option) => ({
                            label: option,
                            value: option,
                        }));
                        const resolvedInputType = inputTypeForField(field);
                        const useRadioChips = field.type === 'enum' && selectOptions.length > 0 && selectOptions.length <= 4;

                        return (
                            <View key={field.key} style={s.fieldBlock}>
                                <View style={s.fieldHeader}>
                                    <Text style={s.fieldLabel}>{field.label}</Text>
                                    {field.type === 'boolean' ? (
                                        <Switch
                                            value={Boolean(value)}
                                            onValueChange={(next) => {
                                                void commitFieldValue(field, next);
                                            }}
                                            trackColor={{ true: colors.primary, false: colors.border }}
                                            thumbColor={colors.onPrimary}
                                        />
                                    ) : null}
                                </View>

                                {field.type === 'boolean' ? null : useRadioChips ? (
                                    <View style={s.chipWrap}>
                                        {selectOptions.map((option) => (
                                            <ChipButton
                                                key={option.value}
                                                label={option.label}
                                                selected={String(value ?? '') === option.value}
                                                tone="info"
                                                onPress={() => {
                                                    void commitFieldValue(field, option.value);
                                                }}
                                            />
                                        ))}
                                    </View>
                                ) : field.type === 'array_of_VoucherType' ? (
                                    <View style={s.chipWrap}>
                                        {selectOptions.map((option) => {
                                            const selectedValues = Array.isArray(value) ? value.map(String) : [];
                                            const selected = selectedValues.includes(option.value);
                                            return (
                                                <ChipButton
                                                    key={option.value}
                                                    label={option.label}
                                                    selected={selected}
                                                    tone="info"
                                                    onPress={() => {
                                                        const next = selected
                                                            ? selectedValues.filter((entry) => entry !== option.value)
                                                            : [...selectedValues, option.value];
                                                        void commitFieldValue(field, next);
                                                    }}
                                                />
                                            );
                                        })}
                                    </View>
                                ) : resolvedInputType === 'date' ? (
                                    <DateField
                                        value={value == null ? null : String(value)}
                                        onChange={(next) => {
                                            void commitFieldValue(field, next);
                                        }}
                                    />
                                ) : field.type === 'enum' || selectOptions.length > 4 ? (
                                    <SelectField
                                        value={value == null ? '' : String(value)}
                                        options={selectOptions}
                                        onChange={(next) => {
                                            void commitFieldValue(field, next);
                                        }}
                                        allowClear={field.nullable ?? false}
                                        onClear={() => {
                                            void commitFieldValue(field, null);
                                        }}
                                        title={field.label}
                                    />
                                ) : (
                                    <AppInput
                                        inputType={resolvedInputType}
                                        value={value == null ? '' : String(value)}
                                        onChangeText={(text) => {
                                            setDraft((prev) => ({
                                                ...prev,
                                                [field.key]: coerceValue(field, text),
                                            }));
                                        }}
                                        onBlur={() => {
                                            void commitFieldValue(field, draft[field.key]);
                                        }}
                                    />
                                )}

                                {section === 'GENERAL' && field.key === 'payment_upi_id' ? (
                                    <Pressable
                                        style={[s.inlineButton, getPillStyle(colors)]}
                                        onPress={() => {
                                            router.push({
                                                pathname: '/scan',
                                                params: {
                                                    target: 'upi',
                                                    returnPath: '/(main)/settings/account',
                                                },
                                            });
                                        }}
                                    >
                                        <MaterialCommunityIcons name="qrcode-scan" size={16} color={colors.primary} />
                                        <Text style={s.inlineButtonText}>Scan UPI QR</Text>
                                    </Pressable>
                                ) : null}

                                {section === 'GENERAL' && field.key === 'signature_url' ? (
                                    <View style={s.signatureWrap}>
                                        <View style={s.signatureActionRow}>
                                            <Pressable
                                                style={[s.inlineButton, getPillStyle(colors)]}
                                                onPress={() => setSignatureCaptureVisible(true)}
                                            >
                                                <MaterialCommunityIcons name="draw" size={16} color={colors.primary} />
                                                <Text style={s.inlineButtonText}>Draw signature</Text>
                                            </Pressable>
                                            {value ? (
                                                <Pressable
                                                    style={[s.inlineButton, getPillStyle(colors, colors.error)]}
                                                    onPress={() => {
                                                        void commitFieldValue(field, '');
                                                    }}
                                                >
                                                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error} />
                                                    <Text style={[s.inlineButtonText, { color: colors.error }]}>Clear</Text>
                                                </Pressable>
                                            ) : null}
                                        </View>
                                        {value ? (
                                            <View style={[s.signaturePreviewWrap, getInsetPanelStyle(colors, colors.primary)]}>
                                                <Image
                                                    source={{ uri: String(value) }}
                                                    style={s.signaturePreview}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            )}

            <SignatureCaptureSheet
                visible={signatureCaptureVisible}
                onClose={() => setSignatureCaptureVisible(false)}
                onSave={(dataUrl) => {
                    setSignatureCaptureVisible(false);
                    const field = fields.find((entry) => entry.key === 'signature_url');
                    if (!field) return;
                    void commitFieldValue(field, dataUrl);
                }}
            />
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        card: {
            padding: DESIGN_SPACING.sectionGap,
            gap: DESIGN_SPACING.cardGap,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        headerCopy: {
            flex: 1,
            gap: 4,
        },
        title: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        subtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        loadingText: {
            color: colors.textSecondary,
            fontSize: Typography.body.size,
            fontWeight: '600',
        },
        fieldStack: {
            gap: DESIGN_SPACING.sectionGap,
        },
        fieldBlock: {
            gap: Spacing.sm,
        },
        fieldHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        fieldLabel: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
        chipWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        inlineButton: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.xs,
        },
        inlineButtonText: {
            color: colors.primary,
            fontSize: Typography.caption.size,
            fontWeight: '800',
        },
        signatureWrap: {
            gap: Spacing.sm,
        },
        signatureActionRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        signaturePreviewWrap: {
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minHeight: 92,
            justifyContent: 'center',
        },
        signaturePreview: {
            width: '100%',
            height: 72,
        },
    });
