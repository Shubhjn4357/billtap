import { apiClient } from './httpClient';
import { offlineSyncService } from './syncService';
import { isNetworkLikeError } from '../utils/errorGuards';
import {
    getOrgCachedValue,
    ORG_CONTEXT_CACHE_KEY,
    ORG_LIST_CACHE_KEY,
    ORG_MEMBERS_CACHE_KEY,
    ORG_SETTINGS_CACHE_KEY,
    ORG_SIGNATURES_CACHE_KEY,
    ORG_TEMPLATES_CACHE_KEY,
    setOrgCachedValue,
} from './businessSuiteCache';
import { useUserStore } from '../store';

export type StaffRole = 'owner' | 'manager' | 'salesman';

export type StaffPermissionKey =
    | 'can_create_bill'
    | 'can_create_sale'
    | 'can_create_purchase'
    | 'can_back_date'
    | 'can_delete_bill'
    | 'can_view_cost_price'
    | 'can_view_dashboard'
    | 'can_view_reports'
    | 'can_manage_parties'
    | 'can_access_settings'
    | 'can_manage_staff'
    | 'can_manage_subscription'
    | 'can_manage_templates'
    | 'can_manage_inventory'
    | 'can_manage_expenses'
    | 'can_manage_payments'
    | 'can_send_messages';

export type StaffPermissions = Partial<Record<StaffPermissionKey, boolean>>;

export interface OrganizationSummary {
    id: string;
    userId: string;
    name: string;
    code: string;
    currency?: string | null;
    gstNumber?: string | null;
    address?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
}

export interface OrganizationMembership {
    id: string;
    name: string;
    code: string;
    currency?: string | null;
    role: StaffRole;
    permissions: StaffPermissions;
}

export interface OrganizationContextPayload {
    role: StaffRole;
    permissions: StaffPermissions;
    ownerUserId: string;
    settings: Record<string, unknown>;
}

export interface OrganizationMemberUser {
    uid: string;
    displayName?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
}

export interface OrganizationMember {
    id: string;
    userId: string;
    organizationId: string;
    role: StaffRole;
    permissions: StaffPermissions;
    isActive: boolean;
    phoneNumberSnapshot?: string | null;
    joinedAt?: string;
    user?: OrganizationMemberUser | null;
}

export interface BillTemplateEntry {
    id: string;
    templateKey: string;
    name: string;
    isPremium: boolean;
    isActive: boolean;
    layoutConfig?: Record<string, unknown>;
}

export interface SignatureEntry {
    id: string;
    name?: string | null;
    signatureData?: string | null;
    signatureUrl?: string | null;
    isDefault: boolean;
    createdAt?: string;
    updatedAt?: string;
}

