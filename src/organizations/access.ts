import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DrizzleClient } from '../db/client';
import {
    organizationMembers,
    organizations,
    organizationSettings,
    ownerUsageSnapshots,
    transactions,
    users,
    type UserRow,
} from '../db/schema';

export type StaffPermissionKey =
    | 'can_create_bill'
    | 'can_back_date'
    | 'can_delete_bill'
    | 'can_view_cost_price'
    | 'can_access_settings'
    | 'can_manage_staff'
    | 'can_manage_subscription'
    | 'can_manage_templates'
    | 'can_manage_inventory'
    | 'can_manage_expenses'
    | 'can_manage_payments'
    | 'can_send_messages';

export type MembershipRole = 'owner' | 'manager' | 'salesman';

type PermissionMap = Record<StaffPermissionKey, boolean>;

export interface OrganizationContext {
    organizationId: string;
    ownerUserId: string;
    role: MembershipRole;
    permissions: PermissionMap;
    settings: Record<string, unknown>;
}

type FeatureGate = 'bills_per_month' | 'stores' | 'staff' | 'premium_template';

type LimitSet = {
    billsPerMonth: number;
    stores: number;
    staff: number;
    premiumTemplates: boolean;
};

const DEFAULT_ROLE_PERMISSIONS: Record<MembershipRole, PermissionMap> = {
    owner: {
        can_create_bill: true,
        can_back_date: true,
        can_delete_bill: true,
        can_view_cost_price: true,
        can_access_settings: true,
        can_manage_staff: true,
        can_manage_subscription: true,
        can_manage_templates: true,
        can_manage_inventory: true,
        can_manage_expenses: true,
        can_manage_payments: true,
        can_send_messages: true,
    },
    manager: {
        can_create_bill: true,
        can_back_date: true,
        can_delete_bill: false,
        can_view_cost_price: true,
        can_access_settings: false,
        can_manage_staff: false,
        can_manage_subscription: false,
        can_manage_templates: true,
        can_manage_inventory: true,
        can_manage_expenses: true,
        can_manage_payments: true,
        can_send_messages: true,
    },
    salesman: {
        can_create_bill: true,
        can_back_date: false,
        can_delete_bill: false,
        can_view_cost_price: false,
        can_access_settings: false,
        can_manage_staff: false,
        can_manage_subscription: false,
        can_manage_templates: false,
        can_manage_inventory: true,
        can_manage_expenses: false,
        can_manage_payments: true,
        can_send_messages: true,
    },
};

const DEFAULT_ORGANIZATION_SETTINGS: Record<string, unknown> = {
    billing: {
        defaultBillMode: 'GST',
        allowBackDate: false,
        allowNegativeStock: false,
        gstEnabled: true,
    },
    inventory: {
        allowNegativeStock: false,
        lowStockThresholdDefault: 5,
    },
    customization: {
        templateKey: 'modern_minimal',
        godHeaderText: '',
        footerText: '',
        acknowledgmentText: '',
        signatureId: null,
    },
    print: {
        printerType: 'STANDARD',
        paperSize: 'A4',
    },
    reminders: {
        whatsappEnabled: false,
    },
    subscriptionLimits: {
        free: {
            billsPerMonth: 50,
            stores: 1,
            staff: 1,
            premiumTemplates: false,
        },
        pro: {
            billsPerMonth: 1000000,
            stores: 5,
            staff: 5,
            premiumTemplates: true,
        },
    },
};

const cloneSettings = (value: Record<string, unknown>): Record<string, unknown> => {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
};

const mergePermissions = (
    role: MembershipRole,
    overrides: Record<string, boolean> | null | undefined
): PermissionMap => {
    const base = { ...DEFAULT_ROLE_PERMISSIONS[role] };
    if (!overrides) return base;

    for (const [key, value] of Object.entries(overrides)) {
        if (key in base) {
            base[key as StaffPermissionKey] = Boolean(value);
        }
    }
    return base;
};

const normalizeRole = (value: string | null | undefined): MembershipRole => {
    if (value === 'owner' || value === 'manager' || value === 'salesman') {
        return value;
    }
    return 'salesman';
};

const slugFromName = (name: string) => {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 18);
    return slug || 'store';
};

const ensureDefaultOrganizationForOwner = async (
    db: DrizzleClient,
    ownerUserId: string,
    fallbackName?: string | null
) => {
    const existing = await db
        .select()
        .from(organizations)
        .where(and(eq(organizations.userId, ownerUserId), eq(organizations.isActive, true)))
        .orderBy(desc(organizations.createdAt))
        .limit(1);

    if (existing[0]) return existing[0];

    const now = new Date();
    const id = nanoid();
    const baseName = fallbackName?.trim() || 'My Store';
    const code = `${slugFromName(baseName).slice(0, 10)}-${id.slice(0, 4)}`.toUpperCase();
    await db.insert(organizations).values({
        id,
        userId: ownerUserId,
        name: baseName,
        code,
        currency: 'INR',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });

    const created = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
    return created[0];
};

