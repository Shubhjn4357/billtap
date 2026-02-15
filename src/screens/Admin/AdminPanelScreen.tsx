import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Chip, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';
import { adminService } from '../../api/adminService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ADMIN_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans';
import { useAnalyticsFunnel } from '../../hooks/useAnalyticsFunnel';
import type { MarketingOffer, SubscriptionPlan, SubscriptionStatus, UserProfile, UserRole } from '../../types';
import { addMonths, toDateSafe } from '../../utils/date';
import { formatCurrency, formatDate } from '../../utils/formatters';

type AdminTab = 'users' | 'plans' | 'offers';

const buildNextMonthEnd = (startDate: Date) => addMonths(startDate, 1);

const roleLabel = (role: UserRole | undefined) => (role ?? 'owner').toUpperCase();

export const AdminPanelScreen = () => {
    const theme = useTheme();
    const {
        metrics,
        loading: analyticsLoading,
        error: analyticsError,
        fetchFunnelData,
    } = useAnalyticsFunnel(30);

    const [tab, setTab] = useState<AdminTab>('users');
    const [loading, setLoading] = useState(false);
    const [accessLoading, setAccessLoading] = useState(true);
    const [canAccess, setCanAccess] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [offers, setOffers] = useState<MarketingOffer[]>([]);
    const [offerLoading, setOfferLoading] = useState(false);

    const [offerForm, setOfferForm] = useState({
        title: '',
        message: '',
        bannerUrl: '',
        bannerBackground: '#E8DEF8',
        ctaText: 'View Plan',
        ctaRoute: '/subscription',
        audience: 'all' as MarketingOffer['audience'],
        priority: '10',
        isActive: true,
    });

    const [planDrafts, setPlanDrafts] = useState<Record<string, SubscriptionPlan>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedUsers, fetchedPlans, fetchedOffers] = await Promise.all([
                adminService.getUsers(500),
                adminService.getPlans(true),
                adminService.getOffers(true),
            ]);

            const mergedPlans = fetchedPlans.length > 0 ? fetchedPlans : DEFAULT_SUBSCRIPTION_PLANS;
            setUsers(fetchedUsers);
            setPlans(mergedPlans);
            setOffers(fetchedOffers);
            setPlanDrafts(
                Object.fromEntries(mergedPlans.map((plan) => [plan.id, { ...plan }]))
            );
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.loadAdminFailed);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const verifyAccess = async () => {
            setAccessLoading(true);
            try {
                const access = await adminService.getAccess();
                setCanAccess(access.canAccess);
            } catch {
                setCanAccess(false);
            } finally {
                setAccessLoading(false);
            }
        };
        void verifyAccess();
    }, []);

    useEffect(() => {
        if (!canAccess) return;
        void loadData();
    }, [canAccess, loadData]);

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return users;

        return users.filter((entry) =>
            entry.uid.toLowerCase().includes(query) ||
            (entry.displayName ?? '').toLowerCase().includes(query) ||
            (entry.email ?? '').toLowerCase().includes(query) ||
            (entry.businessName ?? '').toLowerCase().includes(query)
        );
    }, [searchQuery, users]);

    const activeGrowthPlan = useMemo(() => {
        return plans.find((plan) => plan.id === 'growth' && plan.isActive) ?? plans.find((plan) => plan.isActive) ?? null;
    }, [plans]);

    const updateUserList = (uid: string, payload: Partial<UserProfile>) => {
        setUsers((current) =>
            current.map((entry) => (entry.uid === uid ? { ...entry, ...payload } : entry))
        );
    };

    const handleRoleUpdate = async (targetUser: UserProfile, role: UserRole) => {
        try {
            await adminService.updateUserRole(targetUser.uid, role);
            updateUserList(targetUser.uid, { role });
            Alert.alert(COMMON_TEXT.alerts.saved, ADMIN_TEXT.alerts.roleUpdated(role));
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.roleUpdateFailed);
        }
    };

    const handleActivateSubscription = async (targetUser: UserProfile) => {
        if (!activeGrowthPlan) {
            Alert.alert(ADMIN_TEXT.alerts.noPlanTitle, ADMIN_TEXT.alerts.noPlanBody);
            return;
        }

        const startsAt = new Date();
        const endsAt = buildNextMonthEnd(startsAt);

        const payload: Partial<UserProfile> = {
            subscriptionStatus: 'active',
            subscriptionPlanId: activeGrowthPlan.id,
            subscriptionPlanName: activeGrowthPlan.name,
            subscriptionAmountMonthly: activeGrowthPlan.monthlyPrice,
            subscriptionCurrency: activeGrowthPlan.currency,
            subscriptionStartsAt: startsAt,
            subscriptionEndsAt: endsAt,
        };

        try {
            await adminService.updateUser(targetUser.uid, payload);
            updateUserList(targetUser.uid, payload);
            Alert.alert(
                ADMIN_TEXT.alerts.subscriptionUpdatedTitle,
                ADMIN_TEXT.alerts.subscriptionUpdatedBody(targetUser.displayName ?? COMMON_TEXT.labels.none)
            );
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.activateSubscriptionFailed);
        }
    };

    const handleSetSubscriptionStatus = async (targetUser: UserProfile, status: SubscriptionStatus) => {
        const payload: Partial<UserProfile> = {
            subscriptionStatus: status,
        };
        if (status !== 'active') {
            payload.subscriptionEndsAt = new Date();
        }

        try {
            await adminService.updateUser(targetUser.uid, payload);
            updateUserList(targetUser.uid, payload);
            Alert.alert(COMMON_TEXT.alerts.saved, ADMIN_TEXT.alerts.subscriptionStatusUpdated(status));
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.subscriptionStatusFailed);
        }
    };

    const handlePlanFieldChange = (planId: string, updates: Partial<SubscriptionPlan>) => {
        setPlanDrafts((current) => ({
            ...current,
            [planId]: {
                ...(current[planId] ?? plans.find((plan) => plan.id === planId)!),
                ...updates,
            },
        }));
    };

    const handleSavePlan = async (planId: string) => {
        const draft = planDrafts[planId];
        if (!draft) return;

        if (!draft.name.trim()) {
            Alert.alert(COMMON_TEXT.alerts.validation, ADMIN_TEXT.alerts.planNameRequired);
            return;
        }
        if (Number.isNaN(Number(draft.monthlyPrice)) || Number(draft.monthlyPrice) < 0) {
            Alert.alert(COMMON_TEXT.alerts.validation, ADMIN_TEXT.alerts.monthlyPriceInvalid);
            return;
        }

        const normalized: SubscriptionPlan = {
            ...draft,
            name: draft.name.trim(),
            description: draft.description.trim(),
            monthlyPrice: Number(draft.monthlyPrice),
            currency: draft.currency.trim().toUpperCase(),
            displayOrder: Number(draft.displayOrder) || 0,
            features: draft.features.map((feature) => feature.trim()).filter(Boolean),
        };

        try {
            await adminService.upsertPlan(normalized);
            setPlans((current) =>
                current
                    .map((plan) => (plan.id === normalized.id ? normalized : plan))
                    .sort((a, b) => a.displayOrder - b.displayOrder)
            );
            setPlanDrafts((current) => ({ ...current, [normalized.id]: normalized }));
            Alert.alert(COMMON_TEXT.alerts.saved, ADMIN_TEXT.alerts.planUpdated(normalized.name));
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.savePlanFailed);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        try {
            await adminService.deletePlan(planId);
            setPlans((current) => current.filter((plan) => plan.id !== planId));
            setPlanDrafts((current) => {
                const copy = { ...current };
                delete copy[planId];
                return copy;
            });
            Alert.alert(COMMON_TEXT.alerts.saved, 'Plan deleted.');
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to delete plan.');
        }
    };

    const handleCreateOffer = async () => {
        if (!offerForm.title.trim() || !offerForm.message.trim()) {
            Alert.alert(COMMON_TEXT.alerts.validation, ADMIN_TEXT.alerts.offerTitleMessageRequired);
            return;
        }

        const priority = Number(offerForm.priority);
        if (Number.isNaN(priority)) {
            Alert.alert(COMMON_TEXT.alerts.validation, ADMIN_TEXT.alerts.offerPriorityInvalid);
            return;
        }

        const offer: MarketingOffer = {
            id: `offer_${Date.now()}`,
            title: offerForm.title.trim(),
            message: offerForm.message.trim(),
            bannerUrl: offerForm.bannerUrl.trim() || undefined,
            bannerBackground: offerForm.bannerBackground.trim() || undefined,
            ctaText: offerForm.ctaText.trim() || undefined,
            ctaRoute: offerForm.ctaRoute.trim() || undefined,
            audience: offerForm.audience,
            isActive: offerForm.isActive,
            priority,
            startsAt: new Date(),
        };

        setOfferLoading(true);
        try {
            await adminService.upsertOffer(offer);
            setOffers((current) => [offer, ...current].sort((a, b) => b.priority - a.priority));
            setOfferForm({
                title: '',
                message: '',
                bannerUrl: '',
                bannerBackground: '#E8DEF8',
                ctaText: 'View Plan',
                ctaRoute: '/subscription',
                audience: 'all',
                priority: '10',
                isActive: true,
            });
            Alert.alert(ADMIN_TEXT.alerts.offerCreatedTitle, ADMIN_TEXT.alerts.offerCreatedBody);
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.createOfferFailed);
        } finally {
            setOfferLoading(false);
        }
    };

    const handleToggleOffer = async (offer: MarketingOffer, nextState: boolean) => {
        try {
            await adminService.setOfferActive(offer.id, nextState);
            setOffers((current) =>
                current.map((entry) => (entry.id === offer.id ? { ...entry, isActive: nextState } : entry))
            );
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : ADMIN_TEXT.alerts.offerToggleFailed);
        }
    };

    const handleDeleteOffer = async (offerId: string) => {
        try {
            await adminService.deleteOffer(offerId);
            setOffers((current) => current.filter((entry) => entry.id !== offerId));
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to delete offer.');
        }
    };

    const handleDeleteUser = async (uid: string) => {
        try {
            await adminService.deleteUser(uid);
            setUsers((current) => current.filter((entry) => entry.uid !== uid));
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to delete user.');
        }
    };

    if (accessLoading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text variant="bodyLarge">Verifying admin access...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    if (!canAccess) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
                        {ADMIN_TEXT.accessRequiredTitle}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8 }}>
                        {ADMIN_TEXT.accessRequiredBody}
                    </Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 110, paddingTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
                            {ADMIN_TEXT.title}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            {ADMIN_TEXT.subtitle}
                        </Text>
                    </View>
                    <AppButton
                        mode="outlined"
                        compact
                        onPress={() => {
                            void loadData();
                            void fetchFunnelData();
                        }}
                        loading={loading || analyticsLoading}
                    >
                        {ADMIN_TEXT.refresh}
                    </AppButton>
                </View>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        {ADMIN_TEXT.salesFunnelTitle}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text variant="bodySmall">{ADMIN_TEXT.salesFunnel.views}: {metrics.views}</Text>
                        <Text variant="bodySmall">{ADMIN_TEXT.salesFunnel.planSelects}: {metrics.planSelects}</Text>
                        <Text variant="bodySmall">{ADMIN_TEXT.salesFunnel.checkoutStart}: {metrics.checkoutsStarted}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text variant="bodySmall">{ADMIN_TEXT.salesFunnel.redirected}: {metrics.redirects}</Text>
                        <Text variant="bodySmall">{ADMIN_TEXT.salesFunnel.success}: {metrics.successes}</Text>
                        <Text variant="bodySmall">{ADMIN_TEXT.salesFunnel.failed}: {metrics.failures}</Text>
                    </View>
                    <View style={{ marginTop: 8 }}>
                        <Text variant="bodySmall">
                            {ADMIN_TEXT.salesFunnel.viewToPlan}: {(metrics.viewToPlanRate * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodySmall">
                            {ADMIN_TEXT.salesFunnel.planToCheckout}: {(metrics.planToCheckoutRate * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodySmall">
                            {ADMIN_TEXT.salesFunnel.checkoutToSuccess}: {(metrics.checkoutToSuccessRate * 100).toFixed(1)}%
                        </Text>
                        <Text variant="bodySmall" style={{ fontWeight: '700' }}>
                            {ADMIN_TEXT.salesFunnel.overall}: {(metrics.overallConversionRate * 100).toFixed(1)}%
                        </Text>
                    </View>
                    {analyticsError && (
                        <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
                            {analyticsError}
                        </Text>
                    )}
                </AppCard>

                <SegmentedButtons
                    value={tab}
                    onValueChange={(value) => setTab(value as AdminTab)}
                    style={{ marginTop: 12, marginBottom: 14 }}
                    buttons={[
                        { value: 'users', label: ADMIN_TEXT.tabs.users },
                        { value: 'plans', label: ADMIN_TEXT.tabs.plans },
                        { value: 'offers', label: ADMIN_TEXT.tabs.offers },
                    ]}
                />

                {tab === 'users' && (
                    <View>
                        <AppInput
                            label={ADMIN_TEXT.users.searchLabel}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 10 }}>
                            {filteredUsers.length} {ADMIN_TEXT.users.countSuffix}
                        </Text>

                        {filteredUsers.map((entry) => {
                            const expiryDate = toDateSafe(entry.subscriptionEndsAt);
                            return (
                                <AppCard key={entry.uid}>
                                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                                        {entry.displayName || entry.businessName || entry.email || entry.uid}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                        {entry.email ?? entry.phoneNumber ?? entry.uid}
                                    </Text>

                                    <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                                        <Chip compact style={{ marginRight: 8 }}>{roleLabel(entry.role)}</Chip>
                                        <Chip compact>
                                            {(entry.subscriptionStatus ?? 'inactive').toUpperCase()}
                                        </Chip>
                                    </View>

                                    <Text variant="bodySmall" style={{ marginTop: 8 }}>
                                        {ADMIN_TEXT.users.planLabel}: {entry.subscriptionPlanName ?? COMMON_TEXT.labels.none}
                                    </Text>
                                    <Text variant="bodySmall">
                                        {ADMIN_TEXT.users.validUntilLabel}: {expiryDate ? formatDate(expiryDate) : '-'}
                                    </Text>

                                    <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' }}>
                                        <AppButton mode="outlined" compact style={{ marginRight: 8, marginBottom: 8 }} onPress={() => { void handleRoleUpdate(entry, 'admin'); }}>
                                            {ADMIN_TEXT.users.makeAdmin}
                                        </AppButton>
                                        <AppButton mode="outlined" compact style={{ marginRight: 8, marginBottom: 8 }} onPress={() => { void handleRoleUpdate(entry, 'owner'); }}>
                                            {ADMIN_TEXT.users.makeOwner}
                                        </AppButton>
                                        <AppButton mode="contained" compact style={{ marginRight: 8, marginBottom: 8 }} onPress={() => { void handleActivateSubscription(entry); }}>
                                            {ADMIN_TEXT.users.activatePlan}
                                        </AppButton>
                                        <AppButton mode="outlined" compact style={{ marginBottom: 8 }} onPress={() => { void handleSetSubscriptionStatus(entry, 'expired'); }}>
                                            {ADMIN_TEXT.users.expire}
                                        </AppButton>
                                        <AppButton mode="outlined" compact style={{ marginLeft: 8, marginBottom: 8 }} onPress={() => { void handleDeleteUser(entry.uid); }}>
                                            Delete User
                                        </AppButton>
                                    </View>
                                </AppCard>
                            );
                        })}
                    </View>
                )}

                {tab === 'plans' && (
                    <View>
                        {plans.map((plan) => {
                            const draft = planDrafts[plan.id] ?? plan;
                            return (
                                <AppCard key={plan.id}>
                                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>{plan.id.toUpperCase()}</Text>
                                    <AppInput
                                        label={ADMIN_TEXT.plans.planName}
                                        value={draft.name}
                                        onChangeText={(value) => handlePlanFieldChange(plan.id, { name: value })}
                                    />
                                    <AppInput
                                        label={ADMIN_TEXT.plans.description}
                                        value={draft.description}
                                        onChangeText={(value) => handlePlanFieldChange(plan.id, { description: value })}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <AppInput
                                            label={ADMIN_TEXT.plans.monthlyPrice}
                                            keyboardType="numeric"
                                            value={String(draft.monthlyPrice)}
                                            onChangeText={(value) =>
                                                handlePlanFieldChange(plan.id, { monthlyPrice: Number(value || 0) })
                                            }
                                            style={{ flex: 1 }}
                                        />
                                        <AppInput
                                            label={ADMIN_TEXT.plans.currency}
                                            value={draft.currency}
                                            onChangeText={(value) => handlePlanFieldChange(plan.id, { currency: value.toUpperCase() })}
                                            style={{ flex: 1 }}
                                        />
                                    </View>
                                    <AppInput
                                        label={ADMIN_TEXT.plans.features}
                                        value={draft.features.join(', ')}
                                        onChangeText={(value) =>
                                            handlePlanFieldChange(plan.id, {
                                                features: value.split(',').map((entry) => entry.trim()).filter(Boolean),
                                            })
                                        }
                                    />
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                        <Text variant="bodySmall">
                                            {ADMIN_TEXT.plans.active}: {draft.isActive ? COMMON_TEXT.labels.yes : COMMON_TEXT.labels.no} | {ADMIN_TEXT.plans.currentPrice}: {formatCurrency(draft.monthlyPrice, draft.currency)}
                                        </Text>
                                        <Switch
                                            value={draft.isActive}
                                            onValueChange={(enabled) => handlePlanFieldChange(plan.id, { isActive: enabled })}
                                        />
                                    </View>
                                    <AppButton mode="contained" style={{ marginTop: 10 }} onPress={() => { void handleSavePlan(plan.id); }}>
                                        {ADMIN_TEXT.plans.savePlan}
                                    </AppButton>
                                    <AppButton mode="outlined" style={{ marginTop: 8 }} onPress={() => { void handleDeletePlan(plan.id); }}>
                                        Delete Plan
                                    </AppButton>
                                </AppCard>
                            );
                        })}
                    </View>
                )}

                {tab === 'offers' && (
                    <View>
                        <AppCard>
                            <Text variant="titleMedium" style={{ fontWeight: '700' }}>{ADMIN_TEXT.offers.createTitle}</Text>
                            <AppInput
                                label={ADMIN_TEXT.offers.title}
                                value={offerForm.title}
                                onChangeText={(value) => setOfferForm((current) => ({ ...current, title: value }))}
                            />
                            <AppInput
                                label={ADMIN_TEXT.offers.message}
                                value={offerForm.message}
                                onChangeText={(value) => setOfferForm((current) => ({ ...current, message: value }))}
                            />
                            <AppInput
                                label={ADMIN_TEXT.offers.bannerImage}
                                value={offerForm.bannerUrl}
                                onChangeText={(value) => setOfferForm((current) => ({ ...current, bannerUrl: value }))}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <AppInput
                                    label={ADMIN_TEXT.offers.bannerColor}
                                    value={offerForm.bannerBackground}
                                    onChangeText={(value) => setOfferForm((current) => ({ ...current, bannerBackground: value }))}
                                    style={{ flex: 1 }}
                                />
                                <AppInput
                                    label={ADMIN_TEXT.offers.priority}
                                    keyboardType="numeric"
                                    value={offerForm.priority}
                                    onChangeText={(value) => setOfferForm((current) => ({ ...current, priority: value }))}
                                    style={{ flex: 1 }}
                                />
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <AppInput
                                    label={ADMIN_TEXT.offers.ctaText}
                                    value={offerForm.ctaText}
                                    onChangeText={(value) => setOfferForm((current) => ({ ...current, ctaText: value }))}
                                    style={{ flex: 1 }}
                                />
                                <AppInput
                                    label={ADMIN_TEXT.offers.ctaRoute}
                                    value={offerForm.ctaRoute}
                                    onChangeText={(value) => setOfferForm((current) => ({ ...current, ctaRoute: value }))}
                                    style={{ flex: 1 }}
                                />
                            </View>
                            <SegmentedButtons
                                value={offerForm.audience}
                                onValueChange={(value) =>
                                    setOfferForm((current) => ({ ...current, audience: value as MarketingOffer['audience'] }))
                                }
                                style={{ marginTop: 4 }}
                                buttons={[
                                    { value: 'all', label: 'All' },
                                    { value: 'active_subscribers', label: 'Active' },
                                    { value: 'inactive_subscribers', label: 'Inactive' },
                                ]}
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                <Text variant="bodySmall" style={{ marginRight: 8 }}>
                                    {ADMIN_TEXT.offers.publishNow}
                                </Text>
                                <Switch
                                    value={offerForm.isActive}
                                    onValueChange={(enabled) => setOfferForm((current) => ({ ...current, isActive: enabled }))}
                                />
                            </View>
                            <AppButton
                                mode="contained"
                                style={{ marginTop: 10 }}
                                onPress={() => { void handleCreateOffer(); }}
                                loading={offerLoading}
                            >
                                {ADMIN_TEXT.offers.createOffer}
                            </AppButton>
                        </AppCard>

                        {offers.map((offer) => (
                            <AppCard key={offer.id}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                                            {offer.title}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                            {offer.message}
                                        </Text>
                                        <Text variant="bodySmall" style={{ marginTop: 6 }}>
                                            {ADMIN_TEXT.offers.audience}: {offer.audience} | {ADMIN_TEXT.offers.priority}: {offer.priority}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={offer.isActive}
                                        onValueChange={(enabled) => { void handleToggleOffer(offer, enabled); }}
                                    />
                                </View>
                                <AppButton mode="outlined" style={{ marginTop: 10 }} onPress={() => { void handleDeleteOffer(offer.id); }}>
                                    Delete Offer
                                </AppButton>
                            </AppCard>
                        ))}
                    </View>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

