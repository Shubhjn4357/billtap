export interface NativeGoogleSignInConfig {
    webClientId?: string;
    androidClientId?: string;
}

export interface NativeGoogleSignInResult {
    idToken: string;
}

export const configureNativeGoogleSignIn = async (_config: NativeGoogleSignInConfig): Promise<void> => {
    return;
};

export const signInWithNativeGoogle = async (): Promise<NativeGoogleSignInResult> => {
    throw new Error('Native Google Sign-In is only available on Android in this build.');
};

export const getNativeGoogleErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    return 'Google sign-in failed.';
};

