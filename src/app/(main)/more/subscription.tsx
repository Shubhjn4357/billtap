import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { toUserMessage } from '../../../api/client';
import {
    SUBSCRIPTION_BILLING_CYCLE_OPTIONS,
    SUBSCRIPTION_MOCK_OUTCOME_OPTIONS,
    type BillingCycleTab,
    type MockCheckoutOutcome,
} from '../../../constants/subscriptionOptions';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSubscriptionMutations } from '../../../hooks/useSubscriptionMutations';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import {
    UtilityBanner,
    UtilityEmptyState,
    UtilityHero,
    UtilityPanel,
    UtilitySection,
} from '../../../components/ui/UtilityBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useActiveOffers, useSubscriptionPlans } from '../../../hooks/useOffers';

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
    const cycle = plan.billingCycle ?? 'MONTHLY';
    const cycleLabel = cycle === 'YEARLY' ? 'year' : cycle === 'THREE_YEAR' ? '3 years' : 'month';
    return `Rs ${value.toLocaleString('en-IN')} / ${cycleLabel}`;
};

const getPlanName = (plan: PlanLike) => plan.displayName ?? plan.name ?? plan.tier ?? 'Plan';

export default function SubscriptionScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);
    const canCheckout = canPerformAction(role, 'subscription.checkout', subscription);

    const [discountCode, setDiscountCode] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [lastCheckoutIntentId, setLastCheckoutIntentId] = useState<string | null>(null);
    const [mockOutcome, setMockOutcome] = useState<MockCheckoutOutcome>('succeeded');
    const [activeCycleTab, setActiveCycleTab] = useState<BillingCycleTab>('MONTHLY');

    const livePaymentsEnabled = process.env.EXPO_PUBLIC_ENABLE_LIVE_PAYMENTS === 'true';

    const plansQuery = useSubscriptionPlans();
    const offersQuery = useActiveOffers();
    const {
        validateDiscount,
        isValidatingDiscount,
        startCheckout,
        isStartingCheckout,
    } = useSubscriptionMutations();
    const {
        plans: planRows,
        isLoading: loadingPlans,
        isRefetching: plansRefetching,
        refetch: refetchPlans,
    } = plansQuery;
    const {
        offers,
        isRefetching: offersRefetching,
        refetch: refetchOffers,
    } = offersQuery;
    const isRefreshing = plansRefetching || offersRefetching;
    const cacheStatusMessage = useMemo(
        () =>
            [plansQuery.data?.message, offersQuery.data?.message].find((message) =>
                /offline cache|local session/i.test(String(message ?? ''))
            ) ?? null,
        [offersQuery.data?.message, plansQuery.data?.message]
    );

    const plans = useMemo(() => {
        const raw = planRows as PlanLike[];
        return [...raw].sort((a, b) => {
            const nameA = getPlanName(a);
            const nameB = getPlanName(b);
            if (nameA === nameB) return (a.billingCycle ?? '').localeCompare(b.billingCycle ?? '');
            return nameA.localeCompare(nameB);
        });
    }, [planRows]);

    const visiblePlans = useMemo(
        () => plans.filter((entry) => (entry.billingCycle ?? 'MONTHLY') === activeCycleTab),
        [activeCycleTab, plans]
    );

    const currentTier = subscription?.tier ?? null;

    const handleApplyDiscount = () => {
        void validateDiscount({
            code: discountCode.trim().toUpperCase(),
            planId: selectedPlanId ?? undefined,
        })
            .then((response) => {
                const discount = response.data?.discount;
                if (!discount) {
                    dialog.alert('Discount', 'Discount code is valid.');
                    return;
                }
                const amountText =
                    discount.type === 'PERCENTAGE'
                        ? `${discount.value}% OFF`
                        : `Rs ${Number(discount.value).toLocaleString('en-IN')} OFF`;
                dialog.alert('Discount Applied', `${discount.code} (${amountText})`);
            })
            .catch((error) => {
                dialog.alert('Discount Error', toUserMessage(error, 'Invalid discount code.'));
            });
    };

    const handleUpgrade = (plan: PlanLike) => {
        if (!canCheckout) {
            dialog.alert('Access denied', 'Your role cannot purchase or upgrade plans.');
            return;
        }

        setSelectedPlanId(plan.id);
        void startCheckout({
            plan,
            canCheckout,
            livePaymentsEnabled,
            mockOutcome,
            discountCode,
        })
            .then(async (result) => {
                setLastCheckoutIntentId(result.intentId);
                if (result.status === 'succeeded') {
                    dialog.alert('Payment Successful', 'Plan activated successfully.');
                } else if (result.status === 'failed') {
                    dialog.alert('Payment Failed', 'Payment was not completed.');
                } else {
                    dialog.alert('Payment Pending', 'Payment is still processing. Please check again shortly.');
                }
                await refetchPlans();
            })
            .catch((error) => {
                dialog.alert('Checkout Error', toUserMessage(error, 'Failed to start checkout.'));
            })
            .finally(() => {
                setSelectedPlanId(null);
            });
    };

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
                    <UtilityHero
                        title={currentTier ? `${currentTier} Plan` : 'Subscription Control'}
                        subtitle={
                            livePaymentsEnabled
                                ? 'Live checkout is enabled for this build.'
                                : 'Mock checkout is enabled for this build.'
                        }
                        icon="star-circle-outline"
                        tone="info"
                    />

                    <UtilitySection title="Checkout Mode">
                        <UtilityPanel tone="info">
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
                                    {SUBSCRIPTION_MOCK_OUTCOME_OPTIONS.map((option) => {
                                        return (
                                            <ChipButton
                                                key={option.key}
                                                label={option.label}
                                                selected={mockOutcome === option.key}
                                                tone="info"
                                                onPress={() => setMockOutcome(option.key)}
                                            />
                                        );
                                    })}
                                </View>
                            ) : null}
                        </UtilityPanel>
                    </UtilitySection>

                    {currentTier ? (
                        <UtilitySection title="Current Plan">
                            <UtilityPanel>
                                <Text style={[s.currentTitle, { color: colors.text }]}>
                                    Current Tier: {currentTier}
                                </Text>
                                {subscription?.renewsAt ? (
                                    <Text style={[s.currentMeta, { color: colors.textSecondary }]}>
                                        Renews on {new Date(subscription.renewsAt).toLocaleDateString('en-IN')}
                                    </Text>
                                ) : null}
                            </UtilityPanel>
                        </UtilitySection>
                    ) : null}

                    {offers.length > 0 ? (
                        <UtilitySection title="Offers" count={Math.min(offers.length, 2)}>
                            {offers.slice(0, 2).map((offer) => (
                                <UtilityPanel key={offer.id} tone="info">
                                    <Text style={[s.offerTitle, { color: colors.primary }]}>{offer.title}</Text>
                                    <Text style={[s.offerMessage, { color: colors.text }]}>{offer.message}</Text>
                                </UtilityPanel>
                            ))}
                        </UtilitySection>
                    ) : null}

                    {cacheStatusMessage ? <UtilityBanner message={cacheStatusMessage} /> : null}

                    <UtilitySection title="Discount and Billing">
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
                                disabled={isValidatingDiscount || !discountCode.trim()}
                                onPress={handleApplyDiscount}
                            >
                                {isValidatingDiscount ? (
                                    <ActivityIndicator color={colors.onPrimary} size="small" />
                                ) : (
                                    <Text style={s.validateBtnText}>Apply</Text>
                                )}
                            </Pressable>
                        </View>

                        <View style={s.cycleTabs}>
                            {SUBSCRIPTION_BILLING_CYCLE_OPTIONS.map((option) => {
                                return (
                                    <ChipButton
                                        key={option.key}
                                        label={option.label}
                                        selected={activeCycleTab === option.key}
                                        tone="info"
                                        onPress={() => setActiveCycleTab(option.key)}
                                    />
                                );
                            })}
                        </View>
                    </UtilitySection>

                    <UtilitySection title="Plans" count={visiblePlans.length}>
                        {loadingPlans ? (
                            <View style={s.centered}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : visiblePlans.length === 0 ? (
                            <UtilityEmptyState
                                icon="layers-search-outline"
                                title="No plans found"
                                description="No subscription plans are available for the selected billing cycle."
                            />
                        ) : (
                            visiblePlans.map((plan) => {
                                const isCurrent = Boolean(currentTier && plan.tier === currentTier);
                                const isBusy = isStartingCheckout && selectedPlanId === plan.id;
                                const featureList = (plan.enabledFeatures ?? plan.features ?? []).slice(0, 6);

                                return (
                                    <UtilityPanel key={plan.id} tone={isCurrent ? 'info' : 'default'}>
                                        <View style={s.planHeader}>
                                            <View style={s.planBody}>
                                                <Text style={[s.planName, { color: colors.text }]}>
                                                    {getPlanName(plan)}
                                                </Text>
                                                <Text style={[s.planPrice, { color: colors.primary }]}>
                                                    {formatPlanPrice(plan)}
                                                </Text>
                                                {plan.description ? (
                                                    <Text
                                                        style={[
                                                            s.planDescription,
                                                            { color: colors.textSecondary },
                                                        ]}
                                                    >
                                                        {plan.description}
                                                    </Text>
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
                                                    style={[
                                                        s.upgradeBtn,
                                                        {
                                                            backgroundColor: canCheckout
                                                                ? colors.primary
                                                                : colors.border,
                                                        },
                                                    ]}
                                                    disabled={isBusy || isStartingCheckout || !canCheckout}
                                                    onPress={() => handleUpgrade(plan)}
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
                                                    <Text
                                                        key={feature}
                                                        style={[s.featureText, { color: colors.textSecondary }]}
                                                    >
                                                        • {feature}
                                                    </Text>
                                                ))}
                                            </View>
                                        ) : null}
                                    </UtilityPanel>
                                );
                            })
                        )}
                    </UtilitySection>

                    {lastCheckoutIntentId ? (
                        <Text style={[s.intentMeta, { color: colors.textSecondary }]}>
                            Last intent: {lastCheckoutIntentId}
                        </Text>
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
        modeTitle: { fontSize: 14, fontWeight: '700' },
        modeMeta: { fontSize: 12, marginTop: 4 },
        modeChips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        currentTitle: { fontSize: 15, fontWeight: '700' },
        currentMeta: { fontSize: 12, marginTop: 4 },
        offerTitle: { fontSize: 14, fontWeight: '700' },
        offerMessage: { fontSize: 12, marginTop: 4 },
        cycleTabs: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
        discountRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
        discountInputWrap: { flex: 1 },
        validateBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minWidth: 72,
            alignItems: 'center',
        },
        validateBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
        centered: { paddingVertical: 32, alignItems: 'center' },
        planHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
        planBody: { flex: 1 },
        planName: { fontSize: 16, fontWeight: '700' },
        planPrice: { marginTop: 2, fontSize: 14, fontWeight: '700' },
        planDescription: { marginTop: 4, fontSize: 12 },
        planMeta: { marginTop: 6, fontSize: 11, fontWeight: '600' },
        currentPill: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        currentPillText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
        upgradeBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minWidth: 84,
            alignItems: 'center',
        },
        upgradeBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
        featuresWrap: { gap: 4 },
        featureText: { fontSize: 12 },
        intentMeta: { marginTop: 4, fontSize: 11, textAlign: 'center' },
    });
