import { Hono } from 'hono';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    billTemplates,
    organizationCategories,
    organizationMembers,
    organizations,
    organizationSettings,
    printProfiles,
    signatures,
    users,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';

const organizationsRoute = new Hono<AppEnv>();

type RouteContext = {
    authUser: NonNullable<AppEnv['Variables']['authUser']>;
    ownerUserId: string;
    organizationId: string;
    organizationRole: 'owner' | 'manager' | 'salesman' | null;
    organizationPermissions: Record<string, boolean>;
};

const normalizePhoneNumber = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

const getRouteContext = (c: any): RouteContext | null => {
    const authUser = c.get('authUser');
    const ownerUserId = c.get('effectiveOwnerUserId');
    const organizationId = c.get('effectiveOrganizationId');
    const organizationRole = c.get('organizationRole');
    const organizationPermissions = c.get('organizationPermissions');

    if (!authUser || !ownerUserId || !organizationId) {
        return null;
    }

    return {
        authUser,
        ownerUserId,
        organizationId,
        organizationRole: organizationRole ?? null,
        organizationPermissions: organizationPermissions ?? {},
    };
};

const canManageOrganization = (context: RouteContext): boolean =>
    context.authUser.role === 'admin' || context.organizationRole === 'owner';

const buildOptionalOrgScopeCondition = (
    column: any,
    organizationId: string,
    ownerUserId: string
) => {
    if (organizationId === ownerUserId) {
        return or(eq(column, organizationId), isNull(column));
    }
    return eq(column, organizationId);
};

organizationsRoute.get('/mine', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const { authUser, ownerUserId } = context;

    if (authUser.role === 'staff') {
        const rows = await db
            .select({
                id: organizations.id,
                name: organizations.name,
                code: organizations.code,
                currency: organizations.currency,
                role: organizationMembers.role,
                permissions: organizationMembers.permissions,
            })
            .from(organizationMembers)
            .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
            .where(and(
                eq(organizationMembers.userId, authUser.uid),
                eq(organizationMembers.isActive, true),
                eq(organizations.isActive, true),
            ))
            .orderBy(asc(organizations.name));

        return c.json({
            ok: true,
            organizations: rows.map((entry) => ({
                id: entry.id,
                name: entry.name,
                code: entry.code,
                currency: entry.currency,
                role: entry.role,
                permissions: entry.permissions ?? {},
            })),
        });
    }

    const orgRows = await db
        .select({
            id: organizations.id,
            name: organizations.name,
            code: organizations.code,
            currency: organizations.currency,
        })
        .from(organizations)
        .where(and(eq(organizations.userId, ownerUserId), eq(organizations.isActive, true)))
        .orderBy(asc(organizations.createdAt));

    if (orgRows.length === 0) {
        const fallbackUserRows = await db
            .select({
                businessName: users.businessName,
                currency: users.currency,
            })
            .from(users)
            .where(eq(users.uid, ownerUserId))
            .limit(1);
        const fallbackUser = fallbackUserRows[0];

        return c.json({
            ok: true,
            organizations: [
                {
                    id: ownerUserId,
                    name: fallbackUser?.businessName ?? 'Default Organization',
                    code: 'DEFAULT',
                    currency: fallbackUser?.currency ?? 'INR',
                    role: 'owner',
                    permissions: {},
                },
            ],
        });
    }

    return c.json({
        ok: true,
        organizations: orgRows.map((entry) => ({
            ...entry,
            role: 'owner',
            permissions: {},
        })),
    });
});

