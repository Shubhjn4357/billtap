export interface NativeGoogleSignInConfig {
    webClientId?: string;
    androidClientId?: string;
}

export interface NativeGoogleSignInResult {
    idToken: string;
}

let lastConfiguredKey = '';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

const loadGoogleSigninModule = (): GoogleSigninModule => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    } catch {
        throw new Error(
            'Native Google Sign-In module is unavailable. Rebuild Android app after adding the Google Sign-In plugin.'
        );
    }
};

const getGoogleSignin = (): GoogleSigninModule['GoogleSignin'] => {
    return loadGoogleSigninModule().GoogleSignin;
};

export const configureNativeGoogleSignIn = async (config: NativeGoogleSignInConfig): Promise<void> => {
    if (!config.webClientId) {
        throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required for Android native Google sign-in.');
    }

    const nextKey = `${config.webClientId}|${config.androidClientId ?? ''}`;
    if (lastConfiguredKey === nextKey) return;

    getGoogleSignin().configure({
        webClientId: config.webClientId,
        offlineAccess: false,
        scopes: ['profile', 'email'],
    });

    lastConfiguredKey = nextKey;
};

export const signInWithNativeGoogle = async (): Promise<NativeGoogleSignInResult> => {
    const GoogleSignin = getGoogleSignin();
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
    let statusCodes: GoogleSigninModule['statusCodes'] | null = null;
    try {
        statusCodes = loadGoogleSigninModule().statusCodes;
    } catch {
        statusCodes = null;
    }

    if (error && typeof error === 'object' && 'code' in error) {
        const code = String((error as { code?: unknown }).code ?? '');
        if (statusCodes && code === statusCodes.SIGN_IN_CANCELLED) return 'Google sign-in cancelled.';
        if (statusCodes && code === statusCodes.IN_PROGRESS) return 'Google sign-in already in progress.';
        if (statusCodes && code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services not available on this device.';
    }

    if (error instanceof Error && error.message) return error.message;
    return 'Google sign-in failed.';
};
