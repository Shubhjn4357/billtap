import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { List, Switch, Text, useTheme, SegmentedButtons, Icon, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { businessSuiteService } from '../../api/businessSuiteService';
import { syncService } from '../../services/syncService';
import { userService } from '../../api/userService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { SETTINGS_TEXT } from '../../constants/staticText';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationStore, useSettingsStore, useUserStore } from '../../store';
import { useOrganizationAccess, DEFAULT_APP_MODULE_ACCESS, type AppModuleAccessMap, type AppModuleKey } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';

type UpdateState = 'idle' | 'checking' | 'downloading' | 'upToDate' | 'downloaded' | 'disabled' | 'error';
type SettingsTab = 'profile' | 'business';








export const SettingsScreen = () => {
    const { user, signOut } = useAuth();
    const {
        canAccessSettings,
        canManageSubscription,
        canAccessAccounting,
        canAccessOperations,
        canAccessBusinessSuite,
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
    const [, startUiTransition] = useTransition();
    const {
        autoTheme,
        themeMode,
        setThemeMode,
        currencySymbol,
        setCurrency,
        notificationSoundEnabled,
        toggleNotificationSound,
    } = useSettingsStore();

    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [updateState, setUpdateState] = useState<UpdateState>('idle');
    const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    const [storageBackend, setStorageBackend] = useState<'sqlite-drizzle' | 'async-storage' | 'SQLite'>('async-storage');
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
    const canCheckUpdates = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 24);
    const isWide = width >= 960;



    const moduleFields = useMemo<{ key: AppModuleKey; title: string; description: string }[]>(() => ([
        { key: 'billingPurchase', title: 'Purchase Ledger', description: 'Disable purchase entry and inward ledger.' },
        { key: 'billingSale', title: 'Sales Ledger', description: 'Disable sales invoice creation.' },
        { key: 'parties', title: 'Party Ledger', description: 'Hide customer/supplier ledger.' },
        { key: 'payments', title: 'Payment Settlements', description: 'Hide payment in/out settlement pages.' },
        { key: 'expenses', title: 'Expense Tracking', description: 'Hide expense screens and actions.' },
        { key: 'accounting', title: 'Accounting Suite', description: 'Hide accounting pages from app.' },
        { key: 'reports', title: 'Reports', description: 'Hide analytics and exports.' },
        { key: 'stock', title: 'Inventory', description: 'Hide stock/inventory module.' },
    ]), []);

    const handleCurrencyChange = async (currency: string) => {
        const normalized = normalizeCurrencyCode(currency);
        const previousCurrency = activeCurrency;
        startUiTransition(() => {
            setCurrency(normalized);
            if (user) setUser({ ...user, currency: normalized });
        });

        if (!user) return;
        try {
            const updatedUser = await userService.updateCurrentUser({ currency: normalized });
            setUser(updatedUser);
        } catch (error: unknown) {
            startUiTransition(() => {
                setCurrency(previousCurrency);
                if (user) setUser({ ...user, currency: previousCurrency });
            });
            if (!isNetworkLikeError(error)) {
                dialog.alert(SETTINGS_TEXT.errors.generic, error instanceof Error ? error.message : SETTINGS_TEXT.errors.currencySaveFailed);
            }
        }
    };

    const checkForUpdates = useCallback(async () => {

        if (!canCheckUpdates) {
            setUpdateState('disabled');

            return;
        }

        setUpdateState('checking');


        try {
            const update = await Updates.checkForUpdateAsync();
            if (!update.isAvailable) {
                setUpdateState('upToDate');

                return;
            }

            setUpdateState('downloading');

            await Updates.fetchUpdateAsync();

            setUpdateState('downloaded');

        } catch {
            setUpdateState('error');
        }
    }, [canCheckUpdates]);

    const applyDownloadedUpdate = async () => {
        if (updateState !== 'downloaded') return;
        setIsApplyingUpdate(true);
        try {
            await Updates.reloadAsync();
        } catch (error: unknown) {
            dialog.alert(SETTINGS_TEXT.errors.updateError, error instanceof Error ? error.message : SETTINGS_TEXT.updateMessages.applyFailed);
        } finally {
            setIsApplyingUpdate(false);
        }
    };

    const refreshQueueStats = useCallback(async () => {
        try {
            const stats = await syncService.getQueueStats();
            setPendingSyncCount(stats.pendingCount);

            setSyncMessage(stats.pendingCount > 0 ? SETTINGS_TEXT.dataSync.queuedMessage : SETTINGS_TEXT.dataSync.idleMessage);
        } catch { }
    }, []);

    const runManualSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncMessage(SETTINGS_TEXT.dataSync.syncingMessage);
        try {
            await syncService.flushQueue();
            const stats = await syncService.getQueueStats();

            setSyncMessage(stats.pendingCount > 0 ? `Synced recent items. ${stats.pendingCount} pending.` : SETTINGS_TEXT.dataSync.idleMessage);
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
            dialog.alert('Module Visibility', error instanceof Error ? error.message : 'Failed to save module visibility.');
        } finally {
            setSavingModuleAccess(false);
        }
    }, [dialog, isOwnerOrAdmin, moduleAccessDraft, selectedOrganizationId, setOrganizationSettings]);

    useEffect(() => { void checkForUpdates(); }, [checkForUpdates]);
    useEffect(() => { setModuleAccessDraft((current) => ({ ...current, ...appModuleAccess })); }, [appModuleAccess]);
    useEffect(() => {
        void refreshQueueStats();
        setStorageBackend('SQLite');
    }, [refreshQueueStats]);

    useFocusRefresh(refreshQueueStats, { enabled: canAccessSettings, minIntervalMs: 8_000 });

    if (!canAccessSettings) {
        return (
            <ScreenWrapper>
                <View style={styles.centerContainer}>
                    <Text variant="titleMedium" style={styles.titleBold}>Access Restricted</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
                        You do not have permission to view settings.
                    </Text>
                    <AppButton mode="outlined" onPress={signOut} style={styles.marginTop}>
                        {SETTINGS_TEXT.actions.signOut}
                    </AppButton>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.headerTitle}>Settings</Text>
                <SegmentedButtons
                    value={activeTab}
                    onValueChange={(val) => setActiveTab(val as SettingsTab)}
                    buttons={[
                        { value: 'profile', label: 'Profile', icon: 'account' },
                        { value: 'business', label: 'Business', icon: 'domain' },
                    ]}
                    style={styles.tabs}
                />
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={isSyncing} onRefresh={runManualSync} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>

                    {activeTab === 'profile' && (
                        <View style={styles.tabContent}>
                            {/* Profile Hero */}
                            <AppCard style={styles.heroCard}>
                                <View style={styles.profileRow}>
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
                                            {user?.displayName?.[0] || 'U'}
                                        </Text>
                                    </View>
                                    <View style={styles.profileInfo}>
                                        <Text variant="titleMedium" style={styles.titleBold}>{user?.displayName || 'User'}</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{user?.email || user?.phoneNumber}</Text>
                                        <AppButton
                                            mode="text"
                                            compact
                                            style={styles.editProfileBtn}
                                            onPress={() => router.push('/profile' as never)}
                                        >
                                            Edit Profile
                                        </AppButton>
                                    </View>
                                </View>
                            </AppCard>

                            {/* Appearance */}
                            <AppCard>
                                <List.Section style={styles.sectionNoMargin}>
                                    <List.Subheader>Appearance</List.Subheader>
                                    <List.Item
                                        title={SETTINGS_TEXT.appearance.useSystemTheme}
                                        right={() => (
                                            <Switch
                                                value={isSystemTheme}
                                                onValueChange={(val) => setThemeMode(val ? 'system' : (effectiveDark ? 'dark' : 'light'))}
                                            />
                                        )}
                                        left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                                    />
                                    <List.Item
                                        title={SETTINGS_TEXT.appearance.darkMode}
                                        disabled={isSystemTheme}
                                        right={() => (
                                            <Switch
                                                value={effectiveDark}
                                                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                                            />
                                        )}
                                        left={(props) => <List.Icon {...props} icon="weather-night" />}
                                    />
                                </List.Section>
                            </AppCard>

                            {/* About / Info */}
                            <AppCard>
                                <List.Section style={styles.sectionNoMargin}>
                                    <List.Subheader>Application</List.Subheader>
                                    <List.Item
                                        title="About Vahi"
                                        left={(props) => <List.Icon {...props} icon="information-outline" />}
                                        onPress={() => router.push('/about' as never)}
                                    />
                                    <List.Item
                                        title="Update Check"
                                        description={`${appVersion} (${buildVersion})`}
                                        left={(props) => <List.Icon {...props} icon="cloud-download-outline" />}
                                        onPress={() => void checkForUpdates()}
                                    />
                                    {updateState === 'downloaded' && (
                                        <AppButton mode="contained" onPress={() => void applyDownloadedUpdate()} loading={isApplyingUpdate}>
                                            Restart & Update
                                        </AppButton>
                                    )}
                                </List.Section>
                            </AppCard>

                            <AppButton mode="outlined" icon="logout" onPress={signOut} style={[styles.signOutButton, { borderColor: theme.colors.error }]} textColor={theme.colors.error}>
                                Sign Out
                            </AppButton>
                        </View>
                    )}

                    {activeTab === 'business' && (
                        <View style={styles.tabContent}>
                            {/* Business Hero */}
                            <AppCard style={styles.heroCard}>
                                <View style={styles.profileRow}>
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.tertiaryContainer }]}>
                                        <Icon source="domain" size={32} color={theme.colors.tertiary} />
                                    </View>
                                    <View style={styles.profileInfo}>
                                        <Text variant="titleMedium" style={styles.titleBold}>{user?.businessName || 'My Business'}</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Role: {user?.role || 'Staff'}</Text>
                                        <AppButton 
                                            mode="text"
                                            compact
                                            style={styles.editProfileBtn}
                                            onPress={() => router.push('/business-setup' as never)}
                                        >
                                            Business Details
                                        </AppButton>
                                    </View>
                                </View>
                            </AppCard>

                            {/* Modules & Feature Links */}
                            <AppCard>
                                <List.Section style={styles.sectionNoMargin}>
                                    <List.Subheader>Business Modules</List.Subheader>

                                    {(isOwnerOrAdmin || canManageSubscription) && (
                                        <List.Item
                                            title="Subscription Plan"
                                            description={subscriptionLabel}
                                            left={(props) => <List.Icon {...props} icon="credit-card-outline" />}
                                            onPress={() => router.push('/subscription' as never)}
                                        />
                                    )}

                                    {canAccessAccounting && (
                                        <List.Item
                                            title="Accounting"
                                            description="Chart of accounts, Journals, Tax"
                                            left={(props) => <List.Icon {...props} icon="book-open-variant" />}
                                            onPress={() => router.push('/accounting' as never)}
                                        />
                                    )}

                                    {canAccessOperations && (
                                        <List.Item
                                            title="Operations"
                                            description="Staff, Audit, Approvals"
                                            left={(props) => <List.Icon {...props} icon="shield-check-outline" />}
                                            onPress={() => router.push('/operations' as never)}
                                        />
                                    )}

                                    {canAccessBusinessSuite && (
                                        <List.Item
                                            title="Enterprise Suite"
                                            description="Payroll, Treasury, Compliance"
                                            left={(props) => <List.Icon {...props} icon="briefcase-variant-outline" />}
                                            onPress={() => router.push('/business-suite' as never)}
                                        />
                                    )}
                                </List.Section>
                            </AppCard>

                            {/* Preferences */}
                            <AppCard>
                                <List.Section style={styles.sectionNoMargin}>
                                    <List.Subheader>Preferences</List.Subheader>
                                    <List.Accordion
                                        title={`Currency: ${activeCurrency}`}
                                        left={(props) => <List.Icon {...props} icon="cash-multiple" />}
                                    >
                                        {Config.supportedCurrencies.map((entry) => (
                                            <List.Item
                                                key={entry.code}
                                                title={`${entry.code} - ${entry.label}`}
                                                onPress={() => void handleCurrencyChange(entry.code)}
                                                right={(props) => entry.code === activeCurrency ? <List.Icon {...props} icon="check" /> : null}
                                            />
                                        ))}
                                    </List.Accordion>
                                    <List.Item
                                        title="Sound Effects"
                                        right={() => <Switch value={notificationSoundEnabled} onValueChange={toggleNotificationSound} />}
                                        left={(props) => <List.Icon {...props} icon="volume-high" />}
                                    />
                                </List.Section>
                            </AppCard>

                            {/* Data Sync */}
                            <AppCard>
                                <List.Section style={styles.sectionNoMargin}>
                                    <List.Subheader>Data & Sync</List.Subheader>
                                    <List.Item
                                        title="Sync Status"
                                        description={`${syncMessage} (Pending: ${pendingSyncCount})`}
                                        left={(props) => <List.Icon {...props} icon="cloud-sync" />}
                                        right={() => (
                                            <Button mode="text" onPress={() => void runManualSync()} loading={isSyncing} disabled={isSyncing}>
                                                Sync Now
                                            </Button>
                                        )}
                                    />
                                    <List.Item
                                        title="Storage"
                                        description={`Backend: ${storageBackend}`}
                                        left={(props) => <List.Icon {...props} icon="database" />}
                                    />
                                </List.Section>
                            </AppCard>

                            {/* Module Visibility (Owner Only) */}
                            {isOwnerOrAdmin && (
                                <AppCard>
                                    <List.Section style={styles.sectionNoMargin}>
                                        <List.Subheader>Module Configuration</List.Subheader>
                                        <View style={styles.moduleList}>
                                            {moduleFields.map((field) => (
                                                <List.Item
                                                    key={field.key}
                                                    title={field.title}
                                                    description={field.description}
                                                    right={() => (
                                                        <Switch
                                                            value={moduleAccessDraft[field.key] !== false}
                                                            onValueChange={(val) => setModuleAccessDraft(curr => ({ ...curr, [field.key]: val }))}
                                                        />
                                                    )}
                                                />
                                            ))}
                                        </View>
                                        <AppButton
                                            mode="contained" 
                                            onPress={() => void saveModuleAccess()}
                                            loading={savingModuleAccess}
                                            style={styles.saveBtn}
                                        >
                                            Save Configuration
                                        </AppButton>
                                    </List.Section>
                                </AppCard>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: DesignSystem.spacing.xl,
        paddingTop: DesignSystem.spacing.lg,
        gap: DesignSystem.spacing.md,
    },
    headerTitle: {
        fontWeight: 'bold',
    },
    tabs: {
        marginBottom: DesignSystem.spacing.sm,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: DesignSystem.spacing.xl,
    },
    content: {
        paddingTop: DesignSystem.spacing.md,
    },
    contentInner: {
        width: '100%',
        paddingHorizontal: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.md,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.workspaceMaxWidth,
        alignSelf: 'center',
    },
    tabContent: {
        gap: DesignSystem.spacing.md,
    },
    heroCard: {
        padding: 0,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.md,
    },
    avatarPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfo: {
        flex: 1,
    },
    editProfileBtn: {
        alignSelf: 'flex-start',
        marginLeft: -8,
    },
    titleBold: {
        fontWeight: 'bold',
    },
    sectionNoMargin: {
        marginVertical: 0,
        paddingVertical: 0,
    },
    signOutButton: {
        marginTop: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xl,
    },
    moduleList: {
        marginBottom: DesignSystem.spacing.md,
    },
    saveBtn: {
        marginTop: DesignSystem.spacing.sm,
    },
    marginTop: {
        marginTop: DesignSystem.spacing.lg,
    },
});
