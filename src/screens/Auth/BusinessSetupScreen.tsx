import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { userService } from '../../api/userService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { BUSINESS_SETUP_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { useNetworkStore, useSettingsStore, useUserStore } from '../../store';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { businessSetupSchema } from '../../validation/forms';

const CATEGORY_OPTIONS = ['Retail', 'Wholesale', 'Services', 'Manufacturing', 'Other'] as const;

export default function BusinessSetupScreen() {
    const { user, setUser } = useUserStore();
    const { setCurrency } = useSettingsStore();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const router = useRouter();
    const theme = useTheme();
    const dialog = useAppDialog();
    const { width } = useWindowDimensions();
    const [isUiPending, startUiTransition] = useTransition();

    const [businessName, setBusinessName] = useState(user?.businessName ?? '');
    const [address, setAddress] = useState(user?.address ?? '');
    const [gst, setGst] = useState(user?.gstNumber ?? '');
    const [currency, setSelectedCurrency] = useState(
        normalizeCurrencyCode(user?.currency ?? Config.defaultCurrency)
    );
    const [category, setCategory] = useState(user?.category || '');
    const [loading, setLoading] = useState(false);

    const isOffline = isConnected === false || isInternetReachable === false;
    const isWide = width >= 980;
    const canSave = businessName.trim().length > 0 && !loading;
    const supportedCurrencies = useMemo(() => Config.supportedCurrencies.slice(0, 8), []);

    useEffect(() => {
        if (!user) return;
        setBusinessName(user.businessName ?? '');
        setAddress(user.address ?? '');
        setGst(user.gstNumber ?? '');
        setSelectedCurrency(normalizeCurrencyCode(user.currency ?? Config.defaultCurrency));
        setCategory(user.category ?? '');
    }, [user]);

    const handleSelectCurrency = useCallback((nextCurrency: string) => {
        startUiTransition(() => {
            setSelectedCurrency(normalizeCurrencyCode(nextCurrency));
        });
    }, []);

    const handleSelectCategory = useCallback((nextCategory: string) => {
        startUiTransition(() => {
            setCategory(nextCategory);
        });
    }, []);

    const handleSave = useCallback(async () => {
        const validation = businessSetupSchema.safeParse({
            businessName,
            address,
            gst,
            category,
            currency,
        });
        if (!validation.success) {
            dialog.alert(COMMON_TEXT.alerts.validation, validation.error.issues[0]?.message || BUSINESS_SETUP_TEXT.requiredBusinessName);
            return;
        }
        const values = validation.data;

        setLoading(true);
        try {
            const normalizedCurrency = normalizeCurrencyCode(values.currency);
            const updatedUser = await userService.updateCurrentUser({
                businessName: values.businessName.trim(),
                address: values.address?.trim() || undefined,
                gstNumber: values.gst?.trim().toUpperCase() || undefined,
                gstEnabled: !!values.gst?.trim(),
                currency: normalizedCurrency,
                category: values.category?.trim() || undefined,
            });

            setUser(updatedUser);
            setCurrency(normalizedCurrency);
            router.replace('/(main)/(tabs)/home' as Href);
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert(
                    COMMON_TEXT.alerts.error,
                    error instanceof Error ? error.message : BUSINESS_SETUP_TEXT.saveFailed
                );
            }
        } finally {
            setLoading(false);
        }
    }, [address, businessName, category, currency, dialog, gst, router, setCurrency, setUser]);

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={[
                    styles.container,
                    { paddingBottom: DesignSystem.layout.pageBottom },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title={BUSINESS_SETUP_TEXT.title}
                    subtitle={BUSINESS_SETUP_TEXT.subtitle}
                />

                <AppCard animationDelay={30} style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <Chip compact icon={isOffline ? 'wifi-off' : 'wifi'} mode="flat">
                            {isOffline ? 'Offline mode' : 'Online'}
                        </Chip>
                        <Chip compact icon="store-outline" mode="flat">
                            {category || 'Category not set'}
                        </Chip>
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {isOffline
                            ? 'Changes are saved locally and sync automatically when connection returns.'
                            : 'Changes sync instantly and are available across your devices.'}
                    </Text>
                </AppCard>

                <View style={[styles.grid, isWide && styles.gridWide]}>
                    <AppCard animationDelay={50} style={[styles.gridCard, isWide && styles.gridCardWide]}>
                        <Text variant="titleSmall" style={styles.sectionTitle}>
                            Business Profile
                        </Text>
                        <AppInput
                            label={BUSINESS_SETUP_TEXT.fields.businessName}
                            value={businessName}
                            onChangeText={setBusinessName}
                            inputType="name"
                            returnKeyType="next"
                        />

                        <AppInput
                            label={BUSINESS_SETUP_TEXT.fields.businessAddress}
                            value={address}
                            onChangeText={setAddress}
                            inputType="text"
                            multiline
                            numberOfLines={3}
                            returnKeyType="done"
                        />

                        <AppInput
                            label={BUSINESS_SETUP_TEXT.fields.gstNumber}
                            value={gst}
                            onChangeText={(value) => setGst(value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                            inputType="text"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            placeholder="27ABCDE1234F1Z5"
                        />
                    </AppCard>

                    <AppCard animationDelay={75} style={[styles.gridCard, isWide && styles.gridCardWide]}>
                        <Text variant="titleSmall" style={styles.sectionTitle}>
                            Preferences
                        </Text>

                        <Text variant="labelMedium" style={styles.controlLabel}>
                            {BUSINESS_SETUP_TEXT.fields.defaultCurrency}
                        </Text>
                        <View style={styles.chipWrap}>
                            {supportedCurrencies.map((entry) => (
                                <Chip
                                    key={entry.code}
                                    compact
                                    mode={entry.code === currency ? 'flat' : 'outlined'}
                                    selected={entry.code === currency}
                                    onPress={() => handleSelectCurrency(entry.code)}
                                >
                                    {entry.code}
                                </Chip>
                            ))}
                        </View>

                        <Text variant="labelMedium" style={styles.controlLabel}>
                            Business Category
                        </Text>
                        <View style={styles.chipWrap}>
                            {CATEGORY_OPTIONS.map((entry) => (
                                <Chip
                                    key={entry}
                                    compact
                                    mode={entry === category ? 'flat' : 'outlined'}
                                    selected={entry === category}
                                    onPress={() => handleSelectCategory(entry)}
                                >
                                    {entry}
                                </Chip>
                            ))}
                        </View>
                    </AppCard>
                </View>

                <AppButton
                    mode="contained"
                    onPress={() => {
                        void handleSave();
                    }}
                    loading={loading}
                    disabled={!canSave || isUiPending}
                    style={styles.button}
                >
                    {BUSINESS_SETUP_TEXT.actions.startBilling}
                </AppButton>
                <Text variant="bodySmall" style={[styles.note, { color: theme.colors.outline }]}>
                    You can update these details later from Profile and Settings.
                </Text>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        gap: DesignSystem.layout.sectionGap,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    statusCard: {
        marginBottom: 0,
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    grid: {
        gap: DesignSystem.spacing.sm,
    },
    gridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridCard: {
        marginBottom: 0,
    },
    gridCardWide: {
        width: '49%',
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs,
    },
    controlLabel: {
        marginBottom: DesignSystem.spacing.xs,
        marginTop: DesignSystem.spacing.xs,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    button: {
        marginTop: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    note: {
        textAlign: 'center',
    },
});
