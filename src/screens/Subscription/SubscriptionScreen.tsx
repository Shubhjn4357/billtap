
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Chip, ActivityIndicator } from 'react-native-paper';
// import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useUserStore } from '../../store';
import { subscriptionService } from '../../api/subscriptionService';
// import { Config } from '../../constants/Config';
import type { SubscriptionPlan } from '../../types';
// import axios from 'axios';

export const SubscriptionScreen = () => {
    const theme = useTheme();
    // const router = useRouter();
    const { user } = useUserStore();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        loadPlans();
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
                // In a real app, open this URL in a browser or webview
                // WebBrowser.openBrowserAsync(session.checkoutUrl);
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
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text variant="headlineSmall" style={{ marginBottom: 10 }}>Subscription Plans</Text>
                <Text style={{ marginBottom: 20, color: 'gray' }}>
                    Upgrade your business suite to unlock more potential.
                </Text>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} />
                ) : (
                    plans.map(plan => {
                        const isCurrent = currentPlanId === plan.id;
                        return (
                            <Card key={plan.id} style={{ marginBottom: 16, borderColor: isCurrent ? theme.colors.primary : 'transparent', borderWidth: isCurrent ? 2 : 0 }}>
                                <Card.Content>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text variant="titleLarge">{plan.name}</Text>
                                        {isCurrent && <Chip icon="check">Current</Chip>}
                                    </View>
                                    <Text variant="displaySmall" style={{ marginTop: 8, color: theme.colors.primary }}>
                                        {plan.monthlyPrice === 0 ? 'Free' : `₹${plan.monthlyPrice}/mo`}
                                    </Text>
                                    <Text style={{ marginTop: 4, marginBottom: 16 }}>{plan.description}</Text>

                                    {plan.features.map((feature, index) => (
                                        <Text key={index} style={{ marginBottom: 4 }}>• {feature}</Text>
                                    ))}
                                </Card.Content>
                                <Card.Actions>
                                    <Button
                                        mode={isCurrent ? "outlined" : "contained"}
                                        onPress={() => handleSubscribe(plan)}
                                        disabled={isCurrent || !!processing}
                                        loading={processing === plan.id}
                                        style={{ flex: 1 }}
                                    >
                                        {isCurrent ? 'Active' : `Upgrade to ${plan.name}`}
                                    </Button>
                                </Card.Actions>
                            </Card>
                        );
                    })
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};
