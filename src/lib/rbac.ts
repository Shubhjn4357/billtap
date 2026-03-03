export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY_ADMIN';

type SessionLike = {
    adminRole?: string | null;
};

export const normalizeAdminRole = (session: SessionLike | null | undefined): AdminRole => {
    const value = session?.adminRole;
    if (value === 'SUPPORT_ADMIN' || value === 'READ_ONLY_ADMIN') return value;
    return 'SUPER_ADMIN';
};

const isRoute = (pathname: string, route: string) =>
    pathname === route || pathname.startsWith(`${route}/`);

export const isRouteAllowedForRole = (role: AdminRole, pathname: string): boolean => {
    if (role === 'SUPER_ADMIN') return true;

    if (role === 'SUPPORT_ADMIN') {
        const restricted = ['/subscriptions', '/discounts', '/feature-flags'];
        return !restricted.some((entry) => isRoute(pathname, entry));
    }

    const readOnlyRoutes = [
        '/dashboard',
        '/analytics',
        '/audit-logs',
        '/live',
        '/notifications/deliveries',
    ];
    return readOnlyRoutes.some((entry) => isRoute(pathname, entry));
};

export const canWriteForRole = (role: AdminRole) => role !== 'READ_ONLY_ADMIN';
export const canManagePricingForRole = (role: AdminRole) => role === 'SUPER_ADMIN';

