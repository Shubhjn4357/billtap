import { api } from '../api/client';
import {
    mapApiSubscription,
    mapLegacyProfileToSubscription,
    mapLegacyProfileToUser,
    normalizeOrganizationRole,
    type OrganizationRole,
} from '../mappers/authMappers';
import type {
    ApiResponse,
    AuthResponse,
    GoogleAuthPayload,
} from '../types/api';
import type { Subscription, User } from '../types/domain';

const requireUserPayload = (
    response: { ok: boolean; user?: Record<string, unknown>; message?: string },
    fallbackMessage: string
) => {
    if (!response.ok || !response.user) {
        throw new Error(response.message ?? fallbackMessage);
    }
    return response.user;
};

export const authRepository = {
    googleSignIn: (payload: GoogleAuthPayload) =>
        api.post<AuthResponse>('/api/auth/google', payload),

    me: async (): Promise<ApiResponse<User>> => {
        const response = await api.get<{ ok: boolean; user?: Record<string, unknown>; message?: string }>('/api/users/me');
        const user = requireUserPayload(response, 'Failed to load profile.');
        return {
            ok: true,
            data: mapLegacyProfileToUser(user),
            message: response.message,
        };
    },

    getSessionContext: async (businessId?: string | null): Promise<ApiResponse<{
        user: User;
        subscription: Subscription | null;
        organizationRole: OrganizationRole;
    }>> => {
        const response = await api.get<{ ok: boolean; user?: Record<string, unknown>; message?: string }>('/api/users/me');
        const profile = requireUserPayload(response, 'Failed to load profile.');
        let subscription: Subscription | null = null;

        try {
            const subscriptionResponse = await api.get<{
                ok: boolean;
                businessId?: string;
                subscription?: Record<string, unknown> | null;
                message?: string;
            }>('/api/subscription/current');

            if (subscriptionResponse.ok) {
                subscription = subscriptionResponse.subscription
                    ? mapApiSubscription(subscriptionResponse.subscription, subscriptionResponse.businessId ?? businessId ?? null)
                    : null;
            }
        } catch {
            subscription = mapLegacyProfileToSubscription(profile, businessId ?? null);
        }

        return {
            ok: true,
            data: {
                user: mapLegacyProfileToUser(profile),
                subscription,
                organizationRole: normalizeOrganizationRole(profile.role),
            },
            message: response.message,
        };
    },

    updateProfile: async (data: Partial<Pick<User, 'name' | 'phone'>>): Promise<ApiResponse<User>> => {
        const response = await api.patch<{ ok: boolean; user?: Record<string, unknown>; message?: string }>('/api/users/me', {
            ...(data.name !== undefined ? { displayName: data.name } : {}),
            ...(data.phone !== undefined ? { phoneNumber: data.phone } : {}),
        });
        const user = requireUserPayload(response, 'Failed to update profile.');
        return {
            ok: true,
            data: mapLegacyProfileToUser(user),
            message: response.message,
        };
    },
};