organizationsRoute.get('/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const { organizationId, ownerUserId, authUser, organizationRole, organizationPermissions } = context;

    const orgRows = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
    const org = orgRows[0];

    let resolvedOrganization = org;
    if (!resolvedOrganization) {
        const ownerRows = await db
            .select({
                businessName: users.businessName,
                currency: users.currency,
                gstNumber: users.gstNumber,
                address: users.address,
                phoneNumber: users.phoneNumber,
                email: users.email,
            })
            .from(users)
            .where(eq(users.uid, ownerUserId))
            .limit(1);
        const owner = ownerRows[0];
        resolvedOrganization = {
            id: organizationId,
            userId: ownerUserId,
            name: owner?.businessName ?? 'Default Organization',
            code: 'DEFAULT',
            gstNumber: owner?.gstNumber ?? null,
            address: owner?.address ?? null,
            phoneNumber: owner?.phoneNumber ?? null,
            email: owner?.email ?? null,
            currency: owner?.currency ?? 'INR',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    const settingsRows = await db
        .select({
            settings: organizationSettings.settings,
        })
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

    return c.json({
        ok: true,
        organization: {
            id: resolvedOrganization.id,
            userId: resolvedOrganization.userId,
            name: resolvedOrganization.name,
            code: resolvedOrganization.code,
            currency: resolvedOrganization.currency,
            gstNumber: resolvedOrganization.gstNumber,
            address: resolvedOrganization.address,
            phoneNumber: resolvedOrganization.phoneNumber,
            email: resolvedOrganization.email,
        },
        context: {
            role: authUser.role === 'admin' ? 'owner' : (organizationRole ?? 'owner'),
            ownerUserId,
            permissions: organizationPermissions ?? {},
            settings: settingsRows[0]?.settings ?? {},
        },
    });
});

organizationsRoute.post('/', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    if (!['owner', 'admin'].includes(context.authUser.role ?? '')) {
        return c.json({ ok: false, message: 'Only owners can create organizations.' }, 403);
    }

    const payload = z.object({
        name: z.string().min(2).max(140),
        code: z.string().min(2).max(32),
        currency: z.string().min(3).max(6).optional(),
        phoneNumber: z.string().optional(),
        email: z.string().email().optional(),
        gstNumber: z.string().optional(),
        address: z.string().optional(),
    }).parse(await c.req.json());

    const now = new Date();
    const id = nanoid();
    const ownerUserId = context.authUser.uid;

    await db.insert(organizations).values({
        id,
        userId: ownerUserId,
        name: payload.name.trim(),
        code: payload.code.trim().toUpperCase(),
        currency: (payload.currency ?? 'INR').toUpperCase(),
        phoneNumber: payload.phoneNumber ? normalizePhoneNumber(payload.phoneNumber) : null,
        email: payload.email?.trim().toLowerCase() ?? null,
        gstNumber: payload.gstNumber?.trim().toUpperCase() ?? null,
        address: payload.address?.trim() ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });

    await db.insert(organizationMembers).values({
        id: nanoid(),
        userId: ownerUserId,
        organizationId: id,
        role: 'owner',
        permissions: {},
        isActive: true,
        invitedBy: ownerUserId,
        phoneNumberSnapshot: context.authUser.phoneNumber ?? null,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
    });

    await db
        .insert(organizationSettings)
        .values({
            organizationId: id,
            userId: ownerUserId,
            settings: {},
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: organizationSettings.organizationId,
            set: {
                userId: ownerUserId,
                updatedAt: now,
            },
        });

    return c.json({ ok: true, id });
});

organizationsRoute.patch('/:id', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Organization update access denied.' }, 403);
    }

    const id = c.req.param('id');
    const payload = z.object({
        name: z.string().min(2).max(140).optional(),
        code: z.string().min(2).max(32).optional(),
        currency: z.string().min(3).max(6).optional(),
        phoneNumber: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        gstNumber: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
    }).parse(await c.req.json());

    const updatePayload: Record<string, unknown> = {
        updatedAt: new Date(),
    };
    if (payload.name !== undefined) updatePayload.name = payload.name.trim();
    if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
    if (payload.currency !== undefined) updatePayload.currency = payload.currency.trim().toUpperCase();
    if (payload.phoneNumber !== undefined) updatePayload.phoneNumber = payload.phoneNumber ? normalizePhoneNumber(payload.phoneNumber) : null;
    if (payload.email !== undefined) updatePayload.email = payload.email?.trim().toLowerCase() ?? null;
    if (payload.gstNumber !== undefined) updatePayload.gstNumber = payload.gstNumber?.trim().toUpperCase() ?? null;
    if (payload.address !== undefined) updatePayload.address = payload.address?.trim() ?? null;
    if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

    const updated = await db
        .update(organizations)
        .set(updatePayload)
        .where(and(eq(organizations.id, id), eq(organizations.userId, context.ownerUserId)))
        .returning({ id: organizations.id });

    if (!updated[0]) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    return c.json({ ok: true });
});

