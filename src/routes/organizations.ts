import { Hono } from 'hono';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    billTemplates,
    organizationMembers,
    organizations,
    organizationSettings,
    printProfiles,
    signatures,
    staffInvites,
    users,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { requireFeatureGate, requirePermission, withOrganizationContext } from '../middleware/permissions';
import { writeAuditLog } from '../operations/controls';

const organizationsRoute = new Hono<AppEnv>();

const normalizePhoneNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

const deepMerge = (
    base: Record<string, unknown>,
    patch: Record<string, unknown>
): Record<string, unknown> => {
    const output: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        const current = output[key];
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            current &&
            typeof current === 'object' &&
            !Array.isArray(current)
        ) {
            output[key] = deepMerge(
                current as Record<string, unknown>,
                value as Record<string, unknown>
            );
            continue;
        }

        output[key] = value;
    }
    return output;
};

organizationsRoute.get('/mine', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const memberRows = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, authUser.uid), eq(organizationMembers.isActive, true)))
        .orderBy(desc(organizationMembers.joinedAt));

    const orgIds = [...new Set(memberRows.map((row) => row.organizationId))];
    const orgRows = orgIds.length === 0
        ? []
        : await db
            .select()
            .from(organizations)
            .where(and(
                eq(organizations.isActive, true),
                inArray(organizations.id, orgIds),
            ))
            .orderBy(asc(organizations.name));
    const orgById = new Map(orgRows.map((row) => [row.id, row]));

    const organizationsForUser = memberRows
        .map((member) => {
            const org = orgById.get(member.organizationId);
            if (!org) return null;
            return {
                id: org.id,
                name: org.name,
                code: org.code,
                currency: org.currency,
                role: member.role,
                permissions: member.permissions,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return c.json({
        ok: true,
        organizations: organizationsForUser,
    });
});

organizationsRoute.get('/current', requireAuth, withOrganizationContext, async (c) => {
    const organizationId = c.get('organizationId');
    const organizationRole = c.get('organizationRole');
    const organizationPermissions = c.get('organizationPermissions');
    const organizationOwnerId = c.get('organizationOwnerId');
    const organizationSettingsPayload = c.get('organizationSettings');
    if (!organizationId || !organizationRole || !organizationOwnerId || !organizationPermissions || !organizationSettingsPayload) {
        return c.json({ ok: false, message: 'Organization context not found.' }, 400);
    }

    const db = c.get('db');
    const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
    if (!organization) return c.json({ ok: false, message: 'Organization not found.' }, 404);

    return c.json({
        ok: true,
        organization,
        context: {
            role: organizationRole,
            permissions: organizationPermissions,
            ownerUserId: organizationOwnerId,
            settings: organizationSettingsPayload,
        },
    });
});

organizationsRoute.post(
    '/',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_access_settings'),
    requireFeatureGate('stores'),
    async (c) => {
        try {
            const authUser = c.get('authUser');
            const organizationOwnerId = c.get('organizationOwnerId');
            if (!authUser || !organizationOwnerId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

            const payload = z.object({
                name: z.string().min(1).max(120),
                code: z.string().min(1).max(32),
                gstNumber: z.string().optional(),
                address: z.string().optional(),
                phoneNumber: z.string().optional(),
                email: z.string().email().optional(),
                currency: z.string().min(3).max(6).default('INR'),
            }).parse(await c.req.json());

            const db = c.get('db');
            const now = new Date();
            const id = nanoid();

            await db.insert(organizations).values({
                id,
                userId: organizationOwnerId,
                name: payload.name.trim(),
                code: payload.code.trim().toUpperCase(),
                gstNumber: payload.gstNumber?.trim() || null,
                address: payload.address?.trim() || null,
                phoneNumber: payload.phoneNumber?.trim() || null,
                email: payload.email?.trim().toLowerCase() || null,
                currency: payload.currency.toUpperCase(),
                isActive: true,
                createdAt: now,
                updatedAt: now,
            });

            await db.insert(organizationMembers).values({
                id: nanoid(),
                userId: authUser.uid,
                organizationId: id,
                role: 'owner',
                permissions: {},
                isActive: true,
                invitedBy: authUser.uid,
                phoneNumberSnapshot: authUser.phoneNumber ?? null,
                joinedAt: now,
                createdAt: now,
                updatedAt: now,
            });

            await db.insert(organizationSettings).values({
                organizationId: id,
                userId: organizationOwnerId,
                settings: {},
                createdAt: now,
                updatedAt: now,
            }).onConflictDoNothing();

            await writeAuditLog(db, {
                userId: organizationOwnerId,
                actorUid: authUser.uid,
                actorRole: authUser.role,
                module: 'admin',
                action: 'organization.created',
                entityType: 'organization',
                entityId: id,
                after: {
                    name: payload.name,
                    code: payload.code,
                },
            });

            return c.json({ ok: true, id });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create organization.' }, 400);
        }
    }
);

organizationsRoute.patch(
    '/:id',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_access_settings'),
    async (c) => {
        try {
            const id = c.req.param('id');
            const organizationOwnerId = c.get('organizationOwnerId');
            const organizationId = c.get('organizationId');
            if (!organizationOwnerId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
            if (organizationId !== id && c.get('organizationRole') !== 'owner') {
                return c.json({ ok: false, message: 'Only owner can update another organization.' }, 403);
            }

            const payload = z.object({
                name: z.string().min(1).max(120).optional(),
                code: z.string().min(1).max(32).optional(),
                gstNumber: z.string().optional().nullable(),
                address: z.string().optional().nullable(),
                phoneNumber: z.string().optional().nullable(),
                email: z.string().email().optional().nullable(),
                currency: z.string().min(3).max(6).optional(),
                isActive: z.boolean().optional(),
            }).parse(await c.req.json());

            const updatePayload: Partial<typeof organizations.$inferInsert> = {
                updatedAt: new Date(),
            };
            if (payload.name !== undefined) updatePayload.name = payload.name.trim();
            if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
            if (payload.gstNumber !== undefined) updatePayload.gstNumber = payload.gstNumber?.trim() || null;
            if (payload.address !== undefined) updatePayload.address = payload.address?.trim() || null;
            if (payload.phoneNumber !== undefined) updatePayload.phoneNumber = payload.phoneNumber?.trim() || null;
            if (payload.email !== undefined) updatePayload.email = payload.email?.trim().toLowerCase() || null;
            if (payload.currency !== undefined) updatePayload.currency = payload.currency.toUpperCase();
            if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

            const db = c.get('db');
            const updated = await db
                .update(organizations)
                .set(updatePayload)
                .where(and(eq(organizations.id, id), eq(organizations.userId, organizationOwnerId)))
                .returning({ id: organizations.id });
            if (!updated[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);

            return c.json({ ok: true });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update organization.' }, 400);
        }
    }
);

organizationsRoute.get('/settings/current', requireAuth, withOrganizationContext, async (c) => {
    return c.json({
        ok: true,
        organizationId: c.get('organizationId'),
        settings: c.get('organizationSettings') ?? {},
    });
});

organizationsRoute.put(
    '/settings/current',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_access_settings'),
    async (c) => {
        try {
            const organizationId = c.get('organizationId');
            const ownerUserId = c.get('organizationOwnerId');
            if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

            const payload = z.object({
                settings: z.record(z.string(), z.unknown()),
            }).parse(await c.req.json());

            const db = c.get('db');
            const [existing] = await db
                .select()
                .from(organizationSettings)
                .where(eq(organizationSettings.organizationId, organizationId))
                .limit(1);
            const merged = deepMerge((existing?.settings ?? {}) as Record<string, unknown>, payload.settings);
            const now = new Date();

            await db.insert(organizationSettings).values({
                organizationId,
                userId: ownerUserId,
                settings: merged,
                createdAt: now,
                updatedAt: now,
            }).onConflictDoUpdate({
                target: organizationSettings.organizationId,
                set: {
                    settings: merged,
                    updatedAt: now,
                },
            });

            c.set('organizationSettings', merged);
            return c.json({ ok: true, settings: merged });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update organization settings.' }, 400);
        }
    }
);

organizationsRoute.get('/members/current', requireAuth, withOrganizationContext, requirePermission('can_manage_staff'), async (c) => {
    const organizationId = c.get('organizationId');
    if (!organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const db = c.get('db');
    const memberRows = await db
        .select()
        .from(organizationMembers)
        .where(and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.isActive, true),
        ))
        .orderBy(asc(organizationMembers.role), asc(organizationMembers.joinedAt));
    const userIds = memberRows.map((row) => row.userId);

    const userRows = userIds.length === 0
        ? []
        : await db
            .select({
                uid: users.uid,
                displayName: users.displayName,
                phoneNumber: users.phoneNumber,
                email: users.email,
            })
            .from(users)
            .where(inArray(users.uid, userIds));
    const userById = new Map(userRows.map((row) => [row.uid, row]));

    const members = memberRows.map((row) => ({
        ...row,
        user: userById.get(row.userId) ?? null,
    }));

    return c.json({ ok: true, members });
});

organizationsRoute.post(
    '/members/current',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_staff'),
    requireFeatureGate('staff'),
    async (c) => {
        try {
            const authUser = c.get('authUser');
            const organizationId = c.get('organizationId');
            const ownerUserId = c.get('organizationOwnerId');
            if (!authUser || !organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

            const payload = z.object({
                displayName: z.string().min(1).max(120),
                phoneNumber: z.string().min(8),
                role: z.enum(['manager', 'salesman']).default('salesman'),
                permissions: z.record(z.string(), z.boolean()).optional(),
            }).parse(await c.req.json());
            const normalizedPhone = normalizePhoneNumber(payload.phoneNumber);
            if (!normalizedPhone || normalizedPhone.length < 8) {
                return c.json({ ok: false, message: 'Invalid phone number.' }, 400);
            }

            const db = c.get('db');
            const now = new Date();
            let memberUser = await db
                .select()
                .from(users)
                .where(eq(users.phoneNumber, normalizedPhone))
                .limit(1)
                .then((rows) => rows[0]);

            if (!memberUser) {
                const phoneUid = `phone_${normalizedPhone.replace(/\D/g, '')}`;
                memberUser = await db
                    .select()
                    .from(users)
                    .where(eq(users.uid, phoneUid))
                    .limit(1)
                    .then((rows) => rows[0]);

                if (!memberUser) {
                    await db.insert(users).values({
                        uid: phoneUid,
                        ownerId: ownerUserId,
                        phoneNumber: normalizedPhone,
                        displayName: payload.displayName.trim(),
                        role: 'staff',
                        createdAt: now,
                        updatedAt: now,
                    });
                    memberUser = await db
                        .select()
                        .from(users)
                        .where(eq(users.uid, phoneUid))
                        .limit(1)
                        .then((rows) => rows[0]);
                }
            }

            if (!memberUser) return c.json({ ok: false, message: 'Failed to create staff user.' }, 500);

            await db.update(users).set({
                ownerId: ownerUserId,
                role: 'staff',
                displayName: payload.displayName.trim(),
                phoneNumber: normalizedPhone,
                updatedAt: now,
            }).where(eq(users.uid, memberUser.uid));

            const existingMember = await db
                .select()
                .from(organizationMembers)
                .where(and(
                    eq(organizationMembers.userId, memberUser.uid),
                    eq(organizationMembers.organizationId, organizationId),
                ))
                .limit(1)
                .then((rows) => rows[0]);

            const mergedPermissions = {
                ...(payload.role === 'manager'
                    ? {
                        can_create_bill: true,
                        can_create_sale: true,
                        can_create_purchase: true,
                        can_back_date: true,
                        can_delete_bill: false,
                        can_view_cost_price: true,
                        can_view_dashboard: true,
                        can_view_reports: true,
                        can_manage_parties: true,
                        can_access_settings: false,
                        can_manage_staff: false,
                        can_manage_subscription: false,
                        can_manage_templates: true,
                        can_manage_inventory: true,
                        can_manage_expenses: true,
                        can_manage_payments: true,
                        can_send_messages: true,
                    }
                    : {
                        can_create_bill: true,
                        can_create_sale: true,
                        can_create_purchase: false,
                        can_back_date: false,
                        can_delete_bill: false,
                        can_view_cost_price: false,
                        can_view_dashboard: true,
                        can_view_reports: false,
                        can_manage_parties: false,
                        can_access_settings: false,
                        can_manage_staff: false,
                        can_manage_subscription: false,
                        can_manage_templates: false,
                        can_manage_inventory: true,
                        can_manage_expenses: false,
                        can_manage_payments: true,
                        can_send_messages: true,
                    }),
                ...(payload.permissions ?? {}),
            };

            if (!existingMember) {
                await db.insert(organizationMembers).values({
                    id: nanoid(),
                    userId: memberUser.uid,
                    organizationId,
                    role: payload.role,
                    permissions: mergedPermissions,
                    isActive: true,
                    invitedBy: authUser.uid,
                    phoneNumberSnapshot: normalizedPhone,
                    joinedAt: now,
                    createdAt: now,
                    updatedAt: now,
                });
            } else {
                await db.update(organizationMembers).set({
                    role: payload.role,
                    permissions: mergedPermissions,
                    isActive: true,
                    invitedBy: authUser.uid,
                    phoneNumberSnapshot: normalizedPhone,
                    updatedAt: now,
                }).where(eq(organizationMembers.id, existingMember.id));
            }

            await db.insert(staffInvites).values({
                id: nanoid(),
                ownerId: ownerUserId,
                organizationId,
                phoneNumber: normalizedPhone,
                role: payload.role,
                permissions: mergedPermissions,
                status: 'accepted',
                code: nanoid(8),
                expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                createdAt: now,
            });

            await writeAuditLog(db, {
                userId: ownerUserId,
                actorUid: authUser.uid,
                actorRole: authUser.role,
                module: 'admin',
                action: 'organization.member_upserted',
                entityType: 'organization_member',
                entityId: memberUser.uid,
                after: {
                    organizationId,
                    role: payload.role,
                    phoneNumber: normalizedPhone,
                },
            });

            return c.json({ ok: true, userId: memberUser.uid });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to add member.' }, 400);
        }
    }
);

organizationsRoute.patch(
    '/members/current/:memberId',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_staff'),
    async (c) => {
        try {
            const organizationId = c.get('organizationId');
            if (!organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

            const memberId = c.req.param('memberId');
            const payload = z.object({
                role: z.enum(['manager', 'salesman']).optional(),
                permissions: z.record(z.string(), z.boolean()).optional(),
                isActive: z.boolean().optional(),
            }).parse(await c.req.json());

            const updatePayload: Partial<typeof organizationMembers.$inferInsert> = {
                updatedAt: new Date(),
            };
            if (payload.role !== undefined) updatePayload.role = payload.role;
            if (payload.permissions !== undefined) updatePayload.permissions = payload.permissions;
            if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

            const db = c.get('db');
            const updated = await db
                .update(organizationMembers)
                .set(updatePayload)
                .where(and(
                    eq(organizationMembers.id, memberId),
                    eq(organizationMembers.organizationId, organizationId),
                ))
                .returning({ id: organizationMembers.id });
            if (!updated[0]) return c.json({ ok: false, message: 'Member not found.' }, 404);

            return c.json({ ok: true });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update member.' }, 400);
        }
    }
);

organizationsRoute.delete(
    '/members/current/:memberId',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_staff'),
    async (c) => {
        const organizationId = c.get('organizationId');
        if (!organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const memberId = c.req.param('memberId');
        const db = c.get('db');
        const updated = await db
            .update(organizationMembers)
            .set({ isActive: false, updatedAt: new Date() })
            .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId)))
            .returning({ id: organizationMembers.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Member not found.' }, 404);

        return c.json({ ok: true });
    }
);

organizationsRoute.get('/templates/current', requireAuth, withOrganizationContext, async (c) => {
    const organizationId = c.get('organizationId');
    const ownerUserId = c.get('organizationOwnerId');
    if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const db = c.get('db');
    const rows = await db
        .select()
        .from(billTemplates)
        .where(and(eq(billTemplates.organizationId, organizationId), eq(billTemplates.userId, ownerUserId)))
        .orderBy(asc(billTemplates.name));

    return c.json({ ok: true, templates: rows });
});

organizationsRoute.post(
    '/templates/current',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_templates'),
    async (c) => {
        try {
            const organizationId = c.get('organizationId');
            const ownerUserId = c.get('organizationOwnerId');
            if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

            const payload = z.object({
                templateKey: z.string().min(1),
                name: z.string().min(1).max(80),
                isPremium: z.boolean().default(false),
                layoutConfig: z.record(z.string(), z.unknown()).default({}),
            }).parse(await c.req.json());

            const id = nanoid();
            const now = new Date();
            const db = c.get('db');
            await db.insert(billTemplates).values({
                id,
                userId: ownerUserId,
                organizationId,
                templateKey: payload.templateKey,
                name: payload.name,
                isPremium: payload.isPremium,
                isActive: true,
                layoutConfig: payload.layoutConfig,
                createdAt: now,
                updatedAt: now,
            });

            return c.json({ ok: true, id });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create template.' }, 400);
        }
    }
);

organizationsRoute.get('/print-profiles/current', requireAuth, withOrganizationContext, async (c) => {
    const organizationId = c.get('organizationId');
    const ownerUserId = c.get('organizationOwnerId');
    if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const db = c.get('db');
    const rows = await db
        .select()
        .from(printProfiles)
        .where(and(eq(printProfiles.organizationId, organizationId), eq(printProfiles.userId, ownerUserId)))
        .orderBy(desc(printProfiles.isDefault), asc(printProfiles.name));

    return c.json({ ok: true, profiles: rows });
});

organizationsRoute.post(
    '/print-profiles/current',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_templates'),
    async (c) => {
        try {
            const organizationId = c.get('organizationId');
            const ownerUserId = c.get('organizationOwnerId');
            if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

            const payload = z.object({
                name: z.string().min(1).max(80),
                printerType: z.enum(['THERMAL', 'STANDARD']),
                paperSize: z.enum(['2INCH', '3INCH', 'A4', 'A5']),
                isDefault: z.boolean().default(false),
                settings: z.record(z.string(), z.unknown()).default({}),
            }).parse(await c.req.json());

            const db = c.get('db');
            const now = new Date();
            if (payload.isDefault) {
                await db
                    .update(printProfiles)
                    .set({ isDefault: false, updatedAt: now })
                    .where(and(eq(printProfiles.userId, ownerUserId), eq(printProfiles.organizationId, organizationId)));
            }

            const id = nanoid();
            await db.insert(printProfiles).values({
                id,
                userId: ownerUserId,
                organizationId,
                name: payload.name,
                printerType: payload.printerType,
                paperSize: payload.paperSize,
                isDefault: payload.isDefault,
                settings: payload.settings,
                createdAt: now,
                updatedAt: now,
            });

            return c.json({ ok: true, id });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create print profile.' }, 400);
        }
    }
);

organizationsRoute.get('/signatures/current', requireAuth, withOrganizationContext, async (c) => {
    const organizationId = c.get('organizationId');
    const ownerUserId = c.get('organizationOwnerId');
    if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const db = c.get('db');
    const rows = await db
        .select()
        .from(signatures)
        .where(and(eq(signatures.organizationId, organizationId), eq(signatures.userId, ownerUserId)))
        .orderBy(desc(signatures.isDefault), desc(signatures.updatedAt));

    return c.json({ ok: true, signatures: rows });
});

organizationsRoute.post(
    '/signatures/current',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_templates'),
    async (c) => {
        try {
            const organizationId = c.get('organizationId');
            const ownerUserId = c.get('organizationOwnerId');
            const authUser = c.get('authUser');
            if (!organizationId || !ownerUserId || !authUser) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

            const payload = z.object({
                name: z.string().max(80).optional(),
                signatureData: z.string().optional(),
                signatureUrl: z.string().url().optional(),
                isDefault: z.boolean().default(false),
            }).parse(await c.req.json());

            if (!payload.signatureData && !payload.signatureUrl) {
                return c.json({ ok: false, message: 'signatureData or signatureUrl is required.' }, 400);
            }

            const db = c.get('db');
            const now = new Date();
            if (payload.isDefault) {
                await db
                    .update(signatures)
                    .set({ isDefault: false, updatedAt: now })
                    .where(and(eq(signatures.userId, ownerUserId), eq(signatures.organizationId, organizationId)));
            }

            const id = nanoid();
            await db.insert(signatures).values({
                id,
                userId: ownerUserId,
                organizationId,
                name: payload.name ?? null,
                signatureData: payload.signatureData ?? null,
                signatureUrl: payload.signatureUrl ?? null,
                isDefault: payload.isDefault,
                createdByUid: authUser.uid,
                createdAt: now,
                updatedAt: now,
            });

            return c.json({ ok: true, id });
        } catch (error: unknown) {
            return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save signature.' }, 400);
        }
    }
);

organizationsRoute.post(
    '/signatures/current/:id/default',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_templates'),
    async (c) => {
        const organizationId = c.get('organizationId');
        const ownerUserId = c.get('organizationOwnerId');
        if (!organizationId || !ownerUserId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const id = c.req.param('id');
        const db = c.get('db');
        const now = new Date();
        await db
            .update(signatures)
            .set({ isDefault: false, updatedAt: now })
            .where(and(eq(signatures.userId, ownerUserId), eq(signatures.organizationId, organizationId)));
        const updated = await db
            .update(signatures)
            .set({ isDefault: true, updatedAt: now })
            .where(and(eq(signatures.id, id), eq(signatures.userId, ownerUserId), eq(signatures.organizationId, organizationId)))
            .returning({ id: signatures.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Signature not found.' }, 404);

        return c.json({ ok: true });
    }
);

export default organizationsRoute;
