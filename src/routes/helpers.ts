import { and, asc, desc, eq } from 'drizzle-orm';
import type { AppContext, AppVariables } from '../middleware/auth';
import { businesses, businessMembers, subscriptions, users } from '../db/schema';
import type { BusinessRow, SubscriptionRow, UserRow } from '../db/schema';
import type { DrizzleClient } from '../db/client';
import { nanoid } from 'nanoid';

export const getRequestedBusinessId = (c: AppContext): string | null => {
    const fromHeader = c.req.header('X-Organization-Id') ?? c.req.header('x-organization-id');
    const fromQuery = c.req.query('organizationId') ?? c.req.query('businessId');
    const value = (fromHeader ?? fromQuery ?? '').trim();
    return value || null;
};

export const getAccessibleBusiness = async (
    db: DrizzleClient,
    userId: string,
    requestedBusinessId?: string | null
): Promise<BusinessRow | null> => {
    if (requestedBusinessId) {
        const owned = await db
            .select()
            .from(businesses)
            .where(and(
                eq(businesses.id, requestedBusinessId),
                eq(businesses.ownerUserId, userId),
                eq(businesses.isActive, true),
            ))
            .limit(1);

        if (owned[0]) return owned[0];

        const member = await db
            .select({ businessId: businessMembers.businessId })
            .from(businessMembers)
            .where(and(
                eq(businessMembers.businessId, requestedBusinessId),
                eq(businessMembers.userId, userId),
                eq(businessMembers.isActive, true),
            ))
            .limit(1);

        if (!member[0]) return null;

        const memberBusiness = await db
            .select()
            .from(businesses)
            .where(and(
                eq(businesses.id, member[0].businessId),
                eq(businesses.isActive, true),
            ))
            .limit(1);

        return memberBusiness[0] ?? null;
    }

    const firstOwned = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.ownerUserId, userId), eq(businesses.isActive, true)))
        .orderBy(asc(businesses.createdAt))
        .limit(1);

    if (firstOwned[0]) return firstOwned[0];

    const firstMembership = await db
        .select({ businessId: businessMembers.businessId })
        .from(businessMembers)
        .where(and(eq(businessMembers.userId, userId), eq(businessMembers.isActive, true)))
        .orderBy(asc(businessMembers.createdAt))
        .limit(1);

    if (!firstMembership[0]) return null;

    const memberBusiness = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, firstMembership[0].businessId), eq(businesses.isActive, true)))
        .limit(1);

    return memberBusiness[0] ?? null;
};

export const ensurePrimaryBusiness = async (
    db: DrizzleClient,
    user: UserRow,
    defaults?: Partial<BusinessRow>
): Promise<BusinessRow> => {
    const existing = await getAccessibleBusiness(db, user.id, null);
    if (existing) return existing;

    const now = new Date();
    const id = `biz_${nanoid(18)}`;
    const name = defaults?.name ?? user.name ?? 'My Business';

    await db.insert(businesses).values({
        id,
        ownerUserId: user.id,
        name,
        legalName: defaults?.legalName ?? null,
        address: defaults?.address ?? null,
        state: defaults?.state ?? null,
        gstin: defaults?.gstin ?? null,
        pan: defaults?.pan ?? null,
        booksStartDate: defaults?.booksStartDate ?? null,
        logoUrl: defaults?.logoUrl ?? null,
        phone: defaults?.phone ?? user.phone,
        email: defaults?.email ?? user.email,
        currency: defaults?.currency ?? 'INR',
        category: defaults?.category ?? null,
        code: defaults?.code ?? null,
        isActive: true,
        settings: defaults?.settings ?? {},
        createdAt: now,
        updatedAt: now,
    });

    const created = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    return created[0] as BusinessRow;
};

export const getActiveSubscription = async (
    db: DrizzleClient,
    businessId: string
): Promise<SubscriptionRow | null> => {
    const rows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.businessId, businessId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

    return rows[0] ?? null;
};

export const updateUserBasics = async (
    db: DrizzleClient,
    userId: string,
    payload: Partial<Pick<UserRow, 'name' | 'email' | 'phone' | 'photoUrl'>>
): Promise<UserRow | null> => {
    const next = {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.photoUrl !== undefined ? { photoUrl: payload.photoUrl } : {}),
        updatedAt: new Date(),
    };

    await db.update(users).set(next).where(eq(users.id, userId));
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ?? null;
};

type OrganizationRole = NonNullable<AppVariables['organizationRole']>;

const DEFAULT_ROLE_CAPABILITIES: Record<OrganizationRole, readonly string[]> = {
    owner: ['*'],
    manager: [
        'billing.*',
        'inventory.*',
        'parties.*',
        'reports.read',
        'accounts.*',
        'expenses.*',
        'cashbank.*',
        'loans.*',
        'pos.*',
        'staff.read',
        'settings.read',
        'operations.read',
    ],
    salesman: [
        'billing.*',
        'pos.*',
        'parties.read',
        'parties.write',
        'inventory.read',
        'reports.read',
        'expenses.read',
        'cashbank.read',
        'loans.read',
    ],
};

const capabilityMatches = (granted: string, requested: string) => {
    if (granted === '*') return true;
    if (granted === requested) return true;
    if (!granted.endsWith('.*')) return false;
    const prefix = granted.slice(0, -2);
    return requested === prefix || requested.startsWith(`${prefix}.`);
};

const resolvePermissionOverride = (permissions: Record<string, boolean>, capability: string): boolean | null => {
    const tokens = capability.split('.');
    const candidates: string[] = [capability];

    for (let idx = tokens.length; idx >= 1; idx -= 1) {
        const segment = tokens.slice(0, idx).join('.');
        candidates.push(segment);
        candidates.push(`${segment}.*`);
    }
    candidates.push('*');

    for (const key of candidates) {
        const value = permissions[key];
        if (typeof value === 'boolean') return value;
    }
    return null;
};

export const isOrganizationCapabilityAllowed = (c: AppContext, capability: string) => {
    const authRole = c.get('authRole');
    if (authRole === 'SUPER_ADMIN') return true;

    const activeBusinessId = c.get('activeBusinessId');
    if (!activeBusinessId) return true;

    const role = c.get('organizationRole');
    if (!role) return false;
    if (role === 'owner') return true;

    const permissions = c.get('organizationPermissions') ?? {};
    const override = resolvePermissionOverride(permissions, capability);
    if (override !== null) return override;

    const defaults = DEFAULT_ROLE_CAPABILITIES[role];
    return defaults.some((granted) => capabilityMatches(granted, capability));
};

export const requireOrganizationCapability = (c: AppContext, capability: string) => {
    if (isOrganizationCapabilityAllowed(c, capability)) return null;
    return c.json({
        ok: false,
        message: `Permission denied for capability "${capability}".`,
    }, 403);
};
