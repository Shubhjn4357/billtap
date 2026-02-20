import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../../api/subscriptionService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { useUserStore } from '../../store';
import type { SubscriptionPlan } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { useRazorpay } from '@codearcade/expo-razorpay';

export const SubscriptionScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 980;
    const { user } = useUserStore();
    const dialog = useAppDialog();
    const [processing, setProcessing] = useState<string | null>(null);
    const { openCheckout, RazorpayUI } = useRazorpay();

    const plansQuery = useQuery({
        queryKey: ['subscription-plans'] as const,
        queryFn: async (): Promise<SubscriptionPlan[]> => {
            const data = await subscriptionService.getPlans();
            return data.plans;
        },
        staleTime: 60_000,
    });

    const plans = plansQuery.data ?? [];
    const loading = plansQuery.isFetching && !plansQuery.data;
    const queryError = useMemo(() => {
        if (!plansQuery.error || isNetworkLikeError(plansQuery.error)) {
            return null;
        }
        return plansQuery.error instanceof Error ? plansQuery.error.message : 'Unable to load subscription plans.';
    }, [plansQuery.error]);

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        setProcessing(plan.id);
        try {
            const session = await subscriptionService.createCheckoutSession(plan);

            if (session.provider === 'razorpay' && session.providerOrderId && session.razorpayKeyId) {
                const options = {
                    description: `Subscription to ${plan.name}`,
                    image: 'https://vahi.test/logo.png', // Optional logo
                    currency: plan.currency,
                    key: session.razorpayKeyId,
                    amount: Math.round(plan.monthlyPrice * 100),
                    name: 'Vahi App',
                    order_id: session.providerOrderId,
                    prefill: {
                        email: user?.email || '',
                        contact: user?.phoneNumber || '',
                        name: user?.displayName || user?.businessName || '',
                    },
                    theme: { color: theme.colors.primary }
                };

                openCheckout(options, {
                    onSuccess: (data) => {
                        console.log('Razorpay Success:', data);
                        dialog.alert('Payment Successful', 'Your subscription has been activated successfully! Please refresh to see changes.');
                        void plansQuery.refetch();
                        setProcessing(null);
                    },
                    onFailure: (razorpayError) => {
                        console.error('Razorpay Error:', razorpayError);
                        dialog.alert('Payment Failed', razorpayError?.description || 'Payment was cancelled or failed.');
                        setProcessing(null);
                    },
                    onClose: () => {
                        setProcessing(null);
                    }
                });
            } else {
                // Mock Flow
                dialog.alert('Mock Payment', 'This is a mock payment flow. Subscription would be activated here.');
                setProcessing(null);
            }
        } catch (error: any) {
            dialog.alert('Error', error.message || 'Failed to start payment.');
            setProcessing(null);
        }
    };

    const currentPlanId = user?.subscriptionPlanId || 'plan_free';

    if (loading) {
        return <LoadingScreen message="Loading plans..." />;
    }

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={plansQuery.isFetching} onRefresh={() => { void plansQuery.refetch(); }} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Subscription Plans"
                        subtitle="Upgrade your business suite to unlock more potential."
                    />

                    {plans.length === 0 ? (
                        <AppCard style={styles.emptyCard}>
                            <Text variant="titleMedium" style={styles.emptyTitle}>Unable to load plans</Text>
                            <Text variant="bodySmall" style={[styles.emptyBody, { color: theme.colors.outline }]}>
                                {queryError ?? 'This could be a network issue or no plans are currently available.'}
                            </Text>
                            <AppButton mode="contained" onPress={() => { void plansQuery.refetch(); }}>
                                Retry
                            </AppButton>
                        </AppCard>
                    ) : (
                        plans.map((plan) => {
                            const isCurrent = currentPlanId === plan.id;
                            return (
                                <AppCard
                                    key={plan.id}
                                    style={[
                                        isCurrent && {
                                            borderColor: theme.colors.primary,
                                            borderWidth: 2,
                                        },
                                    ]}
                                >
                                    <View style={styles.headerRow}>
                                        <Text variant="titleLarge">{plan.name}</Text>
                                        {isCurrent && <Chip icon="check">Current</Chip>}
                                    </View>
                                    <Text variant="displaySmall" style={[styles.priceText, { color: theme.colors.primary }]}>
                                        {plan.monthlyPrice === 0 ? 'Free' : `${formatCurrency(plan.monthlyPrice, 'INR')}/mo`}
                                    </Text>
                                    <Text style={[styles.descriptionText, { color: theme.colors.outline }]}>
                                        {plan.description}
                                    </Text>

                                    {plan.features.map((feature, index) => (
                                        <Text key={`${plan.id}-${index}`} style={styles.featureLine}>
                                            - {feature}
                                        </Text>
                                    ))}

                                    <AppButton
                                        mode={isCurrent ? 'outlined' : 'contained'}
                                        onPress={() => { void handleSubscribe(plan); }}
                                        disabled={isCurrent || !!processing}
                                        loading={processing === plan.id}
                                        style={styles.ctaButton}
                                    >
                                        {isCurrent ? 'Active Plan' : `Upgrade to ${plan.name}`}
                                    </AppButton>
                                </AppCard>
                            );
                        })
                    )}
                </View>
            </ScrollView>
            {RazorpayUI}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    emptyCard: {
        alignItems: 'center',
        padding: DesignSystem.spacing.lg + 2,
    },
    emptyTitle: {
        marginBottom: DesignSystem.spacing.xs,
    },
    emptyBody: {
        textAlign: 'center',
        marginBottom: DesignSystem.spacing.md + 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceText: {
        marginTop: DesignSystem.spacing.xs,
    },
    descriptionText: {
        marginTop: DesignSystem.spacing.xxs,
        marginBottom: DesignSystem.spacing.md + 2,
    },
    featureLine: {
        marginBottom: DesignSystem.spacing.xxs,
    },
    ctaButton: {
        marginTop: DesignSystem.spacing.sm + 2,
    },
});
