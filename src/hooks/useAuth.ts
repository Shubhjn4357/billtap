import { useCallback, useMemo } from 'react';
import { authService } from '../api/authService';
import { useOrganizationStore, useUserStore } from '../store';

export const useAuth = () => {
    const user = useUserStore((state) => state.user);
    const isLoading = useUserStore((state) => state.isLoading);
    const setUser = useUserStore((state) => state.setUser);
    const setSelectedOrganizationId = useOrganizationStore((state) => state.setSelectedOrganizationId);
    const clearOrganizationContext = useOrganizationStore((state) => state.clearOrganizationContext);

    const signInWithGoogle = useCallback(async (idToken: string) => {
        const profile = await authService.googleSignIn(idToken);
        setSelectedOrganizationId(null);
        clearOrganizationContext();
        setUser(profile);
        return profile;
    }, [clearOrganizationContext, setSelectedOrganizationId, setUser]);

    const sendPhoneVerification = useCallback(async (phoneNumber: string) => {
        return await authService.sendPhoneVerification(phoneNumber);
    }, []);

    const confirmPhoneVerification = useCallback(async (verificationId: string, verificationCode: string) => {
        const profile = await authService.confirmPhoneVerification(verificationId, verificationCode);
        setSelectedOrganizationId(null);
        clearOrganizationContext();
        setUser(profile);
        return profile;
    }, [clearOrganizationContext, setSelectedOrganizationId, setUser]);

    const signOut = useCallback(async () => {
        await authService.signOut();
        setSelectedOrganizationId(null);
        clearOrganizationContext();
        setUser(null);
    }, [clearOrganizationContext, setSelectedOrganizationId, setUser]);

    return useMemo(() => ({
        user,
        signInWithGoogle,
        sendPhoneVerification,
        confirmPhoneVerification,
        signOut,
        loading: isLoading
    }), [user, signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, signOut, isLoading]);
};
