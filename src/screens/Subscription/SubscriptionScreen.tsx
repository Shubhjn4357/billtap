import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
import { subscriptionService } from '../../api/subscriptionService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useUserStore } from '../../store';
import type { SubscriptionPlan } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const SubscriptionScreen = () => {
    const theme = useTheme();
    const { user } = useUserStore();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        void loadPlans();
    }, []);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const data = await subscriptionService.getPlans();
            setPlans(data.plans);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        setProcessing(plan.id);
        try {
            const session = await subscriptionService.createCheckoutSession(plan);
            if (session.checkoutUrl) {
                Alert.alert('Checkout', `Please complete payment at: ${session.checkoutUrl}`);
            }
        } catch {
            Alert.alert('Error', 'Failed to start subscription');
        } finally {
            setProcessing(null);
        }
    };

    const currentPlanId = user?.subscriptionPlanId || 'plan_free';

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <PageHeaderCard
                    title="Subscription Plans"
                    subtitle="Upgrade your business suite to unlock more potential."
                />

                {loading ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="large" />
                        <Text style={{ marginTop: 10, color: theme.colors.outline }}>Loading plans...</Text>
                    </View>
                ) : plans.length === 0 ? (
                    <AppCard style={{ alignItems: 'center', padding: 20 }}>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>Unable to load plans</Text>
                        <Text variant="bodySmall" style={{ textAlign: 'center', marginBottom: 16, color: theme.colors.outline }}>
                            This could be a network issue or no plans are currently available.
                        </Text>
                        <AppButton mode="contained" onPress={() => void loadPlans()}>
                            Retry
                        </AppButton>
                    </AppCard>
                ) : (
                    plans.map((plan) => {
                        const isCurrent = currentPlanId === plan.id;
                        return (
                            <AppCard
                                key={plan.id}
                                style={{
                                    borderColor: isCurrent ? theme.colors.primary : undefined,
                                    borderWidth: isCurrent ? 2 : undefined,
                                }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text variant="titleLarge">{plan.name}</Text>
                                    {isCurrent && <Chip icon="check">Current</Chip>}
                                </View>
                                <Text variant="displaySmall" style={{ marginTop: 8, color: theme.colors.primary }}>
                                    {plan.monthlyPrice === 0 ? 'Free' : `${formatCurrency(plan.monthlyPrice, 'INR')}/mo`}
                                </Text>
                                <Text style={{ marginTop: 4, marginBottom: 16, color: theme.colors.outline }}>
                                    {plan.description}
                                </Text>

                                {plan.features.map((feature, index) => (
                                    <Text key={`${plan.id}-${index}`} style={{ marginBottom: 4 }}>
                                        - {feature}
                                    </Text>
                                ))}

                                <AppButton
                                    mode={isCurrent ? 'outlined' : 'contained'}
                                    onPress={() => { void handleSubscribe(plan); }}
                                    disabled={isCurrent || !!processing}
                                    loading={processing === plan.id}
                                    style={{ marginTop: 12 }}
                                >
                                    {isCurrent ? 'Active Plan' : `Upgrade to ${plan.name}`}
                                </AppButton>
                            </AppCard>
                        );
                    })
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};
