
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyticsService } from '../../api/analyticsService';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useOffers } from '../../hooks/useOffers';
import { useStock } from '../../hooks/useStock';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { isLowStock } from '../../utils/stockStatus';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';

export const DashboardScreen = () => {
    const { user } = useAuth();
    const {
        canViewDashboard,
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageInventory,
        canViewReports,
    } = useOrganizationAccess();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { stats, loading, fetchBills } = useBills(canViewReports);
    const { primaryOffer, fetchOffers } = useOffers();
    const { items, fetchItems } = useStock();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 24);

    const lowStockCount = React.useMemo(() => {
        return items.filter((item) => isLowStock(item)).length;
    }, [items]);

    React.useEffect(() => {
        if (!user || !primaryOffer) return;
        void analyticsService.logEvent({
            userId: user.uid,
            eventType: 'offer_impression',
            source: 'dashboard_banner',
            offerId: primaryOffer.id,
        });
    }, [primaryOffer, user]);

    useFocusEffect(
        React.useCallback(() => {
            if (!canViewDashboard) return;
            if (canViewReports) {
                void fetchBills();
            }
            void fetchOffers();
            if (canManageInventory) {
                void fetchItems();
            }
        }, [canManageInventory, canViewDashboard, canViewReports, fetchBills, fetchItems, fetchOffers])
    );

    const displayName = user?.displayName?.trim() || 'Merchant';
    const quickKpis = React.useMemo(
        () => [
            {
                key: 'sales',
                label: 'Today Sales',
                value: loading ? '...' : formatCurrency(stats.todaySales, activeCurrency),
                tone: 'primary' as const,
            },
            {
                key: 'orders',
                label: 'Today Orders',
                value: loading ? '...' : String(stats.todayOrders),
                tone: 'secondary' as const,
            },
            {
                key: 'stock',
                label: 'Low Stock',
                value: String(lowStockCount),
                tone: lowStockCount > 0 ? ('error' as const) : ('neutral' as const),
            },
        ],
        [activeCurrency, loading, lowStockCount, stats.todayOrders, stats.todaySales]
    );

    return (
        <ScreenWrapper>
            {!canViewDashboard ? (
                <AppCard animationDelay={40}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Dashboard access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Ask owner/admin to enable dashboard access for your account.
                    </Text>
                </AppCard>
            ) : (
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomSpacing }]}
                showsVerticalScrollIndicator={false}
            >
                <AppCard
                    animationDelay={40}
                    style={[
                        styles.heroCard,
                        { backgroundColor: theme.colors.primaryContainer },
                    ]}
                >
                    <Text
                        variant="headlineSmall"
                        style={[styles.heroTitle, { color: theme.colors.onPrimaryContainer }]}
                    >
                        Hello, {displayName}
                    </Text>
                    <Text
                        variant="bodyMedium"
                        style={[styles.heroSubtitle, { color: theme.colors.onPrimaryContainer }]}
                    >
                        Monitor sales, stock and growth in one command center.
                    </Text>
                    <View style={styles.heroKpiRow}>
                        {quickKpis.map((entry) => {
                            const palette = entry.tone === 'primary'
                                ? { bg: 'rgba(14,116,144,0.16)', fg: theme.colors.onPrimaryContainer }
                                : entry.tone === 'secondary'
                                    ? { bg: 'rgba(15,118,110,0.16)', fg: theme.colors.onPrimaryContainer }
                                    : entry.tone === 'error'
                                        ? { bg: 'rgba(185,28,28,0.18)', fg: theme.colors.onPrimaryContainer }
                                        : { bg: 'rgba(148,163,184,0.22)', fg: theme.colors.onPrimaryContainer };

                            return (
                                <View key={entry.key} style={[styles.heroKpiCard, { backgroundColor: palette.bg }]}>
                                    <Text variant="labelSmall" style={{ color: palette.fg }}>
                                        {entry.label}
                                    </Text>
                                    <Text variant="titleSmall" style={[styles.heroKpiValue, { color: palette.fg }]}>
                                        {entry.value}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </AppCard>

                {lowStockCount > 0 && (
                    <AppCard
                        animationDelay={70}
                        style={{
                            backgroundColor: theme.colors.errorContainer,
                            marginBottom: 12,
                            borderColor: theme.colors.error,
                            borderLeftWidth: 4
                        }}
                        onPress={() => router.push('/stock' as never)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.onErrorContainer }}>
                                    Low Stock Alert
                                </Text>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
                                    {lowStockCount} items are running low. Tap to restock.
                                </Text>
                            </View>
                            <Text variant="headlineMedium" style={{ color: theme.colors.onErrorContainer, fontWeight: '800' }}>
                                {lowStockCount}
                            </Text>
                        </View>
                    </AppCard>
                )}

                {primaryOffer && (
                    <AppCard
                        animationDelay={95}
                        style={{
                            backgroundColor: primaryOffer.bannerBackground || theme.colors.secondaryContainer,
                        }}
                    >
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            {primaryOffer.title}
                        </Text>
                        <Text variant="bodySmall" style={{ marginTop: 4 }}>
                            {primaryOffer.message}
                        </Text>
                        {primaryOffer.ctaText && (
                            <AppButton
                                mode="contained"
                                compact
                                style={styles.offerButton}
                                onPress={() => {
                                    if (user) {
                                        void analyticsService.logEvent({
                                            userId: user.uid,
                                            eventType: 'offer_click',
                                            source: 'dashboard_banner',
                                            offerId: primaryOffer.id,
                                        });
                                    }
                                    router.push((primaryOffer.ctaRoute || '/subscription') as never);
                                }}
                            >
                                {primaryOffer.ctaText}
                            </AppButton>
                        )}
                    </AppCard>
                )}

                {user?.subscriptionStatus !== 'active' && (
                    <AppCard animationDelay={120} style={{ borderWidth: 1, borderColor: theme.colors.primary }}>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            Unlock More Sales Tools
                        </Text>
                        <Text variant="bodySmall" style={{ marginTop: 4 }}>
                            Activate a monthly plan to access premium automation and growth features.
                        </Text>
                        <AppButton mode="contained" style={{ marginTop: 10 }} onPress={() => router.push('/subscription' as never)}>
                            View Subscription Plans
                        </AppButton>
                    </AppCard>
                )}

                <AppCard animationDelay={145} style={{ backgroundColor: theme.colors.tertiaryContainer }}>
                    <Text
                        variant="titleMedium"
                        style={{ fontWeight: '700', color: theme.colors.onTertiaryContainer }}
                    >
                        Launch Pad
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onTertiaryContainer, marginBottom: 10 }}
                    >
                        Fast entry points for your daily operations.
                    </Text>
                    <View style={styles.quickActionRow}>
                        {(canOpenBilling && (canCreateSale || canCreatePurchase)) && (
                            <AppButton
                                mode="contained"
                                compact
                                style={styles.quickActionHalf}
                                onPress={() => router.push('/(main)/(tabs)/billing')}
                                icon="calculator"
                            >
                                Billing
                            </AppButton>
                        )}
                        {canManageInventory && (
                            <AppButton
                                mode="contained"
                                compact
                                style={[styles.quickActionHalf, styles.quickActionHalfSpacer]}
                                onPress={() => router.push('/(main)/(tabs)/stock')}
                                icon="package-variant"
                            >
                                Inventory
                            </AppButton>
                        )}
                    </View>
                    {canViewReports && (
                        <AppButton
                            mode="contained"
                            compact
                            style={styles.quickActionFull}
                            onPress={() => router.push('/(main)/(tabs)/reports')}
                            icon="chart-line"
                        >
                            Analytics
                        </AppButton>
                    )}
                </AppCard>

                <View style={styles.metricRow}>
                    <AppCard
                        animationDelay={170}
                        style={[
                            styles.metricCard,
                            styles.metricCardLeft,
                            { backgroundColor: theme.colors.primaryContainer },
                        ]}
                    >
                        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                            Today&apos;s Sales
                        </Text>
                        <Text
                            variant="headlineSmall"
                            style={[styles.metricValue, { color: theme.colors.onPrimaryContainer }]}
                        >
                            {loading ? '...' : formatCurrency(stats.todaySales, activeCurrency)}
                        </Text>
                    </AppCard>
                    <AppCard
                        animationDelay={195}
                        style={[
                            styles.metricCard,
                            { backgroundColor: theme.colors.secondaryContainer },
                        ]}
                    >
                        <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                            Today&apos;s Orders
                        </Text>
                        <Text
                            variant="headlineSmall"
                            style={[styles.metricValue, { color: theme.colors.onSecondaryContainer }]}
                        >
                            {loading ? '...' : stats.todayOrders}
                        </Text>
                    </AppCard>
                </View>

                <View style={styles.metricRow}>
                    <AppCard animationDelay={220} style={[styles.metricCard, styles.metricCardLeft]}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                            7-Day Sales
                        </Text>
                        <Text variant="titleLarge" style={styles.metricValue}>
                            {loading ? '...' : formatCurrency(stats.weeklySales, activeCurrency)}
                        </Text>
                    </AppCard>
                    <AppCard animationDelay={245} style={styles.metricCard}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                            Average Order
                        </Text>
                        <Text variant="titleLarge" style={styles.metricValue}>
                            {loading ? '...' : formatCurrency(stats.averageOrderValue, activeCurrency)}
                        </Text>
                    </AppCard>
                </View>

                <AppCard animationDelay={270}>
                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                        Lifetime Revenue
                    </Text>
                    <Text variant="headlineSmall" style={styles.metricValue}>
                        {loading ? '...' : formatCurrency(stats.totalRevenue, activeCurrency)}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                        {loading ? 'Updating...' : `${stats.totalOrders} total orders`}
                    </Text>
                </AppCard>
            </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingTop: 18,
    },
    heroCard: {
        marginBottom: 12,
    },
    heroTitle: {
        fontWeight: '800',
    },
    heroSubtitle: {
        marginTop: 6,
        opacity: 0.92,
    },
    heroKpiRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    heroKpiCard: {
        flex: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    heroKpiValue: {
        marginTop: 4,
        fontWeight: '700',
    },
    offerButton: {
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    quickActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quickActionHalf: {
        flex: 1,
    },
    quickActionHalfSpacer: {
        marginLeft: 8,
    },
    quickActionFull: {
        marginTop: 8,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricCard: {
        flex: 1,
    },
    metricCardLeft: {
        marginRight: 8,
    },
    metricValue: {
        fontWeight: 'bold',
    },
});

