// This file serves as the default/fallback implementation for platforms not handled by specific extensions (e.g., .android.ts).
// It defines the interface and throws errors if native sign-in is attempted on unsupported platforms (like Web/iOS without specific config).
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

