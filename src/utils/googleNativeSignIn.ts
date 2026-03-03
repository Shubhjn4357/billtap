export interface NativeGoogleSignInConfig {
    webClientId?: string;
    androidClientId?: string;
    iosClientId?: string;
}

export interface NativeGoogleSignInResult {
    idToken: string;
}

export const configureNativeGoogleSignIn = async (_config: NativeGoogleSignInConfig): Promise<void> => {
    return;
};

export const signInWithNativeGoogle = async (): Promise<NativeGoogleSignInResult> => {
    throw new Error('Native Google Sign-In is only available on Android/iOS builds.');
};

export const getNativeGoogleErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    return 'Google sign-in failed.';
};
