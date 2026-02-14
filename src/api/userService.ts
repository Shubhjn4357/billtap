import { useUserStore } from '../store';
import type { UserProfile } from '../types';
import { isOnline } from '../utils/network';
import { apiClient, ApiError } from './httpClient';
import { offlineSyncService } from './offlineSyncService';

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
                if (error instanceof ApiError && error.status < 500 && error.status !== 408) {
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
};