const ensureMembership = async (
    db: DrizzleClient,
    userId: string,
    organizationId: string,
    role: MembershipRole,
    phoneSnapshot?: string | null
) => {
    const rows = await db
        .select()
        .from(organizationMembers)
        .where(and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.isActive, true),
        ))
        .limit(1);
    if (rows[0]) return rows[0];

    const now = new Date();
    const id = nanoid();
    await db.insert(organizationMembers).values({
        id,
        userId,
        organizationId,
        role,
        permissions: DEFAULT_ROLE_PERMISSIONS[role],
        isActive: true,
        invitedBy: role === 'owner' ? userId : null,
        phoneNumberSnapshot: phoneSnapshot ?? null,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
    });

    const inserted = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, id))
        .limit(1);
    return inserted[0];
};

export const resolveOrganizationContext = async (
    db: DrizzleClient,
    authUser: UserRow,
    requestedOrganizationId?: string | null
): Promise<OrganizationContext> => {
    const userRows = await db
        .select()
        .from(users)
        .where(eq(users.uid, authUser.uid))
        .limit(1);
    const currentUser = userRows[0] ?? authUser;

    const loadSettings = async (organizationId: string, ownerUserId: string) => {
        const settingRows = await db
            .select()
            .from(organizationSettings)
            .where(eq(organizationSettings.organizationId, organizationId))
            .limit(1);
        if (!settingRows[0]) {
            return cloneSettings(DEFAULT_ORGANIZATION_SETTINGS);
        }
        return {
            ...cloneSettings(DEFAULT_ORGANIZATION_SETTINGS),
            ...(settingRows[0].settings ?? {}),
        };
    };

    const readMembershipForOrg = async (organizationId: string) => {
        return await db
            .select()
            .from(organizationMembers)
            .where(and(
                eq(organizationMembers.userId, currentUser.uid),
                eq(organizationMembers.organizationId, organizationId),
                eq(organizationMembers.isActive, true),
            ))
            .limit(1);
    };

    if (requestedOrganizationId) {
        const memberRows = await readMembershipForOrg(requestedOrganizationId);
        const member = memberRows[0];
        if (!member) {
            throw new Error('Access denied for selected organization.');
        }

        const orgRows = await db
            .select()
            .from(organizations)
            .where(and(
                eq(organizations.id, requestedOrganizationId),
                eq(organizations.isActive, true),
            ))
            .limit(1);
        const org = orgRows[0];
        if (!org) throw new Error('Organization not found.');

        return {
            organizationId: org.id,
            ownerUserId: org.userId,
            role: normalizeRole(member.role),
            permissions: mergePermissions(normalizeRole(member.role), member.permissions),
            settings: await loadSettings(org.id, org.userId),
        };
    }

    const memberRows = await db
        .select()
        .from(organizationMembers)
        .where(and(
            eq(organizationMembers.userId, currentUser.uid),
            eq(organizationMembers.isActive, true),
        ))
        .orderBy(desc(organizationMembers.joinedAt))
        .limit(1);
    const firstMember = memberRows[0];
    if (firstMember) {
        const orgRows = await db
            .select()
            .from(organizations)
            .where(and(eq(organizations.id, firstMember.organizationId), eq(organizations.isActive, true)))
            .limit(1);
        const org = orgRows[0];
        if (!org) throw new Error('Organization not found.');

        return {
            organizationId: org.id,
            ownerUserId: org.userId,
            role: normalizeRole(firstMember.role),
            permissions: mergePermissions(normalizeRole(firstMember.role), firstMember.permissions),
            settings: await loadSettings(org.id, org.userId),
        };
    }

    if (currentUser.role === 'owner' || currentUser.role === 'admin') {
        const org = await ensureDefaultOrganizationForOwner(db, currentUser.uid, currentUser.businessName);
        const membership = await ensureMembership(db, currentUser.uid, org.id, 'owner', currentUser.phoneNumber);
        return {
            organizationId: org.id,
            ownerUserId: org.userId,
            role: normalizeRole(membership.role),
            permissions: mergePermissions(normalizeRole(membership.role), membership.permissions),
            settings: await loadSettings(org.id, org.userId),
        };
    }

    // Legacy staff fallback: map ownerId relationship to owner's default organization.
    if (currentUser.role === 'staff' && currentUser.ownerId) {
        const ownerRows = await db
            .select()
            .from(users)
            .where(eq(users.uid, currentUser.ownerId))
            .limit(1);
        const owner = ownerRows[0];
        if (!owner) throw new Error('Owner record not found for staff account.');

        const org = await ensureDefaultOrganizationForOwner(db, owner.uid, owner.businessName);
        const membership = await ensureMembership(db, currentUser.uid, org.id, 'salesman', currentUser.phoneNumber);
        return {
            organizationId: org.id,
            ownerUserId: org.userId,
            role: normalizeRole(membership.role),
            permissions: mergePermissions(normalizeRole(membership.role), membership.permissions),
            settings: await loadSettings(org.id, org.userId),
        };
    }

    throw new Error('No organization membership found for this account.');
};

