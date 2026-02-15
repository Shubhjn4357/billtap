import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export interface NativeGoogleSignInConfig {
    webClientId?: string;
    androidClientId?: string;
}

export interface NativeGoogleSignInResult {
    idToken: string;
}

let lastConfiguredKey = '';

export const configureNativeGoogleSignIn = async (config: NativeGoogleSignInConfig): Promise<void> => {
    if (!config.webClientId) {
        throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required for Android native Google sign-in.');
    }

    const nextKey = `${config.webClientId}|${config.androidClientId ?? ''}`;
    if (lastConfiguredKey === nextKey) return;

    GoogleSignin.configure({
        webClientId: config.webClientId,
        offlineAccess: false,
        scopes: ['profile', 'email'],
    });

    lastConfiguredKey = nextKey;
};

export const signInWithNativeGoogle = async (): Promise<NativeGoogleSignInResult> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
        throw new Error('Google sign-in was cancelled.');
    }

    const idToken = response.data.idToken;
    if (!idToken) {
        throw new Error('Google did not return an ID token. Check OAuth client configuration.');
    }

    return { idToken };
};

export const getNativeGoogleErrorMessage = (error: unknown): string => {
    // statusCodes is imported directly now

    if (error && typeof error === 'object' && 'code' in error) {
        const code = String((error as { code?: unknown }).code ?? '');
        console.error('Native Google Sign-In Error Code:', code, JSON.stringify(error));

        if (statusCodes && code === statusCodes.SIGN_IN_CANCELLED) return 'Google sign-in cancelled.';
        if (statusCodes && code === statusCodes.IN_PROGRESS) return 'Google sign-in already in progress.';
        if (statusCodes && code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services not available on this device.';
        if (code === '10' || (statusCodes && code === 'DEVELOPER_ERROR')) {
            return 'Developer Error: Check your SHA-1 fingerprint in Firebase/Google Console and ensure the package name matches.';
        }
    }

    if (error instanceof Error && error.message) {
        console.error('Native Google Sign-In Error:', error.message);
        return error.message;
    }

    console.error('Native Google Sign-In Unknown Error:', JSON.stringify(error));
    return 'Google sign-in failed. Check logs for details.';
};
