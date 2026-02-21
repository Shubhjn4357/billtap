import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { List, Switch, Text, useTheme, Icon, Divider } from 'react-native-paper';
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
import {
    useOrganizationAccess,
    DEFAULT_APP_MODULE_ACCESS,
    type AppModuleAccessMap,
    type AppModuleKey,
} from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';

type UpdateState = 'idle' | 'checking' | 'downloading' | 'upToDate' | 'downloaded' | 'disabled' | 'error';
type SettingsTab = 'profile' | 'business';

export const SettingsScreen = () => {
    const { user, signOut } = useAuth();
    const {
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

    const initials = useMemo(() => {
        const source = user?.displayName?.trim() ?? user?.email ?? user?.phoneNumber ?? 'U';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [user?.displayName, user?.email, user?.phoneNumber]);

    const moduleFields = useMemo<{ key: AppModuleKey; title: string; description: string }[]>(() => ([
        { key: 'billingPurchase', title: 'Purchase Ledger', description: 'Inward entries and purchase invoices.' },
        { key: 'billingSale', title: 'Sales Ledger', description: 'Outward sales invoice creation.' },
        { key: 'parties', title: 'Party Ledger', description: 'Customer and supplier ledger.' },
        { key: 'payments', title: 'Payment Settlements', description: 'Payment in/out settlement flow.' },
        { key: 'expenses', title: 'Expense Tracking', description: 'Expense screens and quick actions.' },
        { key: 'accounting', title: 'Accounting Suite', description: 'Accounts, journals, and tax reports.' },
        { key: 'reports', title: 'Reports', description: 'Analytics and exports.' },
        { key: 'stock', title: 'Inventory', description: 'Stock and inventory management.' },
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
                dialog.alert(
                    SETTINGS_TEXT.errors.generic,
                    error instanceof Error ? error.message : SETTINGS_TEXT.errors.currencySaveFailed
                );
            }
        }
    };

    const checkForUpdates = useCallback(async () => {
        if (!canCheckUpdates) { setUpdateState('disabled'); return; }
        setUpdateState('checking');
        try {
            const update = await Updates.checkForUpdateAsync();
            if (!update.isAvailable) { setUpdateState('upToDate'); return; }
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
            setSyncMessage(stats.pendingCount > 0 ? `${stats.pendingCount} changes still pending.` : SETTINGS_TEXT.dataSync.idleMessage);
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
    useEffect(() => { void refreshQueueStats(); }, [refreshQueueStats]);
    useFocusRefresh(refreshQueueStats, { minIntervalMs: 8_000 });

    // Render — both tabs visible to ALL authenticated users.
    // Only module config section is gated to owner/admin.

    return (
        <ScreenWrapper>
            {/* ── Tab Selector ─────────────────────────────────────────── */}
            <View style={[styles.tabRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                {(['profile', 'business'] as SettingsTab[]).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <Pressable
                            key={tab}
                            style={styles.tabItem}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text
                                variant="labelLarge"
                                style={[
                                    styles.tabText,
                                    {
                                        color: isActive
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant,
                                        fontWeight: isActive ? '700' : '400',
                                    },
                                ]}
                            >
                                {tab === 'profile' ? 'Profile' : 'Business'}
                            </Text>
                            {isActive && (
                                <View
                                    style={[
                                        styles.activeTabLine,
                                        { backgroundColor: theme.colors.primary },
                                    ]}
                                />
                            )}
                        </Pressable>
                    );
                })}
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={isSyncing} onRefresh={runManualSync} />}
            >
                <View style={[styles.inner, isWide && { maxWidth: DesignSystem.layout.workspaceMaxWidth, alignSelf: 'center', width: '100%' }]}>

                    {/* ══ PROFILE TAB ══════════════════════════════════════ */}
                    {activeTab === 'profile' && (
                        <View style={styles.tabContent}>

                            {/* Avatar Hero */}
                            <AppCard style={styles.heroCard}>
                                <View style={styles.heroRow}>
                                    <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                                            {initials}
                                        </Text>
                                    </View>
                                    <View style={styles.heroInfo}>
                                        <Text variant="titleMedium" style={[styles.bold, { color: theme.colors.onSurface }]}>
                                            {user?.displayName ?? 'Your Name'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {user?.email ?? user?.phoneNumber ?? ''}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Role: {user?.role ?? 'Staff'}
                                        </Text>
                                        <AppButton
                                            mode="text"
                                            compact
                                            style={styles.editBtn}
                                            onPress={() => router.push('/profile' as never)}
                                        >
                                            Edit Profile
                                        </AppButton>
                                    </View>
                                </View>
                            </AppCard>

                            {/* Appearance */}
                            <AppCard>
                                <List.Section style={styles.noMargin}>
                                    <List.Subheader style={{ color: theme.colors.primary }}>
                                        {SETTINGS_TEXT.sections.appearance}
                                    </List.Subheader>
                                    <List.Item
                                        title={SETTINGS_TEXT.appearance.useSystemTheme}
                                        titleStyle={{ color: theme.colors.onSurface }}
                                        left={(props) => <List.Icon {...props} icon="theme-light-dark" color={theme.colors.onSurfaceVariant} />}
                                        right={() => (
                                            <Switch
                                                value={isSystemTheme}
                                                onValueChange={(val) =>
                                                    setThemeMode(val ? 'system' : effectiveDark ? 'dark' : 'light')
                                                }
                                                thumbColor={isSystemTheme ? theme.colors.primary : theme.colors.outline}
                                            />
                                        )}
                                    />
                                    <Divider />
                                    <List.Item
                                        title={SETTINGS_TEXT.appearance.darkMode}
                                        titleStyle={{ color: isSystemTheme ? theme.colors.onSurfaceVariant : theme.colors.onSurface }}
                                        disabled={isSystemTheme}
                                        left={(props) => <List.Icon {...props} icon="weather-night" color={theme.colors.onSurfaceVariant} />}
                                        right={() => (
                                            <Switch
                                                value={effectiveDark}
                                                disabled={isSystemTheme}
                                                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                                                thumbColor={effectiveDark ? theme.colors.primary : theme.colors.outline}
                                            />
                                        )}
                                    />
                                </List.Section>
                            </AppCard>

                            {/* Sound */}
                            <AppCard>
                                <List.Section style={styles.noMargin}>
                                    <List.Subheader style={{ color: theme.colors.primary }}>Notifications & Sound</List.Subheader>
                                    <List.Item
                                        title="Sound Effects"
                                        titleStyle={{ color: theme.colors.onSurface }}
                                        left={(props) => <List.Icon {...props} icon="volume-high" color={theme.colors.onSurfaceVariant} />}
                                        right={() => (
                                            <Switch
                                                value={notificationSoundEnabled}
                                                onValueChange={toggleNotificationSound}
                                                thumbColor={notificationSoundEnabled ? theme.colors.primary : theme.colors.outline}
                                            />
                                        )}
                                    />
                                </List.Section>
                            </AppCard>

                            {/* App Info */}
                            <AppCard>
                                <List.Section style={styles.noMargin}>
                                    <List.Subheader style={{ color: theme.colors.primary }}>
                                        {SETTINGS_TEXT.updateCard.title}
                                    </List.Subheader>
                                    <List.Item
                                        title="About Vahi"
                                        titleStyle={{ color: theme.colors.onSurface }}
                                        left={(props) => <List.Icon {...props} icon="information-outline" color={theme.colors.onSurfaceVariant} />}
                                        right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
                                        onPress={() => router.push('/about' as never)}
                                    />
                                    <Divider />
                                    <List.Item
                                        title="Check for Updates"
                                        description={`v${appVersion} (${buildVersion})`}
                                        titleStyle={{ color: theme.colors.onSurface }}
                                        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                        left={(props) => <List.Icon {...props} icon="cloud-download-outline" color={theme.colors.onSurfaceVariant} />}
                                        onPress={() => void checkForUpdates()}
                                    />
                                    {updateState === 'downloaded' && (
                                        <AppButton mode="contained" onPress={() => void applyDownloadedUpdate()} loading={isApplyingUpdate} style={styles.updateBtn}>
                                            {SETTINGS_TEXT.updateCard.applyButton}
                                        </AppButton>
                                    )}
                                </List.Section>
                            </AppCard>

                            {/* Sign Out */}
                            <AppButton
                                mode="outlined"
                                icon="logout"
                                onPress={signOut}
                                style={[styles.signOut, { borderColor: theme.colors.error }]}
                                textColor={theme.colors.error}
                            >
                                {SETTINGS_TEXT.actions.signOut}
                            </AppButton>
                        </View>
                    )}

                    {/* ══ BUSINESS TAB ═════════════════════════════════════ */}
                    {activeTab === 'business' && (
                        <View style={styles.tabContent}>

                            {/* Business Hero */}
                            <AppCard style={styles.heroCard}>
                                <View style={styles.heroRow}>
                                    <View style={[styles.avatar, { backgroundColor: theme.colors.tertiaryContainer }]}>
                                        <Icon source="domain" size={32} color={theme.colors.tertiary} />
                                    </View>
                                    <View style={styles.heroInfo}>
                                        <Text variant="titleMedium" style={[styles.bold, { color: theme.colors.onSurface }]}>
                                            {user?.businessName ?? 'My Business'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            GST: {user?.gstNumber ?? 'Not set'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {user?.address ?? 'Address not set'}
                                        </Text>
                                        <AppButton
                                            mode="text"
                                            compact
                                            style={styles.editBtn}
                                            onPress={() => router.push('/business-setup' as never)}
                                        >
                                            Edit Business Details
                                        </AppButton>
                                    </View>
                                </View>
                            </AppCard>

                            {/* Business Modules */}
                            <AppCard>
                                <List.Section style={styles.noMargin}>
                                    <List.Subheader style={{ color: theme.colors.primary }}>Modules & Features</List.Subheader>

                                    {(isOwnerOrAdmin || canManageSubscription) && (
                                        <List.Item
                                            title={SETTINGS_TEXT.account.subscriptionTitle}
                                            description={subscriptionLabel}
                                            titleStyle={{ color: theme.colors.onSurface }}
                                            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                            left={(props) => <List.Icon {...props} icon="credit-card-outline" color={theme.colors.onSurfaceVariant} />}
                                            right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
                                            onPress={() => router.push('/subscription' as never)}
                                        />
                                    )}
                                    {canAccessAccounting && <Divider />}
                                    {canAccessAccounting && (
                                        <List.Item
                                            title="Accounting"
                                            description="Accounts, journals, and tax reports"
                                            titleStyle={{ color: theme.colors.onSurface }}
                                            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                            left={(props) => <List.Icon {...props} icon="book-open-variant" color={theme.colors.onSurfaceVariant} />}
                                            right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
                                            onPress={() => router.push('/accounting' as never)}
                                        />
                                    )}
                                    {canAccessOperations && <Divider />}
                                    {canAccessOperations && (
                                        <List.Item
                                            title="Operations"
                                            description="Staff, audit, and approvals"
                                            titleStyle={{ color: theme.colors.onSurface }}
                                            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                            left={(props) => <List.Icon {...props} icon="shield-check-outline" color={theme.colors.onSurfaceVariant} />}
                                            right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
                                            onPress={() => router.push('/operations' as never)}
                                        />
                                    )}
                                    {canAccessBusinessSuite && <Divider />}
                                    {canAccessBusinessSuite && (
                                        <List.Item
                                            title="Enterprise Suite"
                                            description="Payroll, treasury, and compliance"
                                            titleStyle={{ color: theme.colors.onSurface }}
                                            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                            left={(props) => <List.Icon {...props} icon="briefcase-variant-outline" color={theme.colors.onSurfaceVariant} />}
                                            right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
                                            onPress={() => router.push('/business-suite' as never)}
                                        />
                                    )}
                                </List.Section>
                            </AppCard>

                            {/* Currency */}
                            <AppCard>
                                <List.Section style={styles.noMargin}>
                                    <List.Subheader style={{ color: theme.colors.primary }}>{SETTINGS_TEXT.sections.billingPreferences}</List.Subheader>
                                    <List.Accordion
                                        title={`${SETTINGS_TEXT.billing.currencyPrefix} ${activeCurrency}`}
                                        titleStyle={{ color: theme.colors.onSurface }}
                                        left={(props) => <List.Icon {...props} icon="cash-multiple" color={theme.colors.onSurfaceVariant} />}
                                    >
                                        {Config.supportedCurrencies.map((entry) => (
                                            <List.Item
                                                key={entry.code}
                                                title={`${entry.code} — ${entry.label}`}
                                                titleStyle={{ color: theme.colors.onSurface }}
                                                onPress={() => void handleCurrencyChange(entry.code)}
                                                right={(props) =>
                                                    entry.code === activeCurrency
                                                        ? <List.Icon {...props} icon="check" color={theme.colors.primary} />
                                                        : null
                                                }
                                            />
                                        ))}
                                    </List.Accordion>
                                </List.Section>
                            </AppCard>

                            {/* Sync Status */}
                            <AppCard>
                                <List.Section style={styles.noMargin}>
                                    <List.Subheader style={{ color: theme.colors.primary }}>
                                        {SETTINGS_TEXT.sections.dataSync}
                                    </List.Subheader>
                                    <List.Item
                                        title={SETTINGS_TEXT.dataSync.title}
                                        description={`${syncMessage} (${pendingSyncCount} pending)`}
                                        titleStyle={{ color: theme.colors.onSurface }}
                                        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                        left={(props) => <List.Icon {...props} icon="cloud-sync" color={theme.colors.onSurfaceVariant} />}
                                        right={() => (
                                            <AppButton mode="text" onPress={() => void runManualSync()} loading={isSyncing} disabled={isSyncing}>
                                                {SETTINGS_TEXT.dataSync.syncNowButton}
                                            </AppButton>
                                        )}
                                    />
                                </List.Section>
                            </AppCard>

                            {/* Module Configuration (Owner Only) */}
                            {isOwnerOrAdmin && (
                                <AppCard>
                                    <List.Section style={styles.noMargin}>
                                        <List.Subheader style={{ color: theme.colors.primary }}>Module Configuration</List.Subheader>
                                        {moduleFields.map((field, idx) => (
                                            <React.Fragment key={field.key}>
                                                {idx > 0 && <Divider />}
                                                <List.Item
                                                    title={field.title}
                                                    description={field.description}
                                                    titleStyle={{ color: theme.colors.onSurface }}
                                                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                                                    right={() => (
                                                        <Switch
                                                            value={moduleAccessDraft[field.key] !== false}
                                                            onValueChange={(val) =>
                                                                setModuleAccessDraft((curr) => ({ ...curr, [field.key]: val }))
                                                            }
                                                            thumbColor={moduleAccessDraft[field.key] !== false ? theme.colors.primary : theme.colors.outline}
                                                        />
                                                    )}
                                                />
                                            </React.Fragment>
                                        ))}
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
    tabRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: DesignSystem.spacing.sm,
        position: 'relative',
    },
    tabText: {
        letterSpacing: 0.2,
    },
    activeTabLine: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: 2,
        borderRadius: 1,
    },
    content: {
        paddingTop: DesignSystem.spacing.md,
    },
    inner: {
        paddingHorizontal: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.md,
    },
    tabContent: {
        gap: DesignSystem.spacing.md,
    },
    heroCard: {
        padding: 0,
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.md,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    heroInfo: {
        flex: 1,
        gap: 2,
    },
    bold: {
        fontWeight: '700',
    },
    editBtn: {
        alignSelf: 'flex-start',
        marginLeft: -8,
        marginTop: DesignSystem.spacing.xs,
    },
    noMargin: {
        marginVertical: 0,
        paddingVertical: 0,
    },
    signOut: {
        marginTop: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xl,
    },
    updateBtn: {
        margin: DesignSystem.spacing.md,
    },
    saveBtn: {
        margin: DesignSystem.spacing.md,
    },
});
