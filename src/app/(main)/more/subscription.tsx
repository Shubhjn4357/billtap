import { useMemo, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { toUserMessage } from '../../../api/client';
import { subscriptionApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import type { Subscription } from '../../../types/domain';
import { canPerformAction } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';

type PlanLike = {
    id: string;
    name?: string;
    displayName?: string;
    description?: string;
    currency?: string;
    monthlyPrice?: number;
    pricePerCycle?: number;
    billingCycle?: 'MONTHLY' | 'YEARLY' | 'THREE_YEAR' | null;
    tier?: string;
    enabledFeatures?: string[];
    features?: string[];
};

type MockCheckoutOutcome = 'succeeded' | 'pending' | 'failed';
type BillingCycleTab = 'MONTHLY' | 'YEARLY' | 'THREE_YEAR';

const formatPlanPrice = (plan: PlanLike) => {
    const value = Number(plan.pricePerCycle ?? plan.monthlyPrice ?? 0);
    const cycle = plan.billingCycle ?? 'MONTHLY';
    const cycleLabel = cycle === 'YEARLY' ? 'year' : cycle === 'THREE_YEAR' ? '3 years' : 'month';
    return `Rs ${value.toLocaleString('en-IN')} / ${cycleLabel}`;
};

const getPlanName = (plan: PlanLike) => plan.displayName ?? plan.name ?? plan.tier ?? 'Plan';

const computeRenewalDate = (billingCycle: PlanLike['billingCycle']) => {
    const next = new Date();
    if (billingCycle === 'YEARLY') {
        next.setFullYear(next.getFullYear() + 1);
    } else if (billingCycle === 'THREE_YEAR') {
        next.setFullYear(next.getFullYear() + 3);
    } else {
        next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
};

export default function SubscriptionScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme ?? 'light');
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const subscription = useAuthStore((state) => state.subscription);
    const business = useAuthStore((state) => state.business);
    const setSubscription = useAuthStore((state) => state.setSubscription);
    const role = useAuthStore((state) => state.organizationRole);
    const canCheckout = canPerformAction(role, 'subscription.checkout', subscription);

    const [discountCode, setDiscountCode] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [lastCheckoutIntentId, setLastCheckoutIntentId] = useState<string | null>(null);
    const [mockOutcome, setMockOutcome] = useState<MockCheckoutOutcome>('succeeded');
    const [activeCycleTab, setActiveCycleTab] = useState<BillingCycleTab>('MONTHLY');

    const livePaymentsEnabled = process.env.EXPO_PUBLIC_ENABLE_LIVE_PAYMENTS === 'true';

    const { data: plansRes, isLoading: loadingPlans, isRefetching: plansRefetching, refetch: refetchPlans } = useQuery({
        queryKey: ['subscription-plans'],
        queryFn: () => subscriptionApi.getPlans(),
        staleTime: 60_000,
    });

    const { data: offersRes, isRefetching: offersRefetching, refetch: refetchOffers } = useQuery({
        queryKey: ['subscription-offers-active'],
        queryFn: () => subscriptionApi.getActiveOffers(),
        staleTime: 60_000,
    });
    const isRefreshing = plansRefetching || offersRefetching;

    const plans = useMemo(() => {
        const raw = (plansRes?.plans ?? []) as PlanLike[];
        return [...raw].sort((a, b) => {
            const nameA = getPlanName(a);
            const nameB = getPlanName(b);
            if (nameA === nameB) return (a.billingCycle ?? '').localeCompare(b.billingCycle ?? '');
            return nameA.localeCompare(nameB);
        });
    }, [plansRes]);
    const visiblePlans = useMemo(
        () => plans.filter((entry) => (entry.billingCycle ?? 'MONTHLY') === activeCycleTab),
        [activeCycleTab, plans]
    );

    const { mutate: validateDiscount, isPending: validatingDiscount } = useMutation({
        mutationFn: (planId?: string) =>
            subscriptionApi.validateDiscount({ code: discountCode.trim().toUpperCase(), planId }),
        onSuccess: (response) => {
            const discount = response.data?.discount;
            if (!discount) {
                dialog.alert('Discount', 'Discount code is valid.');
                return;
            }
            const amountText = discount.type === 'PERCENTAGE'
                ? `${discount.value}% OFF`
                : `Rs ${Number(discount.value).toLocaleString('en-IN')} OFF`;
            dialog.alert('Discount Applied', `${discount.code} (${amountText})`);
        },
        onError: (error) => {
            dialog.alert('Discount Error', toUserMessage(error, 'Invalid discount code.'));
        },
    });

    const applyMockUpgrade = (plan: PlanLike) => {
        const nowIso = new Date().toISOString();
        const renewalIso = computeRenewalDate(plan.billingCycle);
        const nextTier = plan.tier ?? subscription?.tier ?? 'FREE';
        const nextCycle = plan.billingCycle ?? subscription?.billingCycle ?? 'MONTHLY';

        const nextSubscription: Subscription = {
            id: subscription?.id ?? `sub_mock_${Date.now()}`,
            businessId: subscription?.businessId ?? business?.id ?? 'local',
            tier: nextTier as Subscription['tier'],
            billingCycle: nextCycle as Subscription['billingCycle'],
            status: 'ACTIVE',
            startDate: subscription?.startDate ?? nowIso,
            endDate: renewalIso,
            nextRenewalDate: renewalIso,
            renewsAt: renewalIso,
            graceEndDate: subscription?.graceEndDate ?? null,
            maxBillsTotal: subscription?.maxBillsTotal ?? null,
            maxBillsPerMonth: subscription?.maxBillsPerMonth ?? null,
            maxStaffUsers: subscription?.maxStaffUsers ?? null,
            maxBusinesses: subscription?.maxBusinesses ?? null,
            maxDevices: subscription?.maxDevices ?? null,
            maxStorageMb: subscription?.maxStorageMb ?? null,
            monthlyInvoiceCount: subscription?.monthlyInvoiceCount ?? 0,
            offlineOnly: subscription?.offlineOnly ?? false,
            cloudSyncAllowed: subscription?.cloudSyncAllowed ?? true,
            webDashboardAllowed: subscription?.webDashboardAllowed ?? true,
            featureFlagsEnabled: subscription?.featureFlagsEnabled ?? [],
            createdAt: subscription?.createdAt ?? nowIso,
            updatedAt: nowIso,
        };

        setSubscription(nextSubscription);
    };

    const { mutate: startCheckout, isPending: checkoutPending } = useMutation({
        mutationFn: async (plan: PlanLike) => {
            if (!canCheckout) {
                throw new Error('Your role cannot start subscription checkout.');
            }

            if (!livePaymentsEnabled) {
                const intentId = `mock_${Date.now()}`;
                await new Promise((resolve) => setTimeout(resolve, 400));
                return { intentId, status: mockOutcome, plan };
            }

            const response = await subscriptionApi.createCheckoutSession({
                planId: plan.id,
                discountCode: discountCode.trim() || undefined,
            });
            const data = response.data;
            if (!data?.checkoutUrl || !data.intentId) {
                throw new Error('Checkout URL is unavailable for this plan.');
            }

            await WebBrowser.openBrowserAsync(data.checkoutUrl);

            let status: MockCheckoutOutcome = 'pending';
            try {
                const statusRes = await subscriptionApi.getIntentStatus(data.intentId);
                const nextStatus = statusRes.data?.status ?? 'pending';
                status = nextStatus === 'canceled' ? 'failed' : nextStatus;
            } catch {
                status = 'pending';
            }

            return { intentId: data.intentId, status, plan };
        },
        onSuccess: async (result) => {
            setLastCheckoutIntentId(result.intentId);

            if (result.status === 'succeeded') {
                if (!livePaymentsEnabled) {
                    applyMockUpgrade(result.plan);
                }
                dialog.alert('Payment Successful', 'Plan activated successfully.');
            } else if (result.status === 'failed') {
                dialog.alert('Payment Failed', 'Payment was not completed.');
            } else {
                dialog.alert('Payment Pending', 'Payment is still processing. Please check again shortly.');
            }

            await refetchPlans();
        },
        onError: (error) => {
            dialog.alert('Checkout Error', toUserMessage(error, 'Failed to start checkout.'));
        },
        onSettled: () => setSelectedPlanId(null),
    });

    const currentTier = subscription?.tier ?? null;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Subscription"
                subtitle="Plan and billing controls"
                onBackPress={smartBack}
            />

            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                contentContainerStyle={s.content}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            void Promise.all([refetchPlans(), refetchOffers()]);
                        }}
                    />
                )}
            >
                <View style={[s.modeCard, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[s.modeTitle, { color: colors.text }]}>
                        Payment mode: {livePaymentsEnabled ? 'Live checkout' : 'Mock checkout'}
                    </Text>
                    <Text style={[s.modeMeta, { color: colors.textSecondary }]}>
                        {livePaymentsEnabled
                            ? 'Real checkout flow through API.'
                            : 'Deterministic mock flow for internal testing without payment gateway.'}
                    </Text>
                    {!livePaymentsEnabled ? (
                        <View style={s.modeChips}>
                            {(['succeeded', 'pending', 'failed'] as const).map((entry) => {
                                const selected = mockOutcome === entry;
                                return (
                                    <Pressable
                                        key={entry}
                                        style={[
                                            s.modeChip,
                                            {
                                                borderColor: selected ? colors.primary : colors.border,
                                                backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent',
                                            },
                                        ]}
                                        onPress={() => setMockOutcome(entry)}
                                    >
                                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                                            {entry.toUpperCase()}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : null}
                </View>

                {currentTier ? (
                    <View style={[s.currentCard, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={[s.currentTitle, { color: colors.text }]}>Current Tier: {currentTier}</Text>
                        {subscription?.renewsAt ? (
                            <Text style={[s.currentMeta, { color: colors.textSecondary }]}>
                                Renews on {new Date(subscription.renewsAt).toLocaleDateString('en-IN')}
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                {(offersRes?.data ?? []).slice(0, 2).map((offer) => (
                    <View key={offer.id} style={[s.offerCard, { backgroundColor: withAlpha(colors.primary, '18'), borderColor: withAlpha(colors.primary, '50') }]}>
                        <Text style={[s.offerTitle, { color: colors.primary }]}>{offer.title}</Text>
                        <Text style={[s.offerMessage, { color: colors.text }]}>{offer.message}</Text>
                    </View>
                ))}

                <View style={s.discountRow}>
                    <AppInput
                        inputType="text"
                        value={discountCode}
                        onChangeText={setDiscountCode}
                        placeholder="Discount code (optional)"
                        autoCapitalize="characters"
                        containerStyle={s.discountInputWrap}
                    />
                    <Pressable
                        style={[s.validateBtn, { backgroundColor: colors.primary }]}
                        disabled={validatingDiscount || !discountCode.trim()}
                        onPress={() => validateDiscount(selectedPlanId ?? undefined)}
                    >
                        {validatingDiscount ? (
                            <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                            <Text style={s.validateBtnText}>Apply</Text>
                        )}
                    </Pressable>
                </View>
                <View style={s.cycleTabs}>
                    {(['MONTHLY', 'YEARLY', 'THREE_YEAR'] as BillingCycleTab[]).map((entry) => {
                        const selected = activeCycleTab === entry;
                        return (
                            <Pressable
                                key={entry}
                                style={[
                                    s.cycleTab,
                                    {
                                        borderColor: selected ? colors.primary : colors.border,
                                        backgroundColor: selected ? withAlpha(colors.primary, '20') : colors.card,
                                    },
                                ]}
                                onPress={() => setActiveCycleTab(entry)}
                            >
                                <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                    {entry === 'THREE_YEAR' ? '3 YEAR' : entry}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {loadingPlans ? (
                    <View style={s.centered}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : visiblePlans.length === 0 ? (
                    <View style={s.centered}>
                        <Text style={{ color: colors.textSecondary }}>No plans found for selected cycle.</Text>
                    </View>
                ) : (
                    visiblePlans.map((plan) => {
                        const isCurrent = Boolean(currentTier && plan.tier === currentTier);
                        const isBusy = checkoutPending && selectedPlanId === plan.id;
                        const featureList = (plan.enabledFeatures ?? plan.features ?? []).slice(0, 6);

                        return (
                            <View key={plan.id} style={[s.planCard, { backgroundColor: colors.card, borderColor: isCurrent ? colors.primary : colors.border }]}>
                                <View style={s.planHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.planName, { color: colors.text }]}>{getPlanName(plan)}</Text>
                                        <Text style={[s.planPrice, { color: colors.primary }]}>{formatPlanPrice(plan)}</Text>
                                        {plan.description ? (
                                            <Text style={[s.planDescription, { color: colors.textSecondary }]}>{plan.description}</Text>
                                        ) : null}
                                        <Text style={[s.planMeta, { color: colors.textSecondary }]}>
                                            {(plan.billingCycle ?? 'MONTHLY')} - {plan.id}
                                        </Text>
                                    </View>

                                    {isCurrent ? (
                                        <View style={[s.currentPill, { backgroundColor: colors.primary }]}>
                                            <Text style={s.currentPillText}>Current</Text>
                                        </View>
                                    ) : (
                                        <Pressable
                                            style={[s.upgradeBtn, { backgroundColor: canCheckout ? colors.primary : colors.border }]}
                                            disabled={isBusy || checkoutPending || !canCheckout}
                                            onPress={() => {
                                                if (!canCheckout) {
                                                    dialog.alert('Access denied', 'Your role cannot purchase or upgrade plans.');
                                                    return;
                                                }
                                                setSelectedPlanId(plan.id);
                                                startCheckout(plan);
                                            }}
                                        >
                                            {isBusy ? (
                                                <ActivityIndicator color={colors.onPrimary} size="small" />
                                            ) : (
                                                <Text style={s.upgradeBtnText}>Upgrade</Text>
                                            )}
                                        </Pressable>
                                    )}
                                </View>

                                {featureList.length > 0 ? (
                                    <View style={s.featuresWrap}>
                                        {featureList.map((feature) => (
                                            <Text key={feature} style={[s.featureText, { color: colors.textSecondary }]}>
                                                - {feature}
                                            </Text>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })
                )}

                {lastCheckoutIntentId ? (
                    <Text style={[s.intentMeta, { color: colors.textSecondary }]}>Last intent: {lastCheckoutIntentId}</Text>
                ) : null}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        flex: { flex: 1 },
        content: { paddingHorizontal: Spacing.lg, paddingBottom: 80, gap: Spacing.md },
        modeCard: { borderRadius: Radius.card, padding: Spacing.md, marginTop: Spacing.sm },
        modeTitle: { fontSize: 14, fontWeight: '700' },
        modeMeta: { fontSize: 12, marginTop: 4 },
        modeChips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        modeChip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        currentCard: { borderRadius: Radius.card, padding: Spacing.md, marginTop: Spacing.sm },
        currentTitle: { fontSize: 15, fontWeight: '700' },
        currentMeta: { fontSize: 12, marginTop: 4 },
        offerCard: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md },
        offerTitle: { fontSize: 14, fontWeight: '700' },
        offerMessage: { fontSize: 12, marginTop: 4 },
        cycleTabs: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        cycleTab: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
        },
        discountRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
        discountInputWrap: { flex: 1 },
        validateBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 72, alignItems: 'center' },
        validateBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
        centered: { paddingVertical: 32, alignItems: 'center' },
        planCard: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm },
        planHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
        planName: { fontSize: 16, fontWeight: '700' },
        planPrice: { marginTop: 2, fontSize: 14, fontWeight: '700' },
        planDescription: { marginTop: 4, fontSize: 12 },
        planMeta: { marginTop: 6, fontSize: 11, fontWeight: '600' },
        currentPill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        currentPillText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
        upgradeBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 84, alignItems: 'center' },
        upgradeBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
        featuresWrap: { gap: 4 },
        featureText: { fontSize: 12 },
        intentMeta: { marginTop: 4, fontSize: 11, textAlign: 'center' },
    });
