
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { analyticsService } from '../../api/analyticsService';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useOffers } from '../../hooks/useOffers';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';

export const DashboardScreen = () => {
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const router = useRouter();
    const { stats, loading, fetchBills } = useBills();
    const { primaryOffer, fetchOffers } = useOffers();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);

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
        }, [fetchBills, fetchOffers])
    );

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 80, paddingTop: 20 }}>
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 5 }}>
                    Hello, {user?.displayName || 'Merchant'}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 20 }}>
                    Overview
                </Text>

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
                                style={{ marginTop: 10, alignSelf: 'flex-start' }}
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
                    <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onTertiaryContainer }}>
                        Quick Actions
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer, marginBottom: 10 }}>
                        Jump to your most-used workflows.
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <AppButton
                            mode="contained"
                            compact
                            style={{ flex: 1, marginRight: 6 }}
                            onPress={() => router.push('/(tabs)/billing')}
                            icon="calculator"
                        >
                            New Bill
                        </AppButton>
                        <AppButton
                            mode="contained"
                            compact
                            style={{ flex: 1, marginHorizontal: 6 }}
                            onPress={() => router.push('/(tabs)/stock')}
                            icon="package-variant"
                        >
                            Stock
                        </AppButton>
                        <AppButton
                            mode="contained"
                            compact
                            style={{ flex: 1, marginLeft: 6 }}
                            onPress={() => router.push('/(tabs)/reports')}
                            icon="chart-line"
                        >
                            Reports
                        </AppButton>
                    </View>
                </AppCard>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppCard style={{ flex: 1, marginRight: 8, backgroundColor: theme.colors.primaryContainer }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>Today&apos;s Sales</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                            {loading ? '...' : formatCurrency(stats.todaySales, activeCurrency)}
                        </Text>
                    </AppCard>
                    <AppCard style={{ flex: 1, marginLeft: 8, backgroundColor: theme.colors.secondaryContainer }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>Today&apos;s Orders</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onSecondaryContainer }}>
                            {loading ? '...' : stats.todayOrders}
                        </Text>
                    </AppCard>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppCard style={{ flex: 1, marginRight: 8 }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>7-Day Sales</Text>
                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                            {loading ? '...' : formatCurrency(stats.weeklySales, activeCurrency)}
                        </Text>
                    </AppCard>
                    <AppCard style={{ flex: 1, marginLeft: 8 }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>Average Order</Text>
                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                            {loading ? '...' : formatCurrency(stats.averageOrderValue, activeCurrency)}
                        </Text>
                    </AppCard>
                </View>

                <AppCard>
                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>Lifetime Revenue</Text>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                        {loading ? '...' : formatCurrency(stats.totalRevenue, activeCurrency)}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                        {loading ? 'Loading...' : `${stats.totalOrders} total orders`}
                    </Text>
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
