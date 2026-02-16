import type { Next } from 'hono';
import type { AppContext } from './auth';
import {
    evaluateFeatureGate,
    resolveOrganizationContext,
    type MembershipRole,
    type OrganizationContext,
    type StaffPermissionKey,
} from '../organizations/access';

type FeatureGate = 'bills_per_month' | 'stores' | 'staff' | 'premium_template';

const readRequestedOrganizationId = (c: AppContext): string | null => {
    const queryId = c.req.query('organizationId');
    if (queryId?.trim()) return queryId.trim();
    const headerId = c.req.header('X-Organization-Id');
    if (headerId?.trim()) return headerId.trim();
    return null;
};

export const withOrganizationContext = async (c: AppContext, next: Next) => {
    const authUser = c.get('authUser');
    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const db = c.get('db');
    try {
        const context = await resolveOrganizationContext(db, authUser, readRequestedOrganizationId(c));
        c.set('organizationId', context.organizationId);
        c.set('organizationRole', context.role);
        c.set('organizationPermissions', context.permissions);
        c.set('organizationOwnerId', context.ownerUserId);
        c.set('organizationSettings', context.settings);
        c.set('effectiveUserId', context.ownerUserId);
    } catch (error: unknown) {
        return c.json({
            ok: false,
            message: error instanceof Error ? error.message : 'Failed to resolve organization context.',
        }, 403);
    }

    await next();
};

export const hasPermission = (c: AppContext, permission: StaffPermissionKey): boolean => {
    const authUser = c.get('authUser');
    const organizationRole = c.get('organizationRole');
    const permissions = c.get('organizationPermissions');

    if (authUser?.role === 'admin') return true;
    if (organizationRole === 'owner') return true;
    return Boolean(permissions?.[permission]);
};

export const requirePermission = (permission: StaffPermissionKey) => {
    return async (c: AppContext, next: Next) => {
        if (!hasPermission(c, permission)) {
            return c.json({ ok: false, message: `Access denied. Missing permission: ${permission}` }, 403);
        }
        await next();
    };
};

export const requireFeatureGate = (feature: FeatureGate) => {
    return async (c: AppContext, next: Next) => {
        const organizationId = c.get('organizationId');
        const ownerUserId = c.get('organizationOwnerId');
        const role = c.get('organizationRole');
        const permissions = c.get('organizationPermissions');
        const settings = c.get('organizationSettings');
        if (!organizationId || !ownerUserId || !role || !permissions || !settings) {
            return c.json({ ok: false, message: 'Organization context missing.' }, 400);
        }

        const gate = await evaluateFeatureGate(c.get('db'), {
            organizationId,
            ownerUserId,
            role: role as MembershipRole,
            permissions: permissions as OrganizationContext['permissions'],
            settings,
        }, feature);

        if (!gate.allowed) {
            return c.json({
                ok: false,
                message: gate.message ?? 'Upgrade required to continue.',
                upgrade: {
                    feature,
                    used: gate.used,
                    limit: gate.limit,
                    cta: 'Pay Rs 499/Year',
                },
            }, 403);
        }

        await next();
    };
};