organizationsRoute.get('/settings/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const rows = await db
        .select({
            settings: organizationSettings.settings,
        })
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, context.organizationId))
        .limit(1);

    return c.json({ ok: true, settings: rows[0]?.settings ?? {} });
});

organizationsRoute.put('/settings/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Organization settings access denied.' }, 403);
    }

    const payload = z.object({
        settings: z.record(z.string(), z.unknown()),
    }).parse(await c.req.json());

    const now = new Date();
    await db
        .insert(organizationSettings)
        .values({
            organizationId: context.organizationId,
            userId: context.ownerUserId,
            settings: payload.settings,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: organizationSettings.organizationId,
            set: {
                userId: context.ownerUserId,
                settings: payload.settings,
                updatedAt: now,
            },
        });

    return c.json({ ok: true, settings: payload.settings });
});

organizationsRoute.get('/members/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const rows = await db
        .select({
            id: organizationMembers.id,
            userId: organizationMembers.userId,
            role: organizationMembers.role,
            permissions: organizationMembers.permissions,
            isActive: organizationMembers.isActive,
            phoneNumberSnapshot: organizationMembers.phoneNumberSnapshot,
            joinedAt: organizationMembers.joinedAt,
            userUid: users.uid,
            userDisplayName: users.displayName,
            userPhoneNumber: users.phoneNumber,
            userEmail: users.email,
        })
        .from(organizationMembers)
        .leftJoin(users, eq(organizationMembers.userId, users.uid))
        .where(eq(organizationMembers.organizationId, context.organizationId))
        .orderBy(desc(organizationMembers.createdAt));

    return c.json({
        ok: true,
        members: rows.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            role: entry.role,
            permissions: entry.permissions ?? {},
            isActive: entry.isActive,
            phoneNumberSnapshot: entry.phoneNumberSnapshot,
            joinedAt: entry.joinedAt,
            user: entry.userUid ? {
                uid: entry.userUid,
                displayName: entry.userDisplayName,
                phoneNumber: entry.userPhoneNumber,
                email: entry.userEmail,
            } : null,
        })),
    });
});

organizationsRoute.post('/members/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Organization member management denied.' }, 403);
    }

    const payload = z.object({
        displayName: z.string().min(2).max(120),
        phoneNumber: z.string().min(8).max(30),
        role: z.enum(['manager', 'salesman']),
        permissions: z.record(z.string(), z.boolean()).optional(),
    }).parse(await c.req.json());

    const normalizedPhone = normalizePhoneNumber(payload.phoneNumber);
    if (!normalizedPhone || normalizedPhone.length < 8) {
        return c.json({ ok: false, message: 'Invalid phone number.' }, 400);
    }

    const now = new Date();
    const existingUserRows = await db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, normalizedPhone))
        .limit(1);

    let userId = existingUserRows[0]?.uid ?? `phone_${normalizedPhone.replace(/\D/g, '')}`;
    if (!existingUserRows[0]) {
        await db.insert(users).values({
            uid: userId,
            ownerId: context.ownerUserId,
            phoneNumber: normalizedPhone,
            displayName: payload.displayName.trim(),
            role: 'staff',
            createdAt: now,
            updatedAt: now,
        });
    } else {
        await db.update(users).set({
            ownerId: context.ownerUserId,
            role: 'staff',
            updatedAt: now,
        }).where(eq(users.uid, userId));
    }

    const existingMembershipRows = await db
        .select({
            id: organizationMembers.id,
        })
        .from(organizationMembers)
        .where(and(
            eq(organizationMembers.organizationId, context.organizationId),
            eq(organizationMembers.userId, userId),
        ))
        .limit(1);

    if (existingMembershipRows[0]) {
        await db.update(organizationMembers).set({
            role: payload.role,
            permissions: payload.permissions ?? {},
            isActive: true,
            invitedBy: context.authUser.uid,
            phoneNumberSnapshot: normalizedPhone,
            updatedAt: now,
        }).where(eq(organizationMembers.id, existingMembershipRows[0].id));
    } else {
        await db.insert(organizationMembers).values({
            id: nanoid(),
            userId,
            organizationId: context.organizationId,
            role: payload.role,
            permissions: payload.permissions ?? {},
            isActive: true,
            invitedBy: context.authUser.uid,
            phoneNumberSnapshot: normalizedPhone,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
        });
    }

    return c.json({ ok: true, userId });
});

