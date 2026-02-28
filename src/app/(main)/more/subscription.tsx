import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { subscriptionApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';

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

const formatPlanPrice = (plan: PlanLike) => {
    const value = Number(plan.pricePerCycle ?? plan.monthlyPrice ?? 0);
    const currency = (plan.currency ?? 'INR').toUpperCase();
    const cycle = plan.billingCycle ?? 'MONTHLY';
    const cycleLabel = cycle === 'YEARLY' ? 'year' : cycle === 'THREE_YEAR' ? '3 years' : 'month';

    return `₹${value.toLocaleString('en-IN')} / ${cycleLabel}`;
};

const getPlanName = (plan: PlanLike) => plan.displayName ?? plan.name ?? plan.tier ?? 'Plan';

export default function SubscriptionScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme ?? 'light');
    const s = styles(colors);
    const subscription = useAuthStore((state) => state.subscription);

    const [discountCode, setDiscountCode] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [lastCheckoutIntentId, setLastCheckoutIntentId] = useState<string | null>(null);

    const { data: plansRes, isLoading: loadingPlans, refetch: refetchPlans } = useQuery({
        queryKey: ['subscription-plans'],
        queryFn: () => subscriptionApi.getPlans(),
        staleTime: 60_000,
    });

    const { data: offersRes } = useQuery({
        queryKey: ['subscription-offers-active'],
        queryFn: () => subscriptionApi.getActiveOffers(),
        staleTime: 60_000,
    });

    const plans = useMemo(() => {
        const raw = (plansRes?.plans ?? []) as PlanLike[];
        return [...raw].sort((a, b) => {
            const nameA = getPlanName(a);
            const nameB = getPlanName(b);
            if (nameA === nameB) return (a.billingCycle ?? '').localeCompare(b.billingCycle ?? '');
            return nameA.localeCompare(nameB);
        });
    }, [plansRes]);

    const { mutate: validateDiscount, isPending: validatingDiscount } = useMutation({
        mutationFn: (planId?: string) =>
            subscriptionApi.validateDiscount({ code: discountCode.trim().toUpperCase(), planId }),
        onSuccess: (response) => {
            const discount = response.data?.discount;
            if (!discount) {
                Alert.alert('Discount', 'Discount code is valid.');
                return;
            }
            const amountText = discount.type === 'PERCENTAGE'
                ? `${discount.value}% OFF`
                : `₹${Number(discount.value).toLocaleString('en-IN')} OFF`;
            Alert.alert('Discount Applied', `${discount.code} (${amountText})`);
        },
        onError: (error) => {
            Alert.alert('Discount Error', error instanceof Error ? error.message : 'Invalid discount code.');
        },
    });

    const { mutate: startCheckout, isPending: checkoutPending } = useMutation({
        mutationFn: (plan: PlanLike) =>
            subscriptionApi.createCheckoutSession({
                planId: plan.id,
                discountCode: discountCode.trim() || undefined,
            }),
        onSuccess: async (response) => {
            const data = response.data;
            if (!data?.checkoutUrl) {
                Alert.alert('Checkout', 'Checkout URL is unavailable for this plan.');
                return;
            }

            setLastCheckoutIntentId(data.intentId);
            await WebBrowser.openBrowserAsync(data.checkoutUrl);

            try {
                const statusRes = await subscriptionApi.getIntentStatus(data.intentId);
                const status = statusRes.data?.status ?? 'pending';
                if (status === 'succeeded') {
                    Alert.alert('Payment Successful', 'Plan activated successfully.');
                } else if (status === 'failed' || status === 'canceled') {
                    Alert.alert('Payment Failed', 'Payment was not completed.');
                } else {
                    Alert.alert('Payment Pending', 'Payment is still processing. Please check again shortly.');
                }
            } catch {
                Alert.alert('Checkout', 'Unable to confirm payment status yet.');
            } finally {
                refetchPlans().catch(() => null);
            }
        },
        onError: (error) => {
            Alert.alert('Checkout Error', error instanceof Error ? error.message : 'Failed to start checkout.');
        },
        onSettled: () => setSelectedPlanId(null),
    });

    const currentTier = subscription?.tier ?? null;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Upgrade Plan</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
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
                    <View key={offer.id} style={[s.offerCard, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '50' }]}>
                        <Text style={[s.offerTitle, { color: colors.primary }]}>{offer.title}</Text>
                        <Text style={[s.offerMessage, { color: colors.text }]}>{offer.message}</Text>
                    </View>
                ))}

                <View style={s.discountRow}>
                    <TextInput
                        value={discountCode}
                        onChangeText={setDiscountCode}
                        style={[s.discountInput, { borderColor: colors.border, color: colors.text }]}
                        placeholder="Discount code (optional)"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="characters"
                    />
                    <Pressable
                        style={[s.validateBtn, { backgroundColor: colors.primary }]}
                        disabled={validatingDiscount || !discountCode.trim()}
                        onPress={() => validateDiscount(selectedPlanId ?? undefined)}
                    >
                        {validatingDiscount ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={s.validateBtnText}>Apply</Text>
                        )}
                    </Pressable>
                </View>

                {loadingPlans ? (
                    <View style={s.centered}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : plans.length === 0 ? (
                    <View style={s.centered}>
                        <Text style={{ color: colors.textSecondary }}>No plans found.</Text>
                    </View>
                ) : (
                    plans.map((plan) => {
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
                                            {plan.billingCycle ?? 'MONTHLY'} · {plan.id}
                                        </Text>
                                    </View>

                                    {isCurrent ? (
                                        <View style={[s.currentPill, { backgroundColor: colors.primary }]}>
                                            <Text style={s.currentPillText}>Current</Text>
                                        </View>
                                    ) : (
                                        <Pressable
                                            style={[s.upgradeBtn, { backgroundColor: colors.primary }]}
                                            disabled={isBusy || checkoutPending}
                                            onPress={() => {
                                                setSelectedPlanId(plan.id);
                                                startCheckout(plan);
                                            }}
                                        >
                                            {isBusy ? (
                                                <ActivityIndicator color="#fff" size="small" />
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
                                                • {feature}
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
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        back: { fontSize: 14, fontWeight: '600' },
        title: { fontSize: 17, fontWeight: '700', color: colors.text },
        content: { paddingHorizontal: Spacing.lg, paddingBottom: 80, gap: Spacing.md },
        currentCard: { borderRadius: Radius.card, padding: Spacing.md, marginTop: Spacing.sm },
        currentTitle: { fontSize: 15, fontWeight: '700' },
        currentMeta: { fontSize: 12, marginTop: 4 },
        offerCard: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md },
        offerTitle: { fontSize: 14, fontWeight: '700' },
        offerMessage: { fontSize: 12, marginTop: 4 },
        discountRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
        discountInput: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14 },
        validateBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 72, alignItems: 'center' },
        validateBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
        centered: { paddingVertical: 32, alignItems: 'center' },
        planCard: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm },
        planHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
        planName: { fontSize: 16, fontWeight: '700' },
        planPrice: { marginTop: 2, fontSize: 14, fontWeight: '700' },
        planDescription: { marginTop: 4, fontSize: 12 },
        planMeta: { marginTop: 6, fontSize: 11, fontWeight: '600' },
        currentPill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        currentPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
        upgradeBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minWidth: 84, alignItems: 'center' },
        upgradeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
        featuresWrap: { gap: 4 },
        featureText: { fontSize: 12 },
        intentMeta: { marginTop: 4, fontSize: 11, textAlign: 'center' },
    });
