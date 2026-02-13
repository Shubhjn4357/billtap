import {
    ApplicationVerifier,
    GoogleAuthProvider,
    PhoneAuthProvider,
    User,
    browserLocalPersistence,
    setPersistence,
    signOut as firebaseSignOut,
    signInWithCredential
} from 'firebase/auth';
import { auth } from './firebaseConfig';
import { Platform } from 'react-native';

export const authService = {
    /**
     * Completes the Google Sign-In process using the identity token received from Google.
     * @param idToken The identity token from Google Auth.
     */
    async googleSignIn(idToken: string): Promise<User> {
        if (Platform.OS === 'web') {
            await setPersistence(auth, browserLocalPersistence);
        }
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        return result.user;
    },

    /**
     * Sends a verification code to the provided phone number.
     * @param phoneNumber The phone number to verify (e.g., +1234567890).
     * @param recaptchaVerifier The reCAPTCHA verifier instance.
     * @returns A Promise resolving to the verification ID.
     */
    async sendPhoneVerification(phoneNumber: string, recaptchaVerifier?: ApplicationVerifier): Promise<string> {
        if (Platform.OS === 'web' && !recaptchaVerifier) {
            throw new Error('Phone sign-in on web requires a reCAPTCHA verifier.');
        }

        const phoneProvider = new PhoneAuthProvider(auth);
        return await phoneProvider.verifyPhoneNumber(phoneNumber, recaptchaVerifier);
    },

    /**
     * Confirms the phone number verification using the verification ID and code.
     * @param verificationId The verification ID received from verifyPhoneNumber.
     * @param verificationCode The verification code entered by the user.
     */
    async confirmPhoneVerification(verificationId: string, verificationCode: string): Promise<User> {
        const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
        const result = await signInWithCredential(auth, credential);
        return result.user;
    },

    async signOut() {
        return await firebaseSignOut(auth);
    }
};
