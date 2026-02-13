import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { List, Switch, Text, useTheme } from 'react-native-paper';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../api/firebaseConfig';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Config } from '../../constants/Config';
import { SETTINGS_TEXT } from '../../constants/staticText';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useSettingsStore, useUserStore } from '../../store';

type UpdateState = 'idle' | 'checking' | 'downloading' | 'upToDate' | 'downloaded' | 'disabled' | 'error';

const formatTimestamp = (value: Date | null): string => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(value);
};

const getRuntimeVersion = (): string => {
    if (Updates.runtimeVersion) return Updates.runtimeVersion;

    const configRuntimeVersion = Constants.expoConfig?.runtimeVersion;
    if (typeof configRuntimeVersion === 'string') {
        return configRuntimeVersion;
    }

    if (configRuntimeVersion && typeof configRuntimeVersion === 'object' && 'policy' in configRuntimeVersion) {
        return `policy:${String(configRuntimeVersion.policy)}`;
    }

    return 'N/A';
};

export const SettingsScreen = () => {
    const { user, signOut } = useAuth();
    const { setUser } = useUserStore();
    const theme = useTheme();
    const router = useRouter();
    const { autoTheme, themeMode, setThemeMode, currencySymbol, setCurrency } = useSettingsStore();

    const [updateState, setUpdateState] = useState<UpdateState>('idle');
    const [updateMessage, setUpdateMessage] = useState<string>(SETTINGS_TEXT.updateMessages.initial);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
    const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

    const effectiveDark = autoTheme ? theme.dark : themeMode === 'dark';
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol);
    const subscriptionLabel = user?.subscriptionStatus === 'active'
        ? `${user.subscriptionPlanName ?? 'Plan'} ${SETTINGS_TEXT.account.subscriptionActiveSuffix}`
        : SETTINGS_TEXT.account.subscriptionInactive;

    const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'Unknown';
    const buildVersion = Constants.nativeBuildVersion ?? 'N/A';
    const runtimeVersion = getRuntimeVersion();
    const updateChannel = Updates.channel ?? 'default';
    const canCheckUpdates = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;

    const updateStatusLabel = useMemo(() => {
        return SETTINGS_TEXT.updateStatus[updateState];
    }, [updateState]);

    const handleCurrencyChange = async (currency: string) => {
        const normalized = normalizeCurrencyCode(currency);
        const previousCurrency = activeCurrency;
        setCurrency(normalized);

        if (user) {
            setUser({ ...user, currency: normalized });
        }

        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            await setDoc(doc(db, 'users', uid), { currency: normalized, updatedAt: serverTimestamp() }, { merge: true });
        } catch (error: unknown) {
            setCurrency(previousCurrency);
            if (user) {
                setUser({ ...user, currency: previousCurrency });
            }
            Alert.alert(
                SETTINGS_TEXT.errors.generic,
                error instanceof Error ? error.message : SETTINGS_TEXT.errors.currencySaveFailed
            );
        }
    };

    const checkForUpdates = useCallback(async () => {
        setLastCheckedAt(new Date());

        if (!canCheckUpdates) {
            const message = __DEV__
                ? SETTINGS_TEXT.updateMessages.devOnly
                : Platform.OS === 'web'
                    ? SETTINGS_TEXT.updateMessages.webManaged
                    : SETTINGS_TEXT.updateMessages.disabled;

            setUpdateState('disabled');
            setUpdateMessage(message);
            return;
        }

        setUpdateState('checking');
        setUpdateMessage(SETTINGS_TEXT.updateMessages.checking);

        try {
            const update = await Updates.checkForUpdateAsync();
            if (!update.isAvailable) {
                setUpdateState('upToDate');
                setUpdateMessage(SETTINGS_TEXT.updateMessages.upToDate);
                return;
            }

            setUpdateState('downloading');
            setUpdateMessage(SETTINGS_TEXT.updateMessages.downloading);
            await Updates.fetchUpdateAsync();

            setUpdateState('downloaded');
            setUpdateMessage(SETTINGS_TEXT.updateMessages.downloaded);
        } catch (error: unknown) {
            setUpdateState('error');
            setUpdateMessage(error instanceof Error ? error.message : SETTINGS_TEXT.updateMessages.failed);
        }
    }, [canCheckUpdates]);

    const applyDownloadedUpdate = async () => {
        if (updateState !== 'downloaded') return;

        setIsApplyingUpdate(true);
        try {
            await Updates.reloadAsync();
        } catch (error: unknown) {
            Alert.alert(
                SETTINGS_TEXT.errors.updateError,
                error instanceof Error ? error.message : SETTINGS_TEXT.updateMessages.applyFailed
            );
        } finally {
            setIsApplyingUpdate(false);
        }
    };

    useEffect(() => {
        void checkForUpdates();
    }, [checkForUpdates]);

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={{ marginBottom: 20, marginTop: 8 }}>
                    <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 5 }}>
                        {SETTINGS_TEXT.title}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                        {user?.email || user?.phoneNumber || SETTINGS_TEXT.userFallback}
                    </Text>
                </View>

                <List.Section>
                    <List.Subheader>{SETTINGS_TEXT.sections.appearance}</List.Subheader>
                    <List.Item
                        title={SETTINGS_TEXT.appearance.useSystemTheme}
                        right={() => (
                            <Switch
                                value={autoTheme}
                                onValueChange={(enabled) => setThemeMode(enabled ? 'auto' : (effectiveDark ? 'dark' : 'light'))}
                            />
                        )}
                        left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                    />
                    <List.Item
                        title={SETTINGS_TEXT.appearance.darkMode}
                        description={autoTheme ? SETTINGS_TEXT.appearance.darkModeSystemNote : undefined}
                        disabled={autoTheme}
                        right={() => (
                            <Switch
                                value={effectiveDark}
                                onValueChange={(enabled) => setThemeMode(enabled ? 'dark' : 'light')}
                            />
                        )}
                        left={(props) => <List.Icon {...props} icon="weather-night" />}
                    />
                </List.Section>

                <List.Section>
                    <List.Subheader>{SETTINGS_TEXT.sections.billingPreferences}</List.Subheader>
                    <List.Accordion
                        title={`${SETTINGS_TEXT.billing.currencyPrefix} ${activeCurrency}`}
                        left={(props) => <List.Icon {...props} icon="cash-multiple" />}
                    >
                        {Config.supportedCurrencies.map((entry) => (
                            <List.Item
                                key={entry.code}
                                title={`${entry.code} - ${entry.label}`}
                                onPress={() => {
                                    void handleCurrencyChange(entry.code);
                                }}
                                right={(props) => (
                                    entry.code === activeCurrency ? <List.Icon {...props} icon="check" /> : null
                                )}
                            />
                        ))}
                    </List.Accordion>
                </List.Section>

                <List.Section>
                    <List.Subheader>{SETTINGS_TEXT.sections.account}</List.Subheader>
                    <List.Item
                        title={SETTINGS_TEXT.account.subscriptionTitle}
                        description={subscriptionLabel}
                        left={(props) => <List.Icon {...props} icon="credit-card-outline" />}
                        onPress={() => router.push('/subscription' as never)}
                    />
                    {user?.role === 'admin' && (
                        <List.Item
                            title={SETTINGS_TEXT.account.adminPanelTitle}
                            description={SETTINGS_TEXT.account.adminPanelDescription}
                            left={(props) => <List.Icon {...props} icon="shield-crown-outline" />}
                            onPress={() => router.push('/admin' as never)}
                        />
                    )}
                    <List.Item
                        title={SETTINGS_TEXT.account.businessProfileTitle}
                        description={SETTINGS_TEXT.account.businessProfileDescription}
                        left={(props) => <List.Icon {...props} icon="store" />}
                        onPress={() => router.push('/business-setup' as never)}
                    />
                </List.Section>

                <List.Section>
                    <List.Subheader>{SETTINGS_TEXT.sections.appInformation}</List.Subheader>
                    <List.Item
                        title={SETTINGS_TEXT.appInfo.aboutTitle}
                        description={SETTINGS_TEXT.appInfo.aboutDescription}
                        left={(props) => <List.Icon {...props} icon="information-outline" />}
                        onPress={() => router.push('/about' as never)}
                    />
                    <List.Item
                        title={SETTINGS_TEXT.appInfo.changelogTitle}
                        description={SETTINGS_TEXT.appInfo.changelogDescription}
                        left={(props) => <List.Icon {...props} icon="history" />}
                        onPress={() => router.push('/changelog' as never)}
                    />
                    <List.Item
                        title={SETTINGS_TEXT.appInfo.termsTitle}
                        description={SETTINGS_TEXT.appInfo.termsDescription}
                        left={(props) => <List.Icon {...props} icon="file-document-outline" />}
                        onPress={() => router.push('/terms' as never)}
                    />
                    <List.Item
                        title={SETTINGS_TEXT.appInfo.privacyTitle}
                        description={SETTINGS_TEXT.appInfo.privacyDescription}
                        left={(props) => <List.Icon {...props} icon="shield-account-outline" />}
                        onPress={() => router.push('/privacy' as never)}
                    />
                    <List.Item
                        title={SETTINGS_TEXT.appInfo.sitemapTitle}
                        description={SETTINGS_TEXT.appInfo.sitemapDescription}
                        left={(props) => <List.Icon {...props} icon="sitemap" />}
                        onPress={() => router.push('/sitemap' as never)}
                    />
                </List.Section>

                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        {SETTINGS_TEXT.updateCard.title}
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 8 }}>
                        {SETTINGS_TEXT.updateCard.versionLabel}: {appVersion}
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 2 }}>
                        {SETTINGS_TEXT.updateCard.buildLabel}: {buildVersion}
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 2 }}>
                        {SETTINGS_TEXT.updateCard.runtimeLabel}: {runtimeVersion}
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 2 }}>
                        {SETTINGS_TEXT.updateCard.channelLabel}: {updateChannel}
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 6 }}>
                        {SETTINGS_TEXT.updateCard.statusLabel}: {updateStatusLabel}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                        {updateMessage}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                        {SETTINGS_TEXT.updateCard.lastCheckedLabel}: {formatTimestamp(lastCheckedAt)}
                    </Text>

                    <AppButton
                        mode="outlined"
                        style={{ marginTop: 10 }}
                        loading={updateState === 'checking' || updateState === 'downloading'}
                        disabled={isApplyingUpdate}
                        onPress={() => { void checkForUpdates(); }}
                    >
                        {SETTINGS_TEXT.updateCard.checkButton}
                    </AppButton>

                    {updateState === 'downloaded' && (
                        <AppButton
                            mode="contained"
                            style={{ marginTop: 8 }}
                            loading={isApplyingUpdate}
                            onPress={() => { void applyDownloadedUpdate(); }}
                        >
                            {SETTINGS_TEXT.updateCard.applyButton}
                        </AppButton>
                    )}
                </AppCard>

                <View style={{ marginTop: 8, marginBottom: 8 }}>
                    <AppButton mode="outlined" onPress={signOut} icon="logout">
                        {SETTINGS_TEXT.actions.signOut}
                    </AppButton>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};
