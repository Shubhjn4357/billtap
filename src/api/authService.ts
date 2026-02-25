import type { UserProfile } from '../types';
import { apiClient, ApiError } from './httpClient';
import { offlineSyncService } from './syncService';
import { clearSessionToken, getSessionToken, setSessionToken } from './session';
import { normalizeUserProfile } from '../utils/userRole';

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface PhoneVerificationSession {
    verificationId: string;
    testCode?: string; // Kept for interface compatibility, mostly unused now
    expiresAt?: string;
}

interface AuthResponse {
    ok: boolean;
    token: string;
    user: UserProfile;
    message?: string;
}

const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new ApiError(message, 0)), ms);
        });
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

let _confirmationResult: FirebaseAuthTypes.ConfirmationResult | null = null;

export const authService = {
    async googleSignIn(idToken: string): Promise<UserProfile> {
        const response = await apiClient.post<AuthResponse>('/auth/google', { idToken }, { skipAuth: true });

        if (!response.ok || !response.token || !response.user) {
            throw new Error(response.message || 'Unable to sign in with Google.');
        }

        await setSessionToken(response.token);
        return normalizeUserProfile(response.user);
    },

    async sendPhoneVerification(phoneNumber: string): Promise<PhoneVerificationSession> {
        // Use Firebase Native SDK for OTP
        try {
            const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
            _confirmationResult = confirmation;
            return {
                verificationId: confirmation.verificationId || 'firebase-verification',
            };
        } catch (error: any) {
            throw new Error(error.message || 'Unable to send OTP via Firebase.');
        }
    },

    async confirmPhoneVerification(verificationId: string, verificationCode: string): Promise<UserProfile> {
        if (!_confirmationResult) {
            throw new Error('No pending phone verification session found.');
        }

        try {
            // 1. Verify OTP with Firebase
            const userCredential = await _confirmationResult.confirm(verificationCode);

            if (!userCredential?.user) {
                throw new Error('Failed to confirm Firebase phone verification.');
            }

            // 2. Get the Firebase ID token
            const idToken = await userCredential.user.getIdToken();

        // 3. Exchange Firebase token for our backend JWT
            const response = await apiClient.post<AuthResponse>(
                '/auth/firebase',
                { idToken },
                { skipAuth: true }
            );

            if (!response.ok || !response.token || !response.user) {
                throw new Error(response.message || 'Unable to authenticate with backend.');
            }

            await setSessionToken(response.token);
            return normalizeUserProfile(response.user);

        } catch (error: any) {
            throw new Error(error.message || 'Unable to verify code.');
        } finally {
            _confirmationResult = null; // Clear session
        }
    },

    async getCurrentUser(): Promise<UserProfile | null> {
        // Avoid startup network calls when no session exists (common release-build stall case).
        const token = await getSessionToken();
        if (!token) {
            return null;
        }

        try {
            const response = await withTimeout(
                apiClient.get<{ ok: boolean; user?: UserProfile; message?: string }>('/auth/me'),
                7000,
                'Profile request timed out.'
            );
            if (!response.ok || !response.user) return null;
            return normalizeUserProfile(response.user);
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
