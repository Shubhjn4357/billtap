import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useUserStore } from '../store';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export const useAuth = () => {
    const { setUser, setLoading } = useUserStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            if (user) {
                try {
                    // Fetch additional user data from Firestore
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    let userData: UserProfile;

                    if (userDoc.exists()) {
                        userData = userDoc.data() as UserProfile;
                    } else {
                        // New user (or document missing), create basic profile
                        // We'll let the onboarding screen handle the creation properly if missing business info
                        userData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                        };
                    }
                    setUser(userData);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    // Still set basic user info even if DB fail so they aren't stuck
                    setUser({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                    });
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [setUser, setLoading]);
};
