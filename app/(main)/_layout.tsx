import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { businessSuiteService } from '../../src/api/businessSuiteService';
import { ApiError } from '../../src/api/httpClient';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';
import { useOrganizationStore, useUserStore } from '../../src/store';

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

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="business-setup" options={{ headerShown: true, title: 'Business Setup' }} />
            <Stack.Screen name="subscription" options={{ headerShown: true, title: 'Subscription' }} />
            <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin Panel' }} />
            <Stack.Screen name="operations" options={{ headerShown: true, title: 'Operations Controls' }} />
            <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile Setup' }} />
            <Stack.Screen name="accounting/index" options={{ headerShown: false }} />
            <Stack.Screen name="business-suite" options={{ headerShown: true, title: 'Business Suite' }} />
            <Stack.Screen name="business-suite-template" options={{ headerShown: true, title: 'Template Studio' }} />
            <Stack.Screen name="business-suite-business-card" options={{ headerShown: true, title: 'Business Card Studio' }} />
            <Stack.Screen name="item/new" options={{ headerShown: true, title: 'Add Item' }} />
            <Stack.Screen name="item/[id]" options={{ headerShown: true, title: 'Item Details' }} />
            <Stack.Screen name="scan" options={{ title: 'Scan Barcode' }} />
        </Stack>
    );
}