const toLimitSet = (settings: Record<string, unknown>, subscriptionStatus: string | null | undefined): LimitSet => {
    const subscriptionLimits = (settings.subscriptionLimits ?? {}) as Record<string, unknown>;
    const freeLimits = (subscriptionLimits.free ?? {}) as Record<string, unknown>;
    const proLimits = (subscriptionLimits.pro ?? {}) as Record<string, unknown>;

    const parseNumberLimit = (value: unknown, fallback: number) => {
        const next = Number(value);
        if (!Number.isFinite(next) || next < 0) return fallback;
        return Math.floor(next);
    };

    const parseBooleanLimit = (value: unknown, fallback: boolean) => {
        if (typeof value === 'boolean') return value;
        return fallback;
    };

    const free: LimitSet = {
        billsPerMonth: parseNumberLimit(freeLimits.billsPerMonth, 50),
        stores: parseNumberLimit(freeLimits.stores, 1),
        staff: parseNumberLimit(freeLimits.staff, 1),
        premiumTemplates: parseBooleanLimit(freeLimits.premiumTemplates, false),
    };
    const pro: LimitSet = {
        billsPerMonth: parseNumberLimit(proLimits.billsPerMonth, 1000000),
        stores: parseNumberLimit(proLimits.stores, 5),
        staff: parseNumberLimit(proLimits.staff, 5),
        premiumTemplates: parseBooleanLimit(proLimits.premiumTemplates, true),
    };

    return subscriptionStatus === 'active' ? pro : free;
};

export const evaluateFeatureGate = async (
    db: DrizzleClient,
    context: OrganizationContext,
    feature: FeatureGate
): Promise<{ allowed: boolean; used: number; limit: number | null; message?: string }> => {
    const ownerRows = await db
        .select()
        .from(users)
        .where(eq(users.uid, context.ownerUserId))
        .limit(1);
    const owner = ownerRows[0];
    if (!owner) {
        return { allowed: false, used: 0, limit: 0, message: 'Owner account not found.' };
    }

    const limits = toLimitSet(context.settings, owner.subscriptionStatus);
    const now = new Date();

    if (feature === 'premium_template') {
        if (limits.premiumTemplates) return { allowed: true, used: 0, limit: null };
        return {
            allowed: false,
            used: 0,
            limit: 0,
            message: "You've hit the limit! Upgrade to BillTap Pro to unlock premium templates.",
        };
    }

    if (feature === 'stores') {
        const stores = await db
            .select()
            .from(organizations)
            .where(and(eq(organizations.userId, context.ownerUserId), eq(organizations.isActive, true)));
        const used = stores.length;
        const allowed = used < limits.stores;
        return {
            allowed,
            used,
            limit: limits.stores,
            message: allowed ? undefined : "You've hit the limit! Upgrade to BillTap Pro to add more stores.",
        };
    }

    if (feature === 'staff') {
        const staffRows = await db
            .select()
            .from(organizationMembers)
            .where(and(
                eq(organizationMembers.organizationId, context.organizationId),
                eq(organizationMembers.isActive, true),
            ));
        const used = staffRows.filter((row) => normalizeRole(row.role) !== 'owner').length;
        const allowed = used < limits.staff;
        return {
            allowed,
            used,
            limit: limits.staff,
            message: allowed ? undefined : "You've hit the limit! Upgrade to BillTap Pro to add more staff.",
        };
    }

    // bills_per_month
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const billRows = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(
            eq(transactions.userId, context.ownerUserId),
            gte(transactions.billDate, periodStart),
            lte(transactions.billDate, periodEnd),
        ));
    const used = billRows.length;
    const allowed = used < limits.billsPerMonth;

    return {
        allowed,
        used,
        limit: limits.billsPerMonth,
        message: allowed ? undefined : "You've hit the limit! Upgrade to BillTap Pro for unlimited bills.",
    };
};

export const trackMonthlyBillUsage = async (db: DrizzleClient, ownerUserId: string, amount = 1) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const existingRows = await db
        .select()
        .from(ownerUsageSnapshots)
        .where(and(
            eq(ownerUsageSnapshots.userId, ownerUserId),
            eq(ownerUsageSnapshots.month, month),
            eq(ownerUsageSnapshots.year, year),
        ))
        .orderBy(desc(ownerUsageSnapshots.updatedAt))
        .limit(1);
    const existing = existingRows[0];

    if (!existing) {
        await db.insert(ownerUsageSnapshots).values({
            id: nanoid(),
            userId: ownerUserId,
            month,
            year,
            billsCreated: Math.max(0, amount),
            storesCount: 0,
            staffCount: 0,
            updatedAt: now,
        });
        return;
    }

    await db
        .update(ownerUsageSnapshots)
        .set({
            billsCreated: Math.max(0, Number(existing.billsCreated ?? 0) + amount),
            updatedAt: now,
        })
        .where(eq(ownerUsageSnapshots.id, existing.id));
};
