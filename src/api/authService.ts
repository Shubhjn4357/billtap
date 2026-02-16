import type { UserProfile } from '../types';
import { apiClient, ApiError } from './httpClient';
import { offlineSyncService } from './offlineSyncService';
import { clearSessionToken, getSessionToken, setSessionToken } from './session';

export interface PhoneVerificationSession {
    verificationId: string;
    testCode?: string;
    expiresAt?: string;
}

interface AuthResponse {
    ok: boolean;
    token: string;
    user: UserProfile;
    message?: string;
}

export const authService = {
    async googleSignIn(idToken: string): Promise<UserProfile> {
        const response = await apiClient.post<AuthResponse>('/auth/google', { idToken }, { skipAuth: true });

        if (!response.ok || !response.token || !response.user) {
            throw new Error(response.message || 'Unable to sign in with Google.');
        }

        await setSessionToken(response.token);
        return response.user;
    },

    async sendPhoneVerification(phoneNumber: string): Promise<PhoneVerificationSession> {
        const response = await apiClient.post<{
            ok: boolean;
            verificationId: string;
            testCode?: string;
            expiresAt?: string;
            message?: string;
        }>('/auth/phone/send', { phoneNumber }, { skipAuth: true });

        if (!response.ok || !response.verificationId) {
            throw new Error(response.message || 'Unable to send OTP.');
        }

        return {
            verificationId: response.verificationId,
            testCode: response.testCode,
            expiresAt: response.expiresAt,
        };
    },

    async confirmPhoneVerification(verificationId: string, verificationCode: string): Promise<UserProfile> {
        const response = await apiClient.post<AuthResponse>(
            '/auth/phone/verify',
            { verificationId, verificationCode },
            { skipAuth: true }
        );

        if (!response.ok || !response.token || !response.user) {
            throw new Error(response.message || 'Unable to verify OTP.');
        }

        await setSessionToken(response.token);
        return response.user;
    },

    async getCurrentUser(): Promise<UserProfile | null> {
        // Avoid startup network calls when no session exists (common release-build stall case).
        const token = await getSessionToken();
        if (!token) {
            return null;
        }

        try {
            const response = await apiClient.get<{ ok: boolean; user?: UserProfile; message?: string }>('/auth/me');
            if (!response.ok || !response.user) return null;
            return response.user;
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                await clearSessionToken();
                return null;
            }
            throw error;
        }
    },

    async signOut(): Promise<void> {
        try {
            await apiClient.post<{ ok: boolean }>('/auth/logout');
        } catch {
            // Ignore network errors during local sign out.
        } finally {
            await offlineSyncService.clearAllLocalData();
            await clearSessionToken();
        }
    }
};
