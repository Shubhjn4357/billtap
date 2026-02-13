import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { analyticsService } from '../../api/analyticsService';
import { adminService } from '../../api/adminService';
import { Chip, Text, useTheme } from 'react-native-paper';
import { auth, db } from '../../api/firebaseConfig';
import { paymentService } from '../../api/paymentService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { COMMON_TEXT, SUBSCRIPTION_TEXT } from '../../constants/staticText';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans';
import { useAuth } from '../../hooks/useAuth';
import { useUserStore } from '../../store';
import type { SubscriptionPlan, SubscriptionStatus, UserProfile } from '../../types';
import { addMonths, toDateSafe } from '../../utils/date';
import { formatCurrency, formatDate } from '../../utils/formatters';

type PaymentResult = {
    status: 'success' | 'failed';
    message: string;
};

const statusTone = (status: SubscriptionStatus | undefined) => {
    if (status === 'active') return 'green';
    if (status === 'expired' || status === 'canceled') return 'red';
    return 'gray';
};

const buildNextMonthEnd = (startDate: Date) => addMonths(startDate, 1);

export const SubscriptionScreen = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const { setUser } = useUserStore();
    const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
    const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_SUBSCRIPTION_PLANS[1]?.id ?? DEFAULT_SUBSCRIPTION_PLANS[0].id);
    const [loading, setLoading] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
    const isLivePaymentConfigured = Boolean(process.env.EXPO_PUBLIC_PAYMENT_API_BASE_URL?.trim());

    useEffect(() => {
        const fetchPlans = async () => {
            setLoadingPlans(true);
            try {
                const fetchedPlans = await adminService.getPlans(false);
                if (fetchedPlans.length > 0) {
                    setPlans(fetchedPlans);
                    setSelectedPlanId((current) =>
                        fetchedPlans.some((plan) => plan.id === current)
                            ? current
                            : fetchedPlans[0].id
                    );
                }
            } catch {
                // Keep fallback plans from constants.
            } finally {
                setLoadingPlans(false);
            }
        };

        void fetchPlans();
    }, []);

    useEffect(() => {
        if (!user) return;
        void analyticsService.logEvent({
            userId: user.uid,
            eventType: 'subscription_screen_view',
            source: 'subscription_screen',
        });
    }, [user]);

    const selectedPlan = useMemo(
        () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? DEFAULT_SUBSCRIPTION_PLANS[0],
        [plans, selectedPlanId]
    );

    const handleTestPaymentSuccess = async () => {
        if (!user) {
            Alert.alert(COMMON_TEXT.alerts.loginRequired, SUBSCRIPTION_TEXT.loginToActivate);
            return;
        }

        const uid = auth.currentUser?.uid ?? user.uid;
        const startsAt = new Date();
        const endsAt = buildNextMonthEnd(startsAt);

        const payload: Partial<UserProfile> = {
            subscriptionStatus: 'active',
            subscriptionPlanId: selectedPlan.id,
            subscriptionPlanName: selectedPlan.name,
            subscriptionAmountMonthly: selectedPlan.monthlyPrice,
            subscriptionCurrency: selectedPlan.currency,
            subscriptionStartsAt: startsAt,
            subscriptionEndsAt: endsAt,
        };

        setLoading(true);
        try {
            // TODO(payment): Replace this simulated success flow with real payment gateway integration
            // (Razorpay/Stripe) and move final subscription activation to verified server callbacks/webhooks.
            await new Promise((resolve) => setTimeout(resolve, 600));

            await setDoc(
                doc(db, 'users', uid),
                {
                    ...payload,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            setUser({ ...user, ...payload });
            await analyticsService.logEvent({
                userId: user.uid,
                eventType: 'payment_success',
                source: 'subscription_test',
                planId: selectedPlan.id,
                value: selectedPlan.monthlyPrice,
                currency: selectedPlan.currency,
            });
            setPaymentResult({
                status: 'success',
                message: `${selectedPlan.name} plan activated successfully.`,
            });
            Alert.alert(SUBSCRIPTION_TEXT.paymentSuccessTitle, SUBSCRIPTION_TEXT.testSuccessResult);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : SUBSCRIPTION_TEXT.activateFailed;
            setPaymentResult({ status: 'failed', message });
            Alert.alert(COMMON_TEXT.alerts.error, message);
        } finally {
            setLoading(false);
        }
    };

    const handleTestPaymentFailure = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // TODO(payment): Replace this simulated failure path with real gateway failure callbacks
            // and proper retry intents + failure reason codes from the payment provider.
            await new Promise((resolve) => setTimeout(resolve, 450));
            setPaymentResult({
                status: 'failed',
                message: SUBSCRIPTION_TEXT.testFailureCardMessage,
            });
            await analyticsService.logEvent({
                userId: user.uid,
                eventType: 'payment_failed',
                source: 'subscription_test',
                planId: selectedPlan.id,
                value: selectedPlan.monthlyPrice,
                currency: selectedPlan.currency,
            });
            Alert.alert(SUBSCRIPTION_TEXT.paymentFailedTitle, SUBSCRIPTION_TEXT.testFailureResult);
        } finally {
            setLoading(false);
        }
    };

    const handleLiveCheckout = async () => {
        if (!isLivePaymentConfigured) {
            Alert.alert(SUBSCRIPTION_TEXT.checkoutUnavailable, SUBSCRIPTION_TEXT.checkoutUnavailableDefault);
            return;
        }

        if (!user) {
            Alert.alert(COMMON_TEXT.alerts.loginRequired, SUBSCRIPTION_TEXT.loginToContinue);
            return;
        }

        setLoading(true);
        try {
            await analyticsService.logEvent({
                userId: user.uid,
                eventType: 'checkout_started',
                source: 'subscription_live',
                planId: selectedPlan.id,
                value: selectedPlan.monthlyPrice,
                currency: selectedPlan.currency,
            });

            const response = await paymentService.createSubscriptionCheckout(selectedPlan);
            if (!response.ok || !response.checkoutUrl) {
                Alert.alert(SUBSCRIPTION_TEXT.checkoutUnavailable, response.message ?? SUBSCRIPTION_TEXT.checkoutUnavailableDefault);
                return;
            }

            await analyticsService.logEvent({
                userId: user.uid,
                eventType: 'checkout_redirected',
                source: 'subscription_live',
                planId: selectedPlan.id,
            });

            const canOpen = await Linking.canOpenURL(response.checkoutUrl);
            if (!canOpen) {
                Alert.alert(SUBSCRIPTION_TEXT.openFailedTitle, SUBSCRIPTION_TEXT.openFailedBody);
                return;
            }
            await Linking.openURL(response.checkoutUrl);

            Alert.alert(
                SUBSCRIPTION_TEXT.checkoutStartedTitle,
                SUBSCRIPTION_TEXT.checkoutStartedBody
            );
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : SUBSCRIPTION_TEXT.checkoutStartFailed);
        } finally {
            setLoading(false);
        }
    };

    const subscriptionEndDate = toDateSafe(user?.subscriptionEndsAt);

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 16 }}>
                <Text variant="headlineMedium" style={{ fontWeight: '700' }}>
                    {SUBSCRIPTION_TEXT.title}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 6, marginBottom: 16 }}>
                    {SUBSCRIPTION_TEXT.subtitle}
                </Text>

                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        {SUBSCRIPTION_TEXT.currentSubscriptionTitle}
                    </Text>
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Text variant="bodyMedium" style={{ marginRight: 8 }}>
                            {SUBSCRIPTION_TEXT.statusLabel}
                        </Text>
                        <Chip
                            compact
                            style={{
                                backgroundColor:
                                    statusTone(user?.subscriptionStatus) === 'green'
                                        ? theme.colors.primaryContainer
                                        : statusTone(user?.subscriptionStatus) === 'red'
                                            ? theme.colors.errorContainer
                                            : theme.colors.surfaceVariant,
                            }}
                        >
                            {(user?.subscriptionStatus ?? 'inactive').toUpperCase()}
                        </Chip>
                    </View>
                    <Text variant="bodyMedium" style={{ marginTop: 8 }}>
                        {SUBSCRIPTION_TEXT.planLabel}: {user?.subscriptionPlanName ?? SUBSCRIPTION_TEXT.noPlan}
                    </Text>
                    <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                        {SUBSCRIPTION_TEXT.validUntilLabel}: {subscriptionEndDate ? formatDate(subscriptionEndDate) : '-'}
                    </Text>
                </AppCard>

                {loadingPlans && (
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                        {SUBSCRIPTION_TEXT.loadingPlans}
                    </Text>
                )}

                {plans.map((plan) => {
                    const isSelected = plan.id === selectedPlanId;
                    return (
                        <AppCard
                            key={plan.id}
                            onPress={() => {
                                setSelectedPlanId(plan.id);
                                if (user) {
                                    void analyticsService.logEvent({
                                        userId: user.uid,
                                        eventType: 'plan_selected',
                                        source: 'subscription_screen',
                                        planId: plan.id,
                                        value: plan.monthlyPrice,
                                        currency: plan.currency,
                                    });
                                }
                            }}
                            style={{
                                borderWidth: isSelected ? 1.5 : 1,
                                borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                                backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface,
                                opacity: plan.isActive ? 1 : 0.6,
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text variant="titleLarge" style={{ fontWeight: '700' }}>
                                        {plan.name}
                                    </Text>
                                    <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 2 }}>
                                        {plan.description}
                                    </Text>
                                </View>
                                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>
                                    {formatCurrency(plan.monthlyPrice, plan.currency)}/mo
                                </Text>
                            </View>

                            <View style={{ marginTop: 10 }}>
                                {plan.features.map((feature) => (
                                    <Text key={`${plan.id}-${feature}`} variant="bodySmall" style={{ marginTop: 2 }}>
                                        - {feature}
                                    </Text>
                                ))}
                            </View>
                        </AppCard>
                    );
                })}

                {paymentResult && (
                    <AppCard
                        style={{
                            borderWidth: 1,
                            borderColor: paymentResult.status === 'success' ? theme.colors.primary : theme.colors.error,
                        }}
                    >
                        <Text
                            variant="titleSmall"
                            style={{
                                fontWeight: '700',
                                color: paymentResult.status === 'success' ? theme.colors.primary : theme.colors.error,
                            }}
                        >
                            {paymentResult.status === 'success' ? SUBSCRIPTION_TEXT.paymentSuccessTitle : SUBSCRIPTION_TEXT.paymentFailedTitle}
                        </Text>
                        <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                            {paymentResult.message}
                        </Text>
                    </AppCard>
                )}
            </ScrollView>

            <View
                style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: 90,
                    backgroundColor: theme.colors.elevation.level2,
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                }}
            >
                <Text variant="bodySmall" style={{ marginBottom: 8 }}>
                    {SUBSCRIPTION_TEXT.selectedLabel}: {selectedPlan.name} ({formatCurrency(selectedPlan.monthlyPrice, selectedPlan.currency)}/month)
                </Text>
                {!isLivePaymentConfigured && (
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                        {SUBSCRIPTION_TEXT.checkoutDisabledNote}
                    </Text>
                )}
                <AppButton
                    mode="contained"
                    onPress={() => { void handleLiveCheckout(); }}
                    loading={loading}
                    disabled={!isLivePaymentConfigured}
                >
                    {isLivePaymentConfigured ? SUBSCRIPTION_TEXT.startLiveButton : SUBSCRIPTION_TEXT.startLiveDisabledButton}
                </AppButton>
                <AppButton
                    mode="contained"
                    onPress={() => { void handleTestPaymentSuccess(); }}
                    loading={loading}
                    style={{ marginTop: 8 }}
                >
                    {SUBSCRIPTION_TEXT.testSuccessButton}
                </AppButton>
                <AppButton
                    mode="outlined"
                    onPress={() => { void handleTestPaymentFailure(); }}
                    disabled={loading}
                    style={{ marginTop: 8 }}
                >
                    {SUBSCRIPTION_TEXT.testFailButton}
                </AppButton>
            </View>
        </ScreenWrapper>
    );
};
