
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

export const DashboardScreen = () => {
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { stats, loading, fetchBills } = useBills();
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
            void fetchBills();
            void fetchOffers();
            void fetchItems();
        }, [fetchBills, fetchOffers, fetchItems])
    );

    const displayName = user?.displayName?.trim() || 'Merchant';

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomSpacing }]}
                showsVerticalScrollIndicator={false}
            >
                <AppCard
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
                        Here is your live business snapshot.
                    </Text>
                </AppCard>

                {lowStockCount > 0 && (
                    <AppCard
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
                    <AppCard style={{ borderWidth: 1, borderColor: theme.colors.primary }}>
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

                <AppCard style={{ backgroundColor: theme.colors.tertiaryContainer }}>
                    <Text
                        variant="titleMedium"
                        style={{ fontWeight: '700', color: theme.colors.onTertiaryContainer }}
                    >
                        Quick Actions
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onTertiaryContainer, marginBottom: 10 }}
                    >
                        Jump to your most-used workflows.
                    </Text>
                    <View style={styles.quickActionRow}>
                        <AppButton
                            mode="contained"
                            compact
                            style={styles.quickActionHalf}
                            onPress={() => router.push('/(main)/(tabs)/billing')}
                            icon="calculator"
                        >
                            New Bill
                        </AppButton>
                        <AppButton
                            mode="contained"
                            compact
                            style={[styles.quickActionHalf, styles.quickActionHalfSpacer]}
                            onPress={() => router.push('/(main)/(tabs)/stock')}
                            icon="package-variant"
                        >
                            Stock
                        </AppButton>
                    </View>
                    <AppButton
                        mode="contained"
                        compact
                        style={styles.quickActionFull}
                        onPress={() => router.push('/(main)/(tabs)/reports')}
                        icon="chart-line"
                    >
                        Reports
                    </AppButton>
                </AppCard>

                <View style={styles.metricRow}>
                    <AppCard
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
                    <AppCard style={[styles.metricCard, styles.metricCardLeft]}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                            7-Day Sales
                        </Text>
                        <Text variant="titleLarge" style={styles.metricValue}>
                            {loading ? '...' : formatCurrency(stats.weeklySales, activeCurrency)}
                        </Text>
                    </AppCard>
                    <AppCard style={styles.metricCard}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                            Average Order
                        </Text>
                        <Text variant="titleLarge" style={styles.metricValue}>
                            {loading ? '...' : formatCurrency(stats.averageOrderValue, activeCurrency)}
                        </Text>
                    </AppCard>
                </View>

                <AppCard>
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

