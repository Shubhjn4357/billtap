import type { ApplicationVerifier } from 'firebase/auth';
import { useCallback, useMemo } from 'react';
import { authService } from '../api/authService';
import { useUserStore } from '../store';

export const useAuth = () => {
    const { user, isLoading, setUser } = useUserStore();

    const signInWithGoogle = useCallback(async (idToken: string) => {
        return await authService.googleSignIn(idToken);
    }, []);

    const sendPhoneVerification = useCallback(async (phoneNumber: string, recaptchaVerifier?: ApplicationVerifier) => {
        return await authService.sendPhoneVerification(phoneNumber, recaptchaVerifier);
    }, []);

    const confirmPhoneVerification = useCallback(async (verificationId: string, verificationCode: string) => {
        return await authService.confirmPhoneVerification(verificationId, verificationCode);
    }, []);

    const signOut = useCallback(async () => {
        await authService.signOut();
        setUser(null);
    }, [setUser]);

    return useMemo(() => ({
        user,
        signInWithGoogle,
        sendPhoneVerification,
        confirmPhoneVerification,
        signOut,
        loading: isLoading
    }), [user, signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, signOut, isLoading]);
};
