import { useCallback, useMemo } from 'react';
import { authService } from '../api/authService';
import { useOrganizationStore, useUserStore } from '../store';

export const useAuth = () => {
    const { user, isLoading, setUser } = useUserStore();
    const { setSelectedOrganizationId } = useOrganizationStore();

    const signInWithGoogle = useCallback(async (idToken: string) => {
        const profile = await authService.googleSignIn(idToken);
        setUser(profile);
        return profile;
    }, [setUser]);

    const sendPhoneVerification = useCallback(async (phoneNumber: string) => {
        return await authService.sendPhoneVerification(phoneNumber);
    }, []);

    const confirmPhoneVerification = useCallback(async (verificationId: string, verificationCode: string) => {
        const profile = await authService.confirmPhoneVerification(verificationId, verificationCode);
        setUser(profile);
        return profile;
    }, [setUser]);

    const signOut = useCallback(async () => {
        await authService.signOut();
        setSelectedOrganizationId(null);
        setUser(null);
    }, [setSelectedOrganizationId, setUser]);

    return useMemo(() => ({
        user,
        signInWithGoogle,
        sendPhoneVerification,
        confirmPhoneVerification,
        signOut,
        loading: isLoading
    }), [user, signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, signOut, isLoading]);
};
