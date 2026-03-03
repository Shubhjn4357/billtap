import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, storeBusinessId } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';

type OrganizationLite = {
    id: string;
    name: string;
    code?: string | null;
    currency?: string | null;
    role?: string | null;
};

const CURRENCIES = ['INR', 'USD', 'EUR', 'AED'];

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
    const response = await api.get<{ ok: boolean; organizations?: OrganizationLite[]; message?: string }>('/api/organizations/mine');
    if (!response.ok) {
        throw new Error(response.message ?? 'Failed to load businesses.');
    }
    return response.organizations ?? [];
};

const createOrganization = async (input: { name: string; code: string; currency: string }): Promise<string> => {
    const response = await api.post<{ ok: boolean; id?: string; message?: string }>('/api/organizations', input);
    if (!response.ok || !response.id) {
        throw new Error(response.message ?? 'Failed to create business.');
    }
    return response.id;
};

export default function BusinessSelectScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);
    const queryClient = useQueryClient();

    const refreshUser = useAuthStore((state) => state.refreshUser);
    const signOut = useAuthStore((state) => state.signOut);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState('');
    const [businessCode, setBusinessCode] = useState('');
    const [currency, setCurrency] = useState('INR');
    const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null);

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

    const helperText = useMemo(() => {
        if (!businessName.trim()) return 'Business code auto-generates from business name.';
        return `Suggested code: ${deriveBusinessCode(businessName)}`;
    }, [businessName]);

    const handleContinue = async (businessId?: string) => {
        const nextBusinessId = businessId ?? selectedId;
        if (!nextBusinessId) {
            Alert.alert('Select Business', 'Choose a business or create one to continue.');
            return;
        }

        setSwitchingBusinessId(nextBusinessId);
        try {
            await storeBusinessId(nextBusinessId);
            await refreshUser();
            router.replace('/(main)');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to switch business.';
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
            await handleContinue(id);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create business.';
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
