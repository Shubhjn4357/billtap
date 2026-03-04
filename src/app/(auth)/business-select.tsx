import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { storeBusinessId, toUserMessage } from '../../api/client';
import { businessApi, settingsApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { extractUpiIdFromPayload, isValidUpiId, sanitizeUpiId } from '../../utils/upi';
import { SignatureCaptureSheet } from '../../components/signature/SignatureCaptureSheet';

type OrganizationLite = {
    id: string;
    name: string;
    code?: string | null;
    currency?: string | null;
    role?: string | null;
};

const CURRENCIES = ['INR', 'USD', 'EUR', 'AED'];
const PENDING_SETUP_KEY_PREFIX = 'vahi_pending_setup_';

const sanitizeBusinessCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

const deriveBusinessCode = (name: string) => {
    const compact = sanitizeBusinessCode(name.replace(/\s+/g, ''));
    if (compact.length >= 2) return compact.slice(0, 10);

    const words = name
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((entry) => entry[0]?.toUpperCase() ?? '')
        .join('');

    const fallback = sanitizeBusinessCode(words);
    if (fallback.length >= 2) return fallback;
    return `VH${Date.now().toString().slice(-4)}`;
};

const fetchOrganizations = async (): Promise<OrganizationLite[]> => {
    const response = await businessApi.list();
    return (response.data ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code ?? null,
        currency: entry.currency ?? 'INR',
        role: 'owner',
    }));
};

const createOrganization = async (input: { name: string; code: string; currency: string }): Promise<string> => {
    const response = await businessApi.create({
        name: input.name,
        code: input.code,
        currency: input.currency,
    });
    return response.data.id;
};

const isCloudWriteRestriction = (error: unknown): boolean => {
    const message = toUserMessage(error, '').toLowerCase();
    return (
        message.includes('offline mode only') ||
        message.includes('cloud write actions are blocked') ||
        message.includes('read-only')
    );
};

