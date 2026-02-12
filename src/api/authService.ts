
import { 
    GoogleAuthProvider, 
    PhoneAuthProvider, 
    signInWithCredential, 
    signOut as firebaseSignOut,
    User
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export const authService = {
    /**
     * Completes the Google Sign-In process using the identity token received from Google.
     * @param idToken The identity token from Google Auth.
     */
    async googleSignIn(idToken: string): Promise<User> {
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
    async sendPhoneVerification(phoneNumber: string, recaptchaVerifier: any): Promise<string> {
        const phoneProvider = new PhoneAuthProvider(auth);
        return await phoneProvider.verifyPhoneNumber(phoneNumber, recaptchaVerifier);
    },

    /**
     * Confirms the phone verification code and signs in the user.
     * @param verificationId The verification ID received from sendPhoneVerification.
     * @param verificationCode The code entered by the user.
     */
    async confirmPhoneVerification(verificationId: string, verificationCode: string): Promise<User> {
        const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
        const result = await signInWithCredential(auth, credential);
        return result.user;
    },

    /**
     * Signs out the current user.
     */
    async signOut(): Promise<void> {
        await firebaseSignOut(auth);
    },

    /**
     * Gets the current user.
     */
    getCurrentUser(): User | null {
        return auth.currentUser;
    }
};
