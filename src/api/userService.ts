import { useUserStore } from '../store';
import type { UserProfile } from '../types';
import { isOnline } from '../utils/network';
import { apiClient } from './httpClient';
import { offlineSyncService } from './syncService';
import { shouldThrowClientApiError } from '../utils/errorGuards';

const getLocalMergedUser = (payload: Partial<UserProfile>): UserProfile | null => {
    const localUser = useUserStore.getState().user;
    if (!localUser) return null;

    return {
        ...localUser,
        ...payload,
        uid: localUser.uid,
    };
};

export const userService = {
    async getCurrentUser(): Promise<UserProfile> {
        const response = await apiClient.get<{ ok: boolean; user?: UserProfile; message?: string }>('/users/me');
        if (!response.ok || !response.user) {
            throw new Error(response.message || 'Failed to load profile.');
        }
        return response.user;
    },

    async updateCurrentUser(payload: Partial<UserProfile>): Promise<UserProfile> {
        const fallbackUser = getLocalMergedUser(payload);
        if (!fallbackUser) {
            throw new Error('No authenticated user found.');
        }

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.patch<{ ok: boolean; user?: UserProfile; message?: string }>('/users/me', payload);
                if (!response.ok || !response.user) {
                    throw new Error(response.message || 'Failed to update profile.');
                }
                return response.user;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) {
                    throw error;
                }
            }
        }

        await offlineSyncService.enqueueMutation({
            type: 'update_user_me',
            payload,
        });

        return fallbackUser;
    },

    async linkPhoneNumber(verificationId: string, verificationCode: string): Promise<UserProfile> {
        const response = await apiClient.post<{ ok: boolean; user?: UserProfile; message?: string }>(
            '/users/me/phone/link',
            { verificationId, verificationCode }
        );

        if (!response.ok || !response.user) {
            throw new Error(response.message || 'Failed to link phone number.');
        }

        return response.user;
    },
};
