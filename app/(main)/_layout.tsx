import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { businessSuiteService } from '../../src/api/businessSuiteService';
import { ApiError } from '../../src/api/httpClient';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { useOrganizationStore, useUiFeedbackStore, useUserStore } from '../../src/store';

const shallowEqualRecord = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }
    return true;
};

export default function MainLayout() {
    const router = useRouter();
    const user = useUserStore((state) => state.user);
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const userHydrated = useUserStore((state) => state.hasHydrated);
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const setSelectedOrganizationId = useOrganizationStore((state) => state.setSelectedOrganizationId);
    const setOrganizationContext = useOrganizationStore((state) => state.setOrganizationContext);
    const clearOrganizationContext = useOrganizationStore((state) => state.clearOrganizationContext);
    const segments = useSegments() as string[];
    const lastContextSyncRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
    const userId = user?.uid ?? null;
    const currentSegment = segments[1]; // segments[0] is '(main)'
    const {
        canViewDashboard,
        canManageInventory,
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canViewReports,
        canAccessSettings,
        canManageSubscription,
        canSendMessages,
        canManageTemplates,
        canManageBusinessCards,
        canAccessAccounting,
        canAccessOperations,
        canAccessBusinessSuite,
    } = useOrganizationAccess();
    const canUseBillingModule = canOpenBilling && (canCreateSale || canCreatePurchase);

    const fallbackMainRoute = useMemo(() => {
        if (canViewDashboard) return '/(main)/(tabs)/home';
        if (canManageInventory) return '/(main)/(tabs)/stock';
        if (canUseBillingModule) return '/(main)/(tabs)/billing';
        if (canViewReports) return '/(main)/(tabs)/reports';
        if (canAccessSettings) return '/(main)/(tabs)/settings';
        return '/(main)/profile';
    }, [
        canAccessSettings,
        canManageInventory,
        canUseBillingModule,
        canViewDashboard,
        canViewReports,
    ]);

    const moduleRouteBlocked = useMemo(() => {
        const mainGroupIndex = segments.indexOf('(main)');
        const route = mainGroupIndex >= 0 ? segments[mainGroupIndex + 1] : null;
        const nestedRoute = mainGroupIndex >= 0 ? segments[mainGroupIndex + 2] : null;

        if (!route) return false;
        if (route === 'business-setup' || route === 'phone-setup' || route === 'profile' || route === 'org-select' || route === 'org-create') {
            return false;
        }

        if (route === '(tabs)') {
            if (nestedRoute === 'home') return !canViewDashboard;
            if (nestedRoute === 'stock') return !canManageInventory;
            if (nestedRoute === 'billing') return !canUseBillingModule;
            if (nestedRoute === 'reports') return !canViewReports;
            if (nestedRoute === 'settings') return !canAccessSettings;
            return false;
        }

        if (route === 'subscription') return !canManageSubscription;
        if (route === 'operations') return !canAccessOperations;
        if (route === 'accounting') return !canAccessAccounting;
        if (route === 'business-suite') return !canAccessBusinessSuite;
        if (route === 'business-suite-template') return !(canAccessBusinessSuite && canManageTemplates);
        if (route === 'business-suite-business-card') return !(canAccessBusinessSuite && canManageBusinessCards);
        if (route === 'item') return !canManageInventory;
        if (route === 'bill') return !(canUseBillingModule || canViewReports);
        if (route === 'categories') return !canManageInventory;
        if (route === 'notifications') return !canSendMessages;

        return false;
    }, [
        canAccessAccounting,
        canAccessBusinessSuite,
        canAccessOperations,
        canAccessSettings,
        canManageBusinessCards,
        canManageInventory,
        canManageSubscription,
        canManageTemplates,
        canSendMessages,
        canUseBillingModule,
        canViewDashboard,
        canViewReports,
        segments,
    ]);

    useEffect(() => {
        if (!moduleRouteBlocked) return;
        useUiFeedbackStore.getState().showToast('This module is disabled in organization settings.');
        router.replace(fallbackMainRoute as any);
    }, [fallbackMainRoute, moduleRouteBlocked, router]);

    useEffect(() => {
        let cancelled = false;
        if (!isAuthenticated || !userId) {
            clearOrganizationContext();
            return () => {
                cancelled = true;
            };
        }

        const syncOrganizationContext = async () => {
            const syncKey = `${userId}:${selectedOrganizationId ?? 'auto'}`;
            const now = Date.now();
            const recentlySynced =
                lastContextSyncRef.current.key === syncKey &&
                now - lastContextSyncRef.current.at < 15_000;

            if (recentlySynced) {
                return;
            }

            try {
                const payload = await businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined);
                if (cancelled) return;
                lastContextSyncRef.current = { key: syncKey, at: Date.now() };

                if (payload.organization.id !== selectedOrganizationId) {
                    setSelectedOrganizationId(payload.organization.id);
                }

                const nextContext = {
                    role: payload.context.role,
                    ownerUserId: payload.context.ownerUserId,
                    permissions: payload.context.permissions as Record<string, boolean>,
                    settings: payload.context.settings,
                };
                const currentContext = useOrganizationStore.getState().context;
                const sameContext =
                    currentContext.role === nextContext.role &&
                    currentContext.ownerUserId === nextContext.ownerUserId &&
                    shallowEqualRecord(currentContext.permissions, nextContext.permissions) &&
                    shallowEqualRecord(currentContext.settings, nextContext.settings as Record<string, unknown>);

                if (!sameContext) {
                    setOrganizationContext(nextContext);
                }
            } catch (error: unknown) {
                const status = error instanceof ApiError ? error.status : null;
                const hasRequestedOrganization = Boolean(selectedOrganizationId);
                const shouldRetryWithoutSelection = hasRequestedOrganization && (status === 403 || status === 404);

                if (shouldRetryWithoutSelection) {
                    try {
                        const fallbackPayload = await businessSuiteService.getCurrentOrganization(undefined);
                        if (cancelled) return;

                        setSelectedOrganizationId(fallbackPayload.organization.id);
                        const fallbackContext = {
                            role: fallbackPayload.context.role,
                            ownerUserId: fallbackPayload.context.ownerUserId,
                            permissions: fallbackPayload.context.permissions as Record<string, boolean>,
                            settings: fallbackPayload.context.settings,
                        };
                        const currentContext = useOrganizationStore.getState().context;
                        const sameContext =
                            currentContext.role === fallbackContext.role &&
                            currentContext.ownerUserId === fallbackContext.ownerUserId &&
                            shallowEqualRecord(currentContext.permissions, fallbackContext.permissions) &&
                            shallowEqualRecord(currentContext.settings, fallbackContext.settings as Record<string, unknown>);
                        if (!sameContext) {
                            setOrganizationContext(fallbackContext);
                        }
                        return;
                    } catch {
                        // Fall through to context reset below.
                    }
                }

                if (!cancelled) {
                    if (status === 403 || status === 404) {
                        setSelectedOrganizationId(null);
                        clearOrganizationContext();
                        return;
                    }

                    if (!selectedOrganizationId) {
                        try {
                            const cachedOrganizations = await businessSuiteService.getMyOrganizations();
                            const fallbackOrganizationId = cachedOrganizations[0]?.id;
                            if (fallbackOrganizationId) {
                                setSelectedOrganizationId(fallbackOrganizationId);
                            }
                        } catch {
                            // Keep current fallback behavior below when org list cache is unavailable.
                        }
                    }

                    // Preserve local context on transient/offline failures so access checks
                    // do not collapse into "access denied" while the network is flaky.
                    const currentContext = useOrganizationStore.getState().context;
                    const hasLocalContext =
                        currentContext.role !== null
                        || Object.keys(currentContext.permissions).length > 0
                        || Object.keys(currentContext.settings).length > 0;

                    if (!hasLocalContext && userId) {
                        const fallbackRole = user?.role === 'staff' ? 'salesman' : 'owner';
                        setOrganizationContext({
                            role: fallbackRole,
                            ownerUserId: userId,
                            permissions: {},
                            settings: {},
                        });
                    }
                }
            }
        };

        void syncOrganizationContext();

        return () => {
            cancelled = true;
        };
    }, [
        clearOrganizationContext,
        isAuthenticated,
        selectedOrganizationId,
        setOrganizationContext,
        setSelectedOrganizationId,
        user?.role,
        userId,
    ]);

    if (!userHydrated) {
        return <LoadingScreen message="Loading application..." />;
    }

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    if (!user?.businessName && currentSegment !== 'business-setup') {
        return <Redirect href="/(main)/business-setup" />;
    }

    if (user?.businessName && !user?.phoneNumber && currentSegment !== 'phone-setup') {
        // Enforce phone number linking after business setup
        return <Redirect href={"/(main)/phone-setup" as any} />;
    }

    if (moduleRouteBlocked) {
        return null;
    }

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="business-setup" options={{ headerShown: true, title: 'Business Setup' }} />
            <Stack.Screen name="phone-setup" options={{ headerShown: true, title: 'Verify Phone', headerBackVisible: false }} />
            <Stack.Screen name="subscription" options={{ headerShown: true, title: 'Subscription' }} />
            <Stack.Screen name="operations" options={{ headerShown: true, title: 'Operations Controls' }} />
            <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile Setup' }} />
            <Stack.Screen name="accounting" options={{ headerShown: false }} />
            <Stack.Screen name="business-suite" options={{ headerShown: true, title: 'Business Suite' }} />
            <Stack.Screen name="business-suite-template" options={{ headerShown: true, title: 'Template Studio' }} />
            <Stack.Screen name="business-suite-business-card" options={{ headerShown: true, title: 'Business Card Studio' }} />
            <Stack.Screen name="item/new" options={{ headerShown: true, title: 'Add Item' }} />
            <Stack.Screen name="item/[id]" options={{ headerShown: true, title: 'Item Details' }} />
            <Stack.Screen name="bill/[id]" options={{ headerShown: true, title: 'Bill' }} />
            <Stack.Screen name="scan" options={{ title: 'Scan Barcode' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="categories" options={{ headerShown: true, title: 'Manage Categories' }} />
            <Stack.Screen name="org-select" options={{ headerShown: true, title: 'Switch Organization' }} />
            <Stack.Screen name="org-create" options={{ headerShown: true, title: 'Create Organization' }} />
        </Stack>
    );
}
