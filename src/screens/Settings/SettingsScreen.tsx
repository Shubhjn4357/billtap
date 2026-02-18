import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { List, Switch, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../api/adminService';
import { businessSuiteService } from '../../api/businessSuiteService';
import { offlineSyncService } from '../../api/offlineSyncService';
import { userService } from '../../api/userService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { SETTINGS_TEXT } from '../../constants/staticText';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationStore, useSettingsStore, useUserStore } from '../../store';
import { useOrganizationAccess, type AppModuleAccessMap, DEFAULT_APP_MODULE_ACCESS, type AppModuleKey } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';

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

const parseDateSafe = (value: string | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    const {
        canAccessSettings,
        canManageSubscription,
        canAccessAccounting,
        canAccessOperations,
        canAccessBusinessSuite,
        canAccessAdminPanel,
        appModuleAccess,
        setOrganizationSettings,
        isOwnerOrAdmin,
    } = useOrganizationAccess();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const { setUser } = useUserStore();
    const theme = useTheme();
    const router = useRouter();
    const dialog = useAppDialog();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [isUiPending, startUiTransition] = useTransition();
    const {
        autoTheme,
        themeMode,
        setThemeMode,
        currencySymbol,
        setCurrency,
        notificationSoundEnabled,
        toggleNotificationSound,
    } = useSettingsStore();

    const [updateState, setUpdateState] = useState<UpdateState>('idle');
    const [updateMessage, setUpdateMessage] = useState<string>(SETTINGS_TEXT.updateMessages.initial);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
    const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [oldestPendingAt, setOldestPendingAt] = useState<Date | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
    const [storageBackend, setStorageBackend] = useState<'sqlite-drizzle' | 'async-storage'>('async-storage');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string>(SETTINGS_TEXT.dataSync.idleMessage);
    const [moduleAccessDraft, setModuleAccessDraft] = useState<AppModuleAccessMap>(DEFAULT_APP_MODULE_ACCESS);
    const [savingModuleAccess, setSavingModuleAccess] = useState(false);

    const isSystemTheme = themeMode === 'system' || autoTheme;
    const effectiveDark = isSystemTheme ? theme.dark : themeMode === 'dark';
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol);
    const subscriptionLabel = user?.subscriptionStatus === 'active'
        ? `${user.subscriptionPlanName ?? 'Plan'} ${SETTINGS_TEXT.account.subscriptionActiveSuffix}`
        : SETTINGS_TEXT.account.subscriptionInactive;

    const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'Unknown';
    const buildVersion = Constants.nativeBuildVersion ?? 'N/A';
    const runtimeVersion = getRuntimeVersion();
    const updateChannel = Updates.channel ?? 'default';
    const canCheckUpdates = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 24);
    const isWide = width >= 1100;

    const updateStatusLabel = useMemo(() => {
        return SETTINGS_TEXT.updateStatus[updateState];
    }, [updateState]);
    const sectionCardStyle = useMemo(
        () => ({
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
        }),
        [theme.colors.outlineVariant, theme.colors.surface]
    );
    const sectionCardContainer = useMemo(
        () => [styles.sectionCard, sectionCardStyle, isWide && styles.sectionCardWide],
        [isWide, sectionCardStyle]
    );

    const moduleFields = useMemo(
        () => ([
            { key: 'billingPurchase' as AppModuleKey, title: 'Purchase Ledger', description: 'Disable purchase entry and inward ledger.' },
            { key: 'billingSale' as AppModuleKey, title: 'Sales Ledger', description: 'Disable sales invoice creation.' },
            { key: 'parties' as AppModuleKey, title: 'Party Ledger', description: 'Hide customer/supplier ledger.' },
            { key: 'payments' as AppModuleKey, title: 'Payment Settlements', description: 'Hide payment in/out settlement pages.' },
            { key: 'expenses' as AppModuleKey, title: 'Expense Tracking', description: 'Hide expense screens and actions.' },
            { key: 'accounting' as AppModuleKey, title: 'Accounting Suite', description: 'Hide accounting pages from app.' },
            { key: 'reports' as AppModuleKey, title: 'Reports', description: 'Hide analytics and exports.' },
            { key: 'stock' as AppModuleKey, title: 'Inventory', description: 'Hide stock/inventory module.' },
        ]),
        []
    );

    const adminAccessQuery = useQuery({
        queryKey: ['settings-admin-access'] as const,
        queryFn: async () => {
            return await adminService.getAccess();
        },
        staleTime: 60_000,
        retry: false,
        enabled: canAccessSettings && isOwnerOrAdmin,
    });

    const canAccessAdminPanelEntry = Boolean(adminAccessQuery.data?.canAccess && canAccessAdminPanel);

    const handleCurrencyChange = async (currency: string) => {
        const normalized = normalizeCurrencyCode(currency);
        const previousCurrency = activeCurrency;
        startUiTransition(() => {
            setCurrency(normalized);
            if (user) {
                setUser({ ...user, currency: normalized });
            }
        });

        if (!user) return;

        try {
            const updatedUser = await userService.updateCurrentUser({ currency: normalized });
            setUser(updatedUser);
        } catch (error: unknown) {
            startUiTransition(() => {
                setCurrency(previousCurrency);
                if (user) {
                    setUser({ ...user, currency: previousCurrency });
                }
            });
            if (!isNetworkLikeError(error)) {
                dialog.alert(
                    SETTINGS_TEXT.errors.generic,
                    error instanceof Error ? error.message : SETTINGS_TEXT.errors.currencySaveFailed
                );
            }
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
            if (!isNetworkLikeError(error)) {
                dialog.alert(
                    SETTINGS_TEXT.errors.updateError,
                    error instanceof Error ? error.message : SETTINGS_TEXT.updateMessages.applyFailed
                );
            }
        } finally {
            setIsApplyingUpdate(false);
        }
    };

    const refreshQueueStats = useCallback(async () => {
        try {
            const stats = await offlineSyncService.getQueueStats();
            setPendingSyncCount(stats.pendingCount);
            setOldestPendingAt(parseDateSafe(stats.oldestCreatedAt));
            setSyncMessage(
                stats.pendingCount > 0
                    ? SETTINGS_TEXT.dataSync.queuedMessage
                    : SETTINGS_TEXT.dataSync.idleMessage
            );
        } catch {
            // Keep last known state on read failures.
        }
    }, []);

    const runManualSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncMessage(SETTINGS_TEXT.dataSync.syncingMessage);

        try {
            const result = await offlineSyncService.flushQueue();
            setLastSyncAt(new Date());
            if (result.remaining > 0) {
                setSyncMessage(`Synced ${result.processed}. ${result.remaining} pending.`);
            } else {
                setSyncMessage(SETTINGS_TEXT.dataSync.idleMessage);
            }
        } catch {
            setSyncMessage('Sync failed. Please try again.');
        } finally {
            setIsSyncing(false);
            await refreshQueueStats();
        }
    }, [isSyncing, refreshQueueStats]);

    const saveModuleAccess = useCallback(async () => {
        if (!isOwnerOrAdmin) return;
        setSavingModuleAccess(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings({
                appModuleAccess: moduleAccessDraft,
                moduleVisibility: moduleAccessDraft,
            }, selectedOrganizationId ?? undefined);
            setOrganizationSettings(settings);
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Module Visibility', error instanceof Error ? error.message : 'Failed to save module visibility.');
            }
        } finally {
            setSavingModuleAccess(false);
        }
    }, [dialog, isOwnerOrAdmin, moduleAccessDraft, selectedOrganizationId, setOrganizationSettings]);

    useEffect(() => {
        void checkForUpdates();
    }, [checkForUpdates]);

    useEffect(() => {
        setModuleAccessDraft((current) => ({
            ...current,
            ...appModuleAccess,
        }));
    }, [appModuleAccess]);

    useEffect(() => {
        void refreshQueueStats();
        setStorageBackend(offlineSyncService.getStorageBackend());
    }, [refreshQueueStats]);

    useFocusRefresh(refreshQueueStats, {
        enabled: canAccessSettings,
        minIntervalMs: 8_000,
        delayMs: 120,
    });

    return (
        <ScreenWrapper>
            {!canAccessSettings ? (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]} showsVerticalScrollIndicator={false}>
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={SETTINGS_TEXT.title}
                            subtitle="Access restricted"
                        />
                        <AppCard animationDelay={40}>
                            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                Settings access is disabled
                            </Text>
                            <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.outline }}>
                                Ask owner/admin to enable settings permissions for your account.
                            </Text>
                        </AppCard>
                        <View style={styles.signOutWrap}>
                            <AppButton mode="outlined" onPress={signOut} icon="logout">
                                {SETTINGS_TEXT.actions.signOut}
                            </AppButton>
                        </View>
                    </View>
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]} showsVerticalScrollIndicator={false}>
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={SETTINGS_TEXT.title}
                            subtitle={user?.email || user?.phoneNumber || SETTINGS_TEXT.userFallback}
                        />
                        <AppCard
                            animationDelay={30}
                            style={styles.heroCard}
                        >
                            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                Preferences & Controls
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                                Theme, sync status, account access and app updates in one place.
                            </Text>
                        </AppCard>
                        {adminAccessQuery.error && !isNetworkLikeError(adminAccessQuery.error) ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
                                {adminAccessQuery.error instanceof Error ? adminAccessQuery.error.message : 'Failed to verify admin access.'}
                            </Text>
                        ) : null}

                        <View style={[styles.grid, isWide && styles.gridWide]}>
                    <AppCard animationDelay={40} style={sectionCardContainer}>
                        <List.Section style={styles.listSection}>
                            <List.Subheader>{SETTINGS_TEXT.sections.appearance}</List.Subheader>
                            <List.Item
                                title={SETTINGS_TEXT.appearance.useSystemTheme}
                                right={() => (
                                    <Switch
                                        value={isSystemTheme}
                                        onValueChange={(enabled) => setThemeMode(enabled ? 'system' : (effectiveDark ? 'dark' : 'light'))}
                                    />
                                )}
                                left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                            />
                            <List.Item
                                title={SETTINGS_TEXT.appearance.darkMode}
                                description={isSystemTheme ? SETTINGS_TEXT.appearance.darkModeSystemNote : undefined}
                                disabled={isSystemTheme}
                                right={() => (
                                    <Switch
                                        value={effectiveDark}
                                        onValueChange={(enabled) => setThemeMode(enabled ? 'dark' : 'light')}
                                    />
                                )}
                                left={(props) => <List.Icon {...props} icon="weather-night" />}
                            />
                        </List.Section>
                    </AppCard>

                    <AppCard animationDelay={52} style={sectionCardContainer}>
                        <List.Section style={styles.listSection}>
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
                            <List.Item
                                title="Notification Sound"
                                description="Play system sound for reminders and task alerts"
                                left={(props) => <List.Icon {...props} icon="volume-high" />}
                                right={() => (
                                    <Switch
                                        value={notificationSoundEnabled}
                                        onValueChange={toggleNotificationSound}
                                    />
                                )}
                            />
                        </List.Section>
                    </AppCard>

                    {isOwnerOrAdmin && (
                        <AppCard animationDelay={56} style={sectionCardContainer}>
                            <List.Section style={styles.listSection}>
                                <List.Subheader>Module Visibility</List.Subheader>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}>
                                    Disable modules you do not need. Disabled modules are hidden across the app.
                                </Text>
                                {moduleFields.map((field) => (
                                    <List.Item
                                        key={field.key}
                                        title={field.title}
                                        description={field.description}
                                        right={() => (
                                            <Switch
                                                value={moduleAccessDraft[field.key] !== false}
                                                onValueChange={(enabled) => {
                                                    setModuleAccessDraft((current) => ({
                                                        ...current,
                                                        [field.key]: enabled,
                                                    }));
                                                }}
                                            />
                                        )}
                                    />
                                ))}
                                <AppButton
                                    mode="contained"
                                    onPress={() => { void saveModuleAccess(); }}
                                    loading={savingModuleAccess}
                                    disabled={savingModuleAccess}
                                >
                                    Save Module Visibility
                                </AppButton>
                            </List.Section>
                        </AppCard>
                    )}

                    <AppCard animationDelay={64} style={sectionCardContainer}>
                        <List.Section style={styles.listSection}>
                            <List.Subheader>{SETTINGS_TEXT.sections.account}</List.Subheader>
                            <List.Item
                                title="Profile Setup"
                                description="Manage account details and link mobile number."
                                left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
                                onPress={() => router.push('/profile' as never)}
                            />
                            {(isOwnerOrAdmin || canManageSubscription) && (
                                <List.Item
                                    title={SETTINGS_TEXT.account.subscriptionTitle}
                                    description={subscriptionLabel}
                                    left={(props) => <List.Icon {...props} icon="credit-card-outline" />}
                                    onPress={() => router.push('/subscription' as never)}
                                />
                            )}
                            {canAccessAdminPanelEntry && (
                                <List.Item
                                    title={SETTINGS_TEXT.account.adminPanelTitle}
                                    description={SETTINGS_TEXT.account.adminPanelDescription}
                                    left={(props) => <List.Icon {...props} icon="shield-crown-outline" />}
                                    onPress={() => router.push('/admin' as never)}
                                />
                            )}
                            {canAccessAccounting && (
                                <List.Item
                                    title="Accounting Suite"
                                    description="Chart of accounts, journals, trial balance and GST."
                                    left={(props) => <List.Icon {...props} icon="book-open-variant" />}
                                    onPress={() => router.push('/accounting' as never)}
                                />
                            )}
                            {canAccessOperations && (
                                <List.Item
                                    title="Operations Controls"
                                    description="Approvals, audit logs and period lock workflow."
                                    left={(props) => <List.Icon {...props} icon="shield-check-outline" />}
                                    onPress={() => router.push('/operations' as never)}
                                />
                            )}
                            {canAccessBusinessSuite && (
                                <List.Item
                                    title="Business Suite"
                                    description="Payroll, GST compliance, treasury and enterprise snapshots."
                                    left={(props) => <List.Icon {...props} icon="briefcase-variant-outline" />}
                                    onPress={() => router.push('/business-suite' as never)}
                                />
                            )}
                            <List.Item
                                title={SETTINGS_TEXT.account.businessProfileTitle}
                                description={SETTINGS_TEXT.account.businessProfileDescription}
                                left={(props) => <List.Icon {...props} icon="store" />}
                                onPress={() => router.push('/business-setup' as never)}
                            />
                        </List.Section>
                    </AppCard>

                    <AppCard animationDelay={76} style={sectionCardContainer}>
                        <List.Section style={styles.listSection}>
                            <List.Subheader>{SETTINGS_TEXT.sections.dataSync}</List.Subheader>
                            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                {SETTINGS_TEXT.dataSync.title}
                            </Text>
                            <Text variant="bodySmall" style={{ marginTop: 8 }}>
                                {SETTINGS_TEXT.dataSync.statusLabel}: {pendingSyncCount}
                            </Text>
                            <Text variant="bodySmall" style={{ marginTop: 2 }}>
                                {SETTINGS_TEXT.dataSync.oldestLabel}: {formatTimestamp(oldestPendingAt)}
                            </Text>
                            <Text variant="bodySmall" style={{ marginTop: 2 }}>
                                {SETTINGS_TEXT.dataSync.lastSyncLabel}: {formatTimestamp(lastSyncAt)}
                            </Text>
                            <Text variant="bodySmall" style={{ marginTop: 2 }}>
                                Storage backend: {storageBackend}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6 }}>
                                {syncMessage}
                            </Text>
                            <AppButton
                                mode="outlined"
                                style={{ marginTop: 10 }}
                                loading={isSyncing}
                                disabled={isSyncing || isUiPending}
                                onPress={() => { void runManualSync(); }}
                            >
                                {SETTINGS_TEXT.dataSync.syncNowButton}
                            </AppButton>
                        </List.Section>
                    </AppCard>

                    <AppCard animationDelay={84} style={sectionCardContainer}>
                        <List.Section style={styles.listSection}>
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
                    </AppCard>

                    <AppCard animationDelay={95} style={sectionCardContainer}>
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
                            disabled={isApplyingUpdate || isUiPending}
                            onPress={() => { void checkForUpdates(); }}
                        >
                            {SETTINGS_TEXT.updateCard.checkButton}
                        </AppButton>

                        {updateState === 'downloaded' && (
                            <AppButton
                                mode="contained"
                                style={{ marginTop: 8 }}
                                loading={isApplyingUpdate}
                                disabled={isUiPending}
                                onPress={() => { void applyDownloadedUpdate(); }}
                            >
                                {SETTINGS_TEXT.updateCard.applyButton}
                            </AppButton>
                        )}
                    </AppCard>
                        </View>

                        <View style={styles.signOutWrap}>
                            <AppButton mode="outlined" onPress={signOut} icon="logout">
                                {SETTINGS_TEXT.actions.signOut}
                            </AppButton>
                        </View>
                    </View>
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.workspaceMaxWidth,
    },
    heroCard: {
        marginBottom: 8,
    },
    grid: {
        gap: 8,
    },
    gridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    sectionCard: {
        marginBottom: 0,
    },
    sectionCardWide: {
        width: '49%',
    },
    listSection: {
        marginVertical: 0,
    },
    signOutWrap: {
        marginTop: 8,
        marginBottom: 8,
    },
});