export default function BusinessSelectScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ upiPayload?: string | string[]; scanAt?: string | string[] }>();

    const refreshUser = useAuthStore((state) => state.refreshUser);
    const signOut = useAuthStore((state) => state.signOut);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState('');
    const [businessCode, setBusinessCode] = useState('');
    const [currency, setCurrency] = useState('INR');
    const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null);
    const [paymentUpiId, setPaymentUpiId] = useState('');
    const [signatureUrl, setSignatureUrl] = useState('');
    const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);

    const {
        data: organizations = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['organizations-mine'],
        queryFn: fetchOrganizations,
        staleTime: 60_000,
    });

    useEffect(() => {
        if (!selectedId && organizations.length > 0) {
            setSelectedId(organizations[0].id);
        }
    }, [organizations, selectedId]);

    const createMutation = useMutation({
        mutationFn: createOrganization,
    });

    useEffect(() => {
        const payload = Array.isArray(params.upiPayload) ? params.upiPayload[0] : params.upiPayload;
        if (!payload) return;
        const extracted = extractUpiIdFromPayload(payload);
        if (!extracted) {
            Alert.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }
        setPaymentUpiId(extracted);
        Alert.alert('UPI', 'UPI ID captured. It will be saved in General settings after continue.');
    }, [params.scanAt, params.upiPayload]);

    const helperText = useMemo(() => {
        if (!businessName.trim()) return 'Business code auto-generates from business name.';
        return `Suggested code: ${deriveBusinessCode(businessName)}`;
    }, [businessName]);

    const persistBusinessSetup = async (receiverName?: string) => {
        const normalizedUpi = sanitizeUpiId(paymentUpiId);
        const normalizedSignature = signatureUrl.trim();
        const hasSetup = Boolean(normalizedUpi || normalizedSignature);
        if (!hasSetup) return;

        if (normalizedUpi && !isValidUpiId(normalizedUpi)) {
            throw new Error('Invalid UPI ID format. Use format like merchant@upi.');
        }

        await settingsApi.update('GENERAL', {
            data: {
                payment_upi_id: normalizedUpi || null,
                payment_receiver_name: receiverName?.trim() || null,
                signature_url: normalizedSignature || null,
                signature_data_url: normalizedSignature.startsWith('data:image/') ? normalizedSignature : null,
            },
        });
    };

    const persistSetupOfflineDraft = async (businessId: string, receiverName?: string) => {
        const payload = {
            payment_upi_id: sanitizeUpiId(paymentUpiId) || null,
            payment_receiver_name: receiverName?.trim() || null,
            signature_url: signatureUrl.trim() || null,
        };
        await SecureStore.setItemAsync(`${PENDING_SETUP_KEY_PREFIX}${businessId}`, JSON.stringify(payload));
    };

    const handleContinue = async (businessId?: string, receiverName?: string) => {
        const nextBusinessId = businessId ?? selectedId;
        if (!nextBusinessId) {
            Alert.alert('Select Business', 'Choose a business or create one to continue.');
            return;
        }

        setSwitchingBusinessId(nextBusinessId);
        try {
            await storeBusinessId(nextBusinessId);
            try {
                await persistBusinessSetup(receiverName);
            } catch (error) {
                if (isCloudWriteRestriction(error)) {
                    await persistSetupOfflineDraft(nextBusinessId, receiverName);
                } else {
                    Alert.alert('Setup not saved', toUserMessage(error, 'Unable to save UPI/signature setup.'));
                }
            }
            await refreshUser();
            router.replace('/(main)');
        } catch (error) {
            const message = toUserMessage(error, 'Unable to switch business.');
            Alert.alert('Could not continue', message);
        } finally {
            setSwitchingBusinessId(null);
        }
    };

    const handleCreateBusiness = async () => {
        const name = businessName.trim();
        if (name.length < 2) {
            Alert.alert('Business Name Required', 'Enter a valid business name with at least 2 characters.');
            return;
        }

        const code = sanitizeBusinessCode(businessCode.trim()) || deriveBusinessCode(name);
        if (code.length < 2) {
            Alert.alert('Business Code Invalid', 'Enter at least 2 alphanumeric characters for business code.');
            return;
        }

        try {
            const id = await createMutation.mutateAsync({ name, code, currency });
            setBusinessName('');
            setBusinessCode('');
            await refetch();
            await queryClient.invalidateQueries({ queryKey: ['organizations-mine'] });
            setSelectedId(id);
            await handleContinue(id, name);
        } catch (error) {
            const message = toUserMessage(error, 'Failed to create business.');
            Alert.alert('Create Business Failed', message);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
                    <View style={s.header}>
                        <Text style={s.title}>Select Business</Text>
                        <Text style={s.subtitle}>Choose an existing business or create a new one before entering Vahi.</Text>
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Your Businesses</Text>
                        {isLoading ? (
                            <View style={s.loadingBox}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : organizations.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Text style={s.emptyText}>No business found yet. Create one below.</Text>
                            </View>
                        ) : (
                            organizations.map((org) => {
                                const isActive = selectedId === org.id;
                                const isSwitching = switchingBusinessId === org.id;
                                return (
                                    <Pressable
                                        key={org.id}
                                        style={[
                                            s.orgCard,
                                            isActive && {
                                                borderColor: colors.primary,
                                                backgroundColor: colors.surfaceVariant,
                                            },
                                        ]}
                                        onPress={() => setSelectedId(org.id)}
                                    >
                                        <View style={s.orgRow}>
                                            <Text style={s.orgName}>{org.name}</Text>
                                            <View style={[s.roleChip, { backgroundColor: colors.backgroundElement }]}>
                                                <Text style={s.roleChipText}>{(org.role ?? 'owner').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.orgMeta}>
                                            Code: {org.code ?? '-'} | Currency: {org.currency ?? 'INR'}
                                        </Text>
                                        {isActive ? (
                                            <Pressable
                                                style={[s.primaryButton, isSwitching && s.buttonDisabled]}
                                                onPress={() => handleContinue(org.id)}
                                                disabled={Boolean(isSwitching)}
                                            >
                                                {isSwitching ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <Text style={s.primaryButtonText}>Continue with this business</Text>
                                                )}
                                            </Pressable>
                                        ) : null}
                                    </Pressable>
                                );
                            })
                        )}
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Create New Business</Text>
                        <View style={s.formCard}>
                            <Text style={s.inputLabel}>Business Name</Text>
                            <TextInput
                                value={businessName}
                                onChangeText={setBusinessName}
                                placeholder="e.g. Vahi Traders"
                                placeholderTextColor={colors.textSecondary}
                                style={s.input}
                                autoCapitalize="words"
                            />

                            <Text style={s.inputLabel}>Business Code (optional)</Text>
                            <TextInput
                                value={businessCode}
                                onChangeText={(value) => setBusinessCode(sanitizeBusinessCode(value))}
                                placeholder="Auto-generated if left empty"
                                placeholderTextColor={colors.textSecondary}
                                style={s.input}
                                autoCapitalize="characters"
                            />
                            <Text style={s.helperText}>{helperText}</Text>

                            <Text style={s.inputLabel}>Currency</Text>
                            <View style={s.currencyRow}>
                                {CURRENCIES.map((entry) => (
                                    <Pressable
                                        key={entry}
                                        onPress={() => setCurrency(entry)}
                                        style={[
                                            s.currencyChip,
                                            currency === entry && {
                                                borderColor: colors.primary,
                                                backgroundColor: colors.surfaceVariant,
                                            },
                                        ]}
                                    >
                                        <Text style={s.currencyChipText}>{entry}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={s.inputLabel}>Payment UPI ID (optional)</Text>
                            <TextInput
                                value={paymentUpiId}
                                onChangeText={setPaymentUpiId}
                                placeholder="merchant@upi"
                                placeholderTextColor={colors.textSecondary}
                                style={s.input}
                                autoCapitalize="none"
                            />
                            <Pressable
                                style={s.scanAction}
                                onPress={() => router.push({
                                    pathname: '/scan',
                                    params: {
                                        target: 'upi_profile',
                                        returnPath: '/(auth)/business-select',
                                    },
                                })}
                            >
                                <Text style={[s.scanActionText, { color: colors.primary }]}>Scan UPI QR</Text>
                            </Pressable>

                            <Text style={s.inputLabel}>Signature Image URL (optional)</Text>
                            <TextInput
                                value={signatureUrl}
                                onChangeText={setSignatureUrl}
                                placeholder="https://.../signature.png"
                                placeholderTextColor={colors.textSecondary}
                                style={s.input}
                                autoCapitalize="none"
                            />
                            <View style={s.signatureActions}>
                                <Pressable
                                    style={[s.secondaryInlineButton, { borderColor: colors.border }]}
                                    onPress={() => setSignatureCaptureVisible(true)}
                                >
                                    <Text style={[s.secondaryInlineButtonText, { color: colors.primary }]}>Draw Signature</Text>
                                </Pressable>
                                {signatureUrl ? (
                                    <Pressable
                                        style={[s.secondaryInlineButton, { borderColor: colors.border }]}
                                        onPress={() => setSignatureUrl('')}
                                    >
                                        <Text style={[s.secondaryInlineButtonText, { color: colors.error }]}>Clear</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                            {signatureUrl ? (
                                <View style={s.signaturePreviewWrap}>
                                    <Image source={{ uri: signatureUrl }} style={s.signaturePreview} resizeMode="contain" />
                                </View>
                            ) : null}
                            <Text style={s.helperText}>UPI and signature setup will be saved into General settings of selected business.</Text>

                            <Pressable
                                style={[s.primaryButton, createMutation.isPending && s.buttonDisabled]}
                                onPress={handleCreateBusiness}
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={s.primaryButtonText}>Create and Continue</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>

                    <Pressable style={s.secondaryButton} onPress={handleSignOut}>
                        <Text style={s.secondaryButtonText}>Sign out</Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
            <SignatureCaptureSheet
                visible={signatureCaptureVisible}
                onClose={() => setSignatureCaptureVisible(false)}
                onSave={(dataUrl) => {
                    setSignatureCaptureVisible(false);
                    setSignatureUrl(dataUrl);
                }}
            />
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        flex: { flex: 1 },
        container: {
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.xl,
            gap: Spacing.lg,
        },
        header: {
            gap: Spacing.xs,
        },
        title: {
            fontSize: Typography.headline.size,
            fontWeight: '700',
            color: colors.text,
        },
        subtitle: {
            fontSize: Typography.body.size,
            color: colors.textSecondary,
        },
        section: {
            gap: Spacing.sm,
        },
        sectionTitle: {
            fontSize: Typography.label.size,
            fontWeight: '700',
            color: colors.textSecondary,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
        },
        loadingBox: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyBox: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.lg,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: Typography.body.size,
        },
        orgCard: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.md,
            gap: Spacing.sm,
            marginBottom: Spacing.sm,
        },
        orgRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        orgName: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.title.size,
            fontWeight: '600',
        },
        roleChip: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 3,
        },
        roleChipText: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        orgMeta: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
        },
        formCard: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        inputLabel: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        input: {
            backgroundColor: colors.surfaceVariant,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.md,
            paddingVertical: 10,
            color: colors.text,
            fontSize: Typography.body.size,
        },
        helperText: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
        },
        signatureActions: {
            flexDirection: 'row',
            gap: Spacing.sm,
            marginTop: Spacing.xs,
            alignItems: 'center',
        },
        secondaryInlineButton: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        secondaryInlineButtonText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        signaturePreviewWrap: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.md,
            overflow: 'hidden',
            backgroundColor: '#fff',
            marginTop: Spacing.xs,
        },
        signaturePreview: {
            width: '100%',
            height: 120,
        },
        scanAction: {
            alignSelf: 'flex-start',
            marginTop: 2,
            marginBottom: 2,
        },
        scanActionText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        currencyRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            flexWrap: 'wrap',
        },
        currencyChip: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: 8,
            backgroundColor: colors.backgroundElement,
        },
        currencyChipText: {
            color: colors.text,
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        primaryButton: {
            backgroundColor: colors.primary,
            borderRadius: Radius.pill,
            minHeight: 46,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: Spacing.xs,
        },
        primaryButtonText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: Typography.body.size,
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        secondaryButton: {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: Radius.pill,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        secondaryButtonText: {
            color: colors.textSecondary,
            fontWeight: '700',
        },
    });
