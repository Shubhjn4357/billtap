import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { toUserMessage } from '../../../api/client';
import {
    SUBSCRIPTION_BILLING_CYCLE_OPTIONS,
    SUBSCRIPTION_MOCK_OUTCOME_OPTIONS,
    type BillingCycleTab,
    type MockCheckoutOutcome,
} from '../../../constants/subscriptionOptions';
import {
    DESIGN_SPACING,
    getPillStyle,
    getSurfaceStyle,
} from '../../../constants/designSystem';
import {
    Radius,
    Spacing,
    Typography,
    type ColorPalette,
    withAlpha,
} from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSubscriptionMutations } from '../../../hooks/useSubscriptionMutations';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';
import { AppInput } from '../../../components/ui/AppInput';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import {
    SettingsFieldCard,
    SettingsHeroCard,
    SettingsLinkRow,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsStatusPill,
} from '../../../components/settings/SettingsBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useActiveOffers, useSubscriptionPlans } from '../../../hooks/useOffers';
import { openOfferDestination } from '../../../utils/offerNavigation';

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
    const smartBack = useSmartBack('/(main)/settings/account');
    const subscription = useAuthStore((state) => state.subscription);
    const business = useAuthStore((state) => state.business);
    const role = useAuthStore((state) => state.organizationRole);
    const canCheckout = canPerformAction(role, 'subscription.checkout', subscription, business);

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
        data: offersData,
    } = offersQuery;
    const isRefreshing = plansRefetching || offersRefetching;
    const cacheStatusMessage = useMemo(
        () =>
            [plansQuery.data?.message, offersData?.message].find((message) =>
                /offline cache|local session/i.test(String(message ?? ''))
            ) ?? null,
        [offersData?.message, plansQuery.data?.message]
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
    const subscriptionStatus = subscription?.status ?? null;
    const planInGoodStanding = subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL' || subscriptionStatus === null;

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
        <SettingsPageShell
            title="Subscription"
            subtitle="Plan, billing cycle, offers, and cloud-sync access"
            onBackPress={smartBack}
            contextChip={{ label: currentTier ?? 'FREE' }}
            scrollProps={{
                refreshControl: (
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            void Promise.all([refetchPlans(), refetchOffers()]);
                        }}
                    />
                ),
            }}
        >
            <SettingsHeroCard
                title={currentTier ? `${currentTier} Plan` : 'Subscription Control'}
                subtitle={
                    !planInGoodStanding && subscriptionStatus
                        ? `${subscriptionStatus} status is limiting cloud sync and premium modules until renewal.`
                        : livePaymentsEnabled
                            ? 'Live checkout is enabled for this build.'
                            : 'Mock checkout is enabled for this build.'
                }
                primaryLabel={subscriptionStatus ?? 'ACTIVE'}
                secondaryLabel={subscription?.cloudSyncAllowed ? 'Cloud sync on' : 'Cloud sync blocked'}
            />

            <SettingsSectionGroup
                title="Current access"
                subtitle="The active firm should make its sync and plan state obvious."
            >
                <SettingsFieldCard
                    icon="shield-check-outline"
                    title="Subscription health"
                    subtitle="Current tier, renewal state, and cloud feature access."
                >
                    <View style={s.statusRow}>
                        <SettingsStatusPill label={currentTier ?? 'FREE'} tone="info" />
                        <SettingsStatusPill
                            label={subscriptionStatus ?? 'ACTIVE'}
                            tone={planInGoodStanding ? 'success' : 'warning'}
                        />
                        <SettingsStatusPill
                            label={subscription?.cloudSyncAllowed ? 'Cloud sync allowed' : 'Cloud sync blocked'}
                            tone={subscription?.cloudSyncAllowed ? 'success' : 'warning'}
                        />
                    </View>
                    {subscription?.renewsAt ? (
                        <Text style={s.metaText}>
                            Renewal date: {new Date(subscription.renewsAt).toLocaleDateString('en-IN')}
                        </Text>
                    ) : null}
                    {!planInGoodStanding && subscriptionStatus ? (
                        <View style={[s.alertCard, getSurfaceStyle(colors, { accent: colors.warning, muted: true })]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.warning} />
                            <Text style={s.alertText}>
                                Local work can stay on device, but cloud-dependent features remain restricted until the plan becomes active again.
                            </Text>
                        </View>
                    ) : null}
                    {cacheStatusMessage ? (
                        <View style={[s.alertCard, getSurfaceStyle(colors, { accent: colors.info, muted: true })]}>
                            <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
                            <Text style={s.alertText}>{cacheStatusMessage}</Text>
                        </View>
                    ) : null}
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Billing setup"
                subtitle="Pick the cycle first, then configure checkout behavior."
            >
                <SettingsFieldCard
                    icon="calendar-sync-outline"
                    title="Billing cycle"
                    subtitle="Cycle filters change which plans appear below."
                >
                    <View style={s.chipWrap}>
                        {SUBSCRIPTION_BILLING_CYCLE_OPTIONS.map((option) => (
                            <ChipButton
                                key={option.key}
                                label={option.label}
                                selected={activeCycleTab === option.key}
                                tone="info"
                                onPress={() => setActiveCycleTab(option.key)}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>

                <SettingsFieldCard
                    icon={livePaymentsEnabled ? 'credit-card-check-outline' : 'test-tube'}
                    title="Checkout mode"
                    subtitle={livePaymentsEnabled ? 'Real checkout is enabled for this build.' : 'This build is using mock checkout responses.'}
                >
                    <View style={s.statusRow}>
                        <SettingsStatusPill
                            label={livePaymentsEnabled ? 'Live checkout' : 'Mock checkout'}
                            tone={livePaymentsEnabled ? 'success' : 'warning'}
                        />
                        {!canCheckout ? <SettingsStatusPill label="Role blocked" tone="warning" /> : null}
                    </View>
                    {!livePaymentsEnabled ? (
                        <View style={s.chipWrap}>
                            {SUBSCRIPTION_MOCK_OUTCOME_OPTIONS.map((option) => (
                                <ChipButton
                                    key={option.key}
                                    label={option.label}
                                    selected={mockOutcome === option.key}
                                    tone="info"
                                    onPress={() => setMockOutcome(option.key)}
                                />
                            ))}
                        </View>
                    ) : null}
                </SettingsFieldCard>

                <SettingsFieldCard
                    icon="ticket-percent-outline"
                    title="Discount code"
                    subtitle="Apply a code directly before starting checkout."
                >
                    <View style={s.discountRow}>
                        <AppInput
                            inputType="text"
                            value={discountCode}
                            onChangeText={setDiscountCode}
                            placeholder="Discount code"
                            autoCapitalize="characters"
                            containerStyle={s.discountInput}
                        />
                        <Pressable
                            style={[
                                s.actionButton,
                                { backgroundColor: colors.primary },
                                (!discountCode.trim() || isValidatingDiscount) ? s.actionButtonDisabled : null,
                            ]}
                            disabled={isValidatingDiscount || !discountCode.trim()}
                            onPress={handleApplyDiscount}
                        >
                            {isValidatingDiscount ? (
                                <ActivityIndicator size="small" color={colors.onPrimary} />
                            ) : (
                                <Text style={s.actionButtonText}>Apply</Text>
                            )}
                        </Pressable>
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            {offers.length > 0 ? (
                <SettingsSectionGroup
                    title="Offers"
                    subtitle="Active subscription cards and plan nudges from the platform."
                    action={<SettingsStatusPill label={`${offers.length} live`} tone="info" />}
                >
                    {offers.slice(0, 3).map((offer) => (
                        <Pressable
                            key={offer.id}
                            style={({ pressed }) => [
                                s.offerCard,
                                getSurfaceStyle(colors, { accent: colors.primary, muted: true }),
                                pressed ? { opacity: 0.92 } : null,
                            ]}
                            disabled={!offer.ctaRoute}
                            onPress={() => {
                                if (offer.ctaRoute) {
                                    void openOfferDestination(offer.ctaRoute);
                                }
                            }}
                        >
                            <View style={s.offerHeader}>
                                <View style={s.offerIcon}>
                                    <MaterialCommunityIcons name="bullhorn-outline" size={18} color={colors.primary} />
                                </View>
                                <View style={s.offerCopy}>
                                    <Text style={s.offerTitle}>{offer.title}</Text>
                                    <Text style={s.offerMessage}>{offer.message}</Text>
                                </View>
                            </View>
                            {(offer.ctaText || offer.ctaRoute) ? (
                                <Text style={s.offerCta}>
                                    {`${offer.ctaText ?? 'Open'}${offer.ctaRoute ? ' -> Tap to open' : ''}`}
                                </Text>
                            ) : null}
                        </Pressable>
                    ))}
                </SettingsSectionGroup>
            ) : null}

            <SettingsSectionGroup
                title="Plans"
                subtitle="Choose the plan that fits this business and billing cycle."
                action={<SettingsStatusPill label={`${visiblePlans.length} shown`} tone="info" />}
            >
                {loadingPlans ? (
                    <View style={s.centered}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : visiblePlans.length === 0 ? (
                    <View style={[s.emptyCard, getSurfaceStyle(colors, { muted: true })]}>
                        <MaterialCommunityIcons name="layers-search-outline" size={22} color={colors.textSecondary} />
                        <Text style={s.emptyTitle}>No plans found</Text>
                        <Text style={s.emptySubtitle}>
                            No subscription plans are available for the selected billing cycle.
                        </Text>
                    </View>
                ) : (
                    visiblePlans.map((plan) => {
                        const isCurrent = Boolean(currentTier && plan.tier === currentTier);
                        const isBusy = isStartingCheckout && selectedPlanId === plan.id;
                        const featureList = (plan.enabledFeatures ?? plan.features ?? []).slice(0, 6);

                        return (
                            <View
                                key={plan.id}
                                style={[
                                    s.planCard,
                                    getSurfaceStyle(colors, {
                                        accent: isCurrent ? colors.primary : undefined,
                                        elevated: true,
                                    }),
                                ]}
                            >
                                <View style={s.planHeader}>
                                    <View style={s.planCopy}>
                                        <View style={s.planTitleRow}>
                                            <Text style={s.planTitle}>{getPlanName(plan)}</Text>
                                            {isCurrent ? <SettingsStatusPill label="Current" tone="success" /> : null}
                                        </View>
                                        <Text style={s.planPrice}>{formatPlanPrice(plan)}</Text>
                                        {plan.description ? <Text style={s.planDescription}>{plan.description}</Text> : null}
                                        <Text style={s.planMeta}>
                                            {(plan.billingCycle ?? 'MONTHLY')} - {plan.id}
                                        </Text>
                                    </View>

                                    {isCurrent ? null : (
                                        <Pressable
                                            style={[
                                                s.actionButton,
                                                {
                                                    backgroundColor: canCheckout ? colors.primary : colors.border,
                                                },
                                                (!canCheckout || isBusy || isStartingCheckout) ? s.actionButtonDisabled : null,
                                            ]}
                                            disabled={isBusy || isStartingCheckout || !canCheckout}
                                            onPress={() => handleUpgrade(plan)}
                                        >
                                            {isBusy ? (
                                                <ActivityIndicator size="small" color={colors.onPrimary} />
                                            ) : (
                                                <Text style={s.actionButtonText}>Upgrade</Text>
                                            )}
                                        </Pressable>
                                    )}
                                </View>

                                {featureList.length > 0 ? (
                                    <View style={s.featuresWrap}>
                                        {featureList.map((feature) => (
                                            <View key={`${plan.id}-${feature}`} style={s.featureRow}>
                                                <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.primary} />
                                                <Text style={s.featureText}>{feature}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })
                )}
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Related pages"
                subtitle="Operational routing stays explicit from subscription state into diagnostics."
            >
                <SettingsLinkRow
                    icon="cloud-sync-outline"
                    title="Sync diagnostics"
                    subtitle="Check queue health, blocked items, and connectivity."
                    onPress={() => router.push('/(main)/settings/sync' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="domain-switch"
                    title="Switch business"
                    subtitle="Move to another firm without leaving the new settings flow."
                    onPress={() => router.push('/(auth)/business-select' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>

            {lastCheckoutIntentId ? (
                <Text style={s.intentMeta}>Last checkout intent: {lastCheckoutIntentId}</Text>
            ) : null}
        </SettingsPageShell>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        statusRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        metaText: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        alertCard: {
            borderRadius: Radius.card,
            paddingHorizontal: DESIGN_SPACING.cardGap,
            paddingVertical: DESIGN_SPACING.cardGap,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.sm,
        },
        alertText: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '600',
        },
        chipWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
        },
        discountRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.sm,
        },
        discountInput: {
            flex: 1,
        },
        actionButton: {
            ...getPillStyle(colors, colors.primary),
            minHeight: 44,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 88,
        },
        actionButtonDisabled: {
            opacity: 0.6,
        },
        actionButtonText: {
            color: colors.onPrimary,
            fontSize: Typography.caption.size,
            fontWeight: '800',
        },
        offerCard: {
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.cardGap,
            gap: Spacing.sm,
        },
        offerHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.md,
        },
        offerIcon: {
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(colors.primary, colors.isDark ? '24' : '12'),
        },
        offerCopy: {
            flex: 1,
            gap: 4,
        },
        offerTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        offerMessage: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        offerCta: {
            color: colors.primary,
            fontSize: Typography.caption.size,
            fontWeight: '800',
        },
        centered: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 32,
        },
        emptyCard: {
            alignItems: 'center',
            gap: Spacing.xs,
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.sectionGap,
        },
        emptyTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        emptySubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
            textAlign: 'center',
        },
        planCard: {
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.cardGap,
            gap: Spacing.sm,
        },
        planHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.sm,
        },
        planCopy: {
            flex: 1,
            gap: 4,
        },
        planTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        planTitle: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '800',
        },
        planPrice: {
            color: colors.primary,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        planDescription: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        planMeta: {
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: '700',
        },
        featuresWrap: {
            gap: 6,
        },
        featureRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        featureText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        intentMeta: {
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: '700',
            textAlign: 'center',
        },
    });
