import { ApplicationVerifier, User, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { authService } from '../api/authService';
import { auth } from '../api/firebaseConfig';
import { useUserStore } from '../store';

export const useAuth = () => {
    const { setUser, setLoading } = useUserStore();
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setFirebaseUser(authUser);
            if (authUser) {
                // Map Firebase User to UserProfile
                // In a real app, fetch additional profile data from Firestore here
                setUser({
                    uid: authUser.uid,
                    email: authUser.email,
                    phoneNumber: authUser.phoneNumber,
                    displayName: authUser.displayName,
                    photoURL: authUser.photoURL,
                });
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [setLoading, setUser]);

    const signInWithGoogle = async (idToken: string) => {
        return await authService.googleSignIn(idToken);
    };

    const sendPhoneVerification = async (phoneNumber: string, recaptchaVerifier?: ApplicationVerifier) => {
        return await authService.sendPhoneVerification(phoneNumber, recaptchaVerifier);
    };

    const confirmPhoneVerification = async (verificationId: string, code: string) => {
        return await authService.confirmPhoneVerification(verificationId, code);
    };

    const signOut = async () => {
        return await authService.signOut();
    };

    return {
        user: firebaseUser,
        loading: useUserStore(s => s.isLoading),
        signInWithGoogle,
        sendPhoneVerification,
        confirmPhoneVerification,
        signOut
    };
};
