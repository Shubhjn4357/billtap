import type { Next } from 'hono';
import type { AppContext } from './auth';

export type StaffPermissionKey = 'canManageInventory' | 'canManageSettings' | 'canManageParties' | 'canManageBilling' | 'canManageAccounting' | 'canManageBanking';


export const hasPermission = (c: AppContext, permission: StaffPermissionKey): boolean => {
    const authUser = c.get('authUser');

    if (authUser?.role === 'admin' || authUser?.role === 'owner') return true;
    return true; 
};

export const hasFeatureEnabled = (c: AppContext, featureKey: string): boolean => {
    const authUser = c.get('authUser');
    if (authUser?.role === 'admin' || authUser?.role === 'owner') return true;
    return true;
};

export const requireFeatureToggle = (featureKey: string, message?: string) => {
    return async (c: AppContext, next: Next) => {
        if (!hasFeatureEnabled(c, featureKey)) {
            return c.json({
                ok: false,
                message: message ?? `Access denied. Feature disabled: ${featureKey}`,
            }, 403);
        }
        await next();
    };
};

export const requirePermission = (permission: StaffPermissionKey) => {
    return async (c: AppContext, next: Next) => {
        if (!hasPermission(c, permission)) {
            return c.json({ ok: false, message: `Access denied. Missing permission: ${permission}` }, 403);
        }
        await next();
    };
};