organizationsRoute.patch('/members/current/:memberId', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Organization member management denied.' }, 403);
    }

    const memberId = c.req.param('memberId');
    const payload = z.object({
        role: z.enum(['manager', 'salesman']).optional(),
        permissions: z.record(z.string(), z.boolean()).optional(),
        isActive: z.boolean().optional(),
    }).parse(await c.req.json());

    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.role !== undefined) updatePayload.role = payload.role;
    if (payload.permissions !== undefined) updatePayload.permissions = payload.permissions;
    if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

    const updated = await db.update(organizationMembers).set(updatePayload).where(and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, context.organizationId),
    )).returning({ id: organizationMembers.id });

    if (!updated[0]) {
        return c.json({ ok: false, message: 'Member not found.' }, 404);
    }

    return c.json({ ok: true });
});

organizationsRoute.delete('/members/current/:memberId', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Organization member management denied.' }, 403);
    }

    const memberId = c.req.param('memberId');
    const updated = await db.update(organizationMembers).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, context.organizationId),
    )).returning({ id: organizationMembers.id });

    if (!updated[0]) {
        return c.json({ ok: false, message: 'Member not found.' }, 404);
    }

    return c.json({ ok: true });
});

organizationsRoute.get('/templates/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const rows = await db
        .select()
        .from(billTemplates)
        .where(and(
            eq(billTemplates.userId, context.ownerUserId),
            buildOptionalOrgScopeCondition(
                billTemplates.organizationId,
                context.organizationId,
                context.ownerUserId
            )
        ))
        .orderBy(desc(billTemplates.createdAt));

    return c.json({ ok: true, templates: rows });
});

organizationsRoute.post('/templates/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Template management denied.' }, 403);
    }

    const payload = z.object({
        templateKey: z.string().min(1).max(80),
        name: z.string().min(1).max(120),
        isPremium: z.boolean().optional(),
        isActive: z.boolean().optional(),
        layoutConfig: z.record(z.string(), z.unknown()).optional(),
    }).parse(await c.req.json());

    const id = nanoid();
    const now = new Date();
    await db.insert(billTemplates).values({
        id,
        userId: context.ownerUserId,
        organizationId: context.organizationId,
        templateKey: payload.templateKey,
        name: payload.name,
        isPremium: payload.isPremium ?? false,
        isActive: payload.isActive ?? true,
        layoutConfig: payload.layoutConfig ?? {},
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id });
});

organizationsRoute.get('/print-profiles/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const rows = await db
        .select()
        .from(printProfiles)
        .where(and(
            eq(printProfiles.userId, context.ownerUserId),
            buildOptionalOrgScopeCondition(
                printProfiles.organizationId,
                context.organizationId,
                context.ownerUserId
            )
        ))
        .orderBy(desc(printProfiles.createdAt));

    return c.json({ ok: true, profiles: rows });
});

organizationsRoute.post('/print-profiles/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Print profile management denied.' }, 403);
    }

    const payload = z.object({
        name: z.string().min(1).max(120),
        printerType: z.enum(['THERMAL', 'STANDARD']),
        paperSize: z.enum(['2INCH', '3INCH', 'A4', 'A5']),
        isDefault: z.boolean().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
    }).parse(await c.req.json());

    const id = nanoid();
    const now = new Date();

    if (payload.isDefault) {
        await db.update(printProfiles).set({ isDefault: false, updatedAt: now }).where(and(
            eq(printProfiles.userId, context.ownerUserId),
            buildOptionalOrgScopeCondition(
                printProfiles.organizationId,
                context.organizationId,
                context.ownerUserId
            )
        ));
    }

    await db.insert(printProfiles).values({
        id,
        userId: context.ownerUserId,
        organizationId: context.organizationId,
        name: payload.name,
        printerType: payload.printerType,
        paperSize: payload.paperSize,
        isDefault: payload.isDefault ?? false,
        settings: payload.settings ?? {},
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id });
});