const withOrgQuery = (path: string, organizationId?: string): string => {
    if (!organizationId) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}organizationId=${encodeURIComponent(organizationId)}`;
};

const getCurrentUserId = (): string | undefined => {
    const uid = useUserStore.getState().user?.uid?.trim();
    return uid || undefined;
};

const getOrgListCacheSlot = (): string | undefined => {
    const uid = getCurrentUserId();
    return uid ? `user:${uid}` : '__user_unknown__';
};

const getOrgContextDefaultSlot = (): string | undefined => {
    const uid = getCurrentUserId();
    return uid ? `user:${uid}` : '__user_unknown__';
};

export const businessSuiteService = {
    async getMyOrganizations(): Promise<OrganizationMembership[]> {
        const listCacheSlot = getOrgListCacheSlot();
        try {
            const response = await apiClient.get<{
                ok: boolean;
                organizations?: OrganizationMembership[];
                message?: string;
            }>('/organizations/mine');

            if (!response.ok || !response.organizations) {
                throw new Error(response.message || 'Failed to load organizations.');
            }

            await setOrgCachedValue<OrganizationMembership[]>(ORG_LIST_CACHE_KEY, listCacheSlot, response.organizations);
            return response.organizations;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }
            const cached = await getOrgCachedValue<OrganizationMembership[]>(ORG_LIST_CACHE_KEY, listCacheSlot);
            if (cached) return cached;
            throw error;
        }
    },

    async createOrganization(payload: {
        name: string;
        code: string;
        currency?: string;
        phoneNumber?: string;
        email?: string;
        gstNumber?: string;
        address?: string;
    }): Promise<string> {
        const listCacheSlot = getOrgListCacheSlot();
        const response = await apiClient.post<{
            ok: boolean;
            id?: string;
            message?: string;
        }>('/organizations', payload);

        if (!response.ok || !response.id) {
            throw new Error(response.message || 'Failed to create organization.');
        }

        const cached = await getOrgCachedValue<OrganizationMembership[]>(ORG_LIST_CACHE_KEY, listCacheSlot) ?? [];
        const next: OrganizationMembership[] = [
            ...cached,
            {
                id: response.id,
                name: payload.name,
                code: payload.code,
                currency: payload.currency ?? null,
                role: 'owner',
                permissions: {},
            },
        ];
        await setOrgCachedValue<OrganizationMembership[]>(ORG_LIST_CACHE_KEY, listCacheSlot, next);

        return response.id;
    },

    async getCurrentOrganization(organizationId?: string): Promise<{
        organization: OrganizationSummary;
        context: OrganizationContextPayload;
    }> {
        const defaultContextCacheSlot = getOrgContextDefaultSlot();
        try {
            const response = await apiClient.get<{
                ok: boolean;
                organization?: OrganizationSummary;
                context?: OrganizationContextPayload;
                message?: string;
            }>(withOrgQuery('/organizations/current', organizationId));

            if (!response.ok || !response.organization || !response.context) {
                throw new Error(response.message || 'Failed to load organization context.');
            }

            const payload = {
                organization: response.organization,
                context: response.context,
            };
            // Persist exact-org and user-scoped default slots.
            await setOrgCachedValue(ORG_CONTEXT_CACHE_KEY, response.organization.id, payload);
            await setOrgCachedValue(ORG_CONTEXT_CACHE_KEY, defaultContextCacheSlot, payload);
            return payload;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }
            const cached = await getOrgCachedValue<{
                organization: OrganizationSummary;
                context: OrganizationContextPayload;
            }>(ORG_CONTEXT_CACHE_KEY, organizationId);
            if (cached) return cached;

            const userScopedCached = await getOrgCachedValue<{
                organization: OrganizationSummary;
                context: OrganizationContextPayload;
            }>(ORG_CONTEXT_CACHE_KEY, defaultContextCacheSlot);
            if (userScopedCached) return userScopedCached;
            throw error;
        }
    },

    async getOrganizationMembers(organizationId?: string): Promise<OrganizationMember[]> {
        try {
            const response = await apiClient.get<{
                ok: boolean;
                members?: OrganizationMember[];
                message?: string;
            }>(withOrgQuery('/organizations/members/current', organizationId));

            if (!response.ok || !response.members) {
                throw new Error(response.message || 'Failed to load organization members.');
            }

            await setOrgCachedValue<OrganizationMember[]>(ORG_MEMBERS_CACHE_KEY, organizationId, response.members);
            return response.members;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }
            const cached = await getOrgCachedValue<OrganizationMember[]>(ORG_MEMBERS_CACHE_KEY, organizationId);
            if (cached) return cached;
            throw error;
        }
    },

    async addOrganizationMember(payload: {
        displayName: string;
        phoneNumber: string;
        role: 'manager' | 'salesman';
        permissions?: StaffPermissions;
    }, organizationId?: string): Promise<string> {
        const response = await apiClient.post<{
            ok: boolean;
            userId?: string;
            message?: string;
        }>(withOrgQuery('/organizations/members/current', organizationId), payload);

        if (!response.ok || !response.userId) {
            throw new Error(response.message || 'Failed to add staff member.');
        }

        const cached = await getOrgCachedValue<OrganizationMember[]>(ORG_MEMBERS_CACHE_KEY, organizationId) ?? [];
        await setOrgCachedValue<OrganizationMember[]>(
            ORG_MEMBERS_CACHE_KEY,
            organizationId,
            [
                ...cached,
                {
                    id: offlineSyncService.createLocalId('member'),
                    userId: response.userId,
                    organizationId: organizationId ?? '',
                    role: payload.role,
                    permissions: payload.permissions ?? {},
                    isActive: true,
                    phoneNumberSnapshot: payload.phoneNumber,
                    user: {
                        uid: response.userId,
                        displayName: payload.displayName,
                        phoneNumber: payload.phoneNumber,
                    },
                },
            ]
        );

        return response.userId;
    },

    async updateOrganizationMember(
        memberId: string,
        payload: { role?: 'manager' | 'salesman'; permissions?: StaffPermissions; isActive?: boolean },
        organizationId?: string
    ): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(
            withOrgQuery(`/organizations/members/current/${memberId}`, organizationId),
            payload
        );
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update member.');
        }

        const cached = await getOrgCachedValue<OrganizationMember[]>(ORG_MEMBERS_CACHE_KEY, organizationId);
        if (!cached) return;
        await setOrgCachedValue<OrganizationMember[]>(
            ORG_MEMBERS_CACHE_KEY,
            organizationId,
            cached.map((entry) => (
                entry.id === memberId
                    ? {
                        ...entry,
                        role: payload.role ?? entry.role,
                        permissions: payload.permissions ?? entry.permissions,
                        isActive: payload.isActive ?? entry.isActive,
                    }
                    : entry
            ))
        );
    },

    async removeOrganizationMember(memberId: string, organizationId?: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(
            withOrgQuery(`/organizations/members/current/${memberId}`, organizationId)
        );
        if (!response.ok) {
            throw new Error(response.message || 'Failed to remove member.');
        }

        const cached = await getOrgCachedValue<OrganizationMember[]>(ORG_MEMBERS_CACHE_KEY, organizationId);
        if (!cached) return;
        await setOrgCachedValue<OrganizationMember[]>(
            ORG_MEMBERS_CACHE_KEY,
            organizationId,
            cached.filter((entry) => entry.id !== memberId)
        );
    },

    async getOrganizationSettings(organizationId?: string): Promise<Record<string, unknown>> {
        try {
            const response = await apiClient.get<{
                ok: boolean;
                settings?: Record<string, unknown>;
                message?: string;
            }>(withOrgQuery('/organizations/settings/current', organizationId));

            if (!response.ok || !response.settings) {
                throw new Error(response.message || 'Failed to load organization settings.');
            }

            await setOrgCachedValue<Record<string, unknown>>(ORG_SETTINGS_CACHE_KEY, organizationId, response.settings);
            return response.settings;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }

            const cached = await getOrgCachedValue<Record<string, unknown>>(ORG_SETTINGS_CACHE_KEY, organizationId);
            if (cached) return cached;
            throw error;
        }
    },

    async updateOrganizationSettings(
        settings: Record<string, unknown>,
        organizationId?: string
    ): Promise<Record<string, unknown>> {
        try {
            const response = await apiClient.put<{
                ok: boolean;
                settings?: Record<string, unknown>;
                message?: string;
            }>(withOrgQuery('/organizations/settings/current', organizationId), { settings });

            if (!response.ok || !response.settings) {
                throw new Error(response.message || 'Failed to update organization settings.');
            }

            await setOrgCachedValue<Record<string, unknown>>(ORG_SETTINGS_CACHE_KEY, organizationId, response.settings);
            return response.settings;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }

            await setOrgCachedValue<Record<string, unknown>>(ORG_SETTINGS_CACHE_KEY, organizationId, settings);
            await offlineSyncService.enqueueMutation({
                type: 'update_organization_settings',
                payload: {
                    organizationId,
                    settings,
                },
            });
            return settings;
        }
    },

    async getTemplates(organizationId?: string): Promise<BillTemplateEntry[]> {
        try {
            const response = await apiClient.get<{ ok: boolean; templates?: BillTemplateEntry[]; message?: string }>(
                withOrgQuery('/organizations/templates/current', organizationId)
            );

            if (!response.ok || !response.templates) {
                throw new Error(response.message || 'Failed to load templates.');
            }

            await setOrgCachedValue<BillTemplateEntry[]>(ORG_TEMPLATES_CACHE_KEY, organizationId, response.templates);
            return response.templates;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }

            const cached = await getOrgCachedValue<BillTemplateEntry[]>(ORG_TEMPLATES_CACHE_KEY, organizationId);
            if (cached) return cached;
            throw error;
        }
    },

    async getSignatures(organizationId?: string): Promise<SignatureEntry[]> {
        try {
            const response = await apiClient.get<{ ok: boolean; signatures?: SignatureEntry[]; message?: string }>(
                withOrgQuery('/organizations/signatures/current', organizationId)
            );
            if (!response.ok || !response.signatures) {
                throw new Error(response.message || 'Failed to load signatures.');
            }

            await setOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId, response.signatures);
            return response.signatures;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }

            const cached = await getOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId);
            if (cached) return cached;
            throw error;
        }
    },

    async createSignature(payload: {
        name?: string;
        signatureData?: string;
        signatureUrl?: string;
        isDefault?: boolean;
    }, organizationId?: string): Promise<string> {
        try {
            const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
                withOrgQuery('/organizations/signatures/current', organizationId),
                payload
            );
            if (!response.ok || !response.id) {
                throw new Error(response.message || 'Failed to save signature.');
            }

            const cached = await getOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId) ?? [];
            const nextEntry: SignatureEntry = {
                id: response.id,
                name: payload.name ?? null,
                signatureData: payload.signatureData ?? null,
                signatureUrl: payload.signatureUrl ?? null,
                isDefault: Boolean(payload.isDefault),
            };
            const next = [...cached.filter((entry) => entry.id !== response.id), nextEntry].map((entry) => ({
                ...entry,
                isDefault: nextEntry.isDefault ? entry.id === nextEntry.id : entry.isDefault,
            }));
            await setOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId, next);
            return response.id;
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }

            const localId = offlineSyncService.createLocalId('signature');
            const cached = await getOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId) ?? [];
            const shouldDefault = payload.isDefault ?? cached.length === 0;
            const nextEntry: SignatureEntry = {
                id: localId,
                name: payload.name ?? null,
                signatureData: payload.signatureData ?? null,
                signatureUrl: payload.signatureUrl ?? null,
                isDefault: shouldDefault,
            };
            const next = [...cached.filter((entry) => entry.id !== localId), nextEntry].map((entry) => ({
                ...entry,
                isDefault: shouldDefault ? entry.id === localId : entry.isDefault,
            }));
            await setOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId, next);
            await offlineSyncService.enqueueMutation({
                type: 'create_signature',
                payload: {
                    organizationId,
                    localId,
                    name: payload.name,
                    signatureData: payload.signatureData,
                    signatureUrl: payload.signatureUrl,
                    isDefault: shouldDefault,
                },
            });
            return localId;
        }
    },

    async setDefaultSignature(signatureId: string, organizationId?: string): Promise<void> {
        let queuedForLater = false;
        try {
            const response = await apiClient.post<{ ok: boolean; message?: string }>(
                withOrgQuery(`/organizations/signatures/current/${signatureId}/default`, organizationId)
            );
            if (!response.ok) {
                throw new Error(response.message || 'Failed to set default signature.');
            }
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                throw error;
            }
            queuedForLater = true;
            await offlineSyncService.enqueueMutation({
                type: 'set_default_signature',
                payload: {
                    organizationId,
                    signatureId,
                },
            });
        }

        const cached = await getOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId);
        if (!cached || cached.length === 0) return;
        const next = cached.map((entry) => ({ ...entry, isDefault: entry.id === signatureId }));
        await setOrgCachedValue<SignatureEntry[]>(ORG_SIGNATURES_CACHE_KEY, organizationId, next);
        if (queuedForLater) return;
    },
};