organizationsRoute.get('/signatures/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const rows = await db
        .select()
        .from(signatures)
        .where(and(
            eq(signatures.userId, context.ownerUserId),
            buildOptionalOrgScopeCondition(
                signatures.organizationId,
                context.organizationId,
                context.ownerUserId
            )
        ))
        .orderBy(desc(signatures.createdAt));

    return c.json({ ok: true, signatures: rows });
});

organizationsRoute.post('/signatures/current', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Signature management denied.' }, 403);
    }

    const payload = z.object({
        name: z.string().max(120).optional(),
        signatureData: z.string().optional(),
        signatureUrl: z.string().optional(),
        isDefault: z.boolean().optional(),
    }).parse(await c.req.json());

    const id = nanoid();
    const now = new Date();

    if (payload.isDefault) {
        await db.update(signatures).set({
            isDefault: false,
            updatedAt: now,
        }).where(and(
            eq(signatures.userId, context.ownerUserId),
            buildOptionalOrgScopeCondition(
                signatures.organizationId,
                context.organizationId,
                context.ownerUserId
            )
        ));
    }

    await db.insert(signatures).values({
        id,
        userId: context.ownerUserId,
        organizationId: context.organizationId,
        name: payload.name ?? null,
        signatureData: payload.signatureData ?? null,
        signatureUrl: payload.signatureUrl ?? null,
        isDefault: payload.isDefault ?? false,
        createdByUid: context.authUser.uid,
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id });
});

organizationsRoute.post('/signatures/current/:id/default', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Signature management denied.' }, 403);
    }

    const id = c.req.param('id');
    const rows = await db.select({ id: signatures.id }).from(signatures).where(and(
        eq(signatures.id, id),
        eq(signatures.userId, context.ownerUserId),
        buildOptionalOrgScopeCondition(
            signatures.organizationId,
            context.organizationId,
            context.ownerUserId
        )
    )).limit(1);
    if (!rows[0]) {
        return c.json({ ok: false, message: 'Signature not found.' }, 404);
    }

    const now = new Date();
    await db.update(signatures).set({
        isDefault: false,
        updatedAt: now,
    }).where(and(
        eq(signatures.userId, context.ownerUserId),
        buildOptionalOrgScopeCondition(
            signatures.organizationId,
            context.organizationId,
            context.ownerUserId
        )
    ));

    await db.update(signatures).set({
        isDefault: true,
        updatedAt: now,
    }).where(eq(signatures.id, id));

    return c.json({ ok: true });
});

organizationsRoute.get('/categories', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const rows = await db.select().from(organizationCategories).where(and(
        eq(organizationCategories.userId, context.ownerUserId),
        eq(organizationCategories.organizationId, context.organizationId),
        eq(organizationCategories.isActive, true),
    )).orderBy(asc(organizationCategories.name));

    return c.json({ ok: true, categories: rows });
});

organizationsRoute.post('/categories', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Category management denied.' }, 403);
    }

    const payload = z.object({
        name: z.string().min(1).max(100),
        emoji: z.string().min(1).max(8).optional(),
    }).parse(await c.req.json());

    const id = nanoid();
    const now = new Date();
    await db.insert(organizationCategories).values({
        id,
        userId: context.ownerUserId,
        organizationId: context.organizationId,
        name: payload.name.trim(),
        emoji: payload.emoji ?? '📦',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id, name: payload.name.trim(), emoji: payload.emoji ?? '📦' });
});

organizationsRoute.delete('/categories/:id', requireAuth, async (c) => {
    const db = c.get('db');
    const context = getRouteContext(c);
    if (!context) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!canManageOrganization(context)) {
        return c.json({ ok: false, message: 'Category management denied.' }, 403);
    }

    const id = c.req.param('id');
    const deleted = await db.delete(organizationCategories).where(and(
        eq(organizationCategories.id, id),
        eq(organizationCategories.userId, context.ownerUserId),
        eq(organizationCategories.organizationId, context.organizationId),
    )).returning({ id: organizationCategories.id });

    if (!deleted[0]) {
        return c.json({ ok: false, message: 'Category not found.' }, 404);
    }

    return c.json({ ok: true });
});

export default organizationsRoute;

