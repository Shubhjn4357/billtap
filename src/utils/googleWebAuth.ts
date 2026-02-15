// This file handles Google Sign-In for Web environments and Expo Go using `expo-auth-session`.
// It is distinct from `googleNativeSignIn` which uses the native `@react-native-google-signin` library for Android/iOS builds.
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';

WebBrowser.maybeCompleteAuthSession();

export interface UseWebGoogleAuthInput {
    webClientId?: string;
    androidClientId?: string;
    iosClientId?: string;
}

export interface UseWebGoogleAuthResult {
    requestReady: boolean;
    idToken: string | null;
    prompt: () => void;
}

export const useWebGoogleAuth = ({
    webClientId,
    androidClientId,
    iosClientId,
}: UseWebGoogleAuthInput): UseWebGoogleAuthResult => {
    const redirectUri = makeRedirectUri({
        scheme: 'billtap',
        path: 'oauthredirect',
    });

    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId,
        androidClientId,
        iosClientId,
        redirectUri,
    });

    const prompt = useCallback(() => {
        void promptAsync();
    }, [promptAsync]);

    return useMemo(() => {
        const idToken =
            response?.type === 'success' && response.params?.id_token
                ? response.params.id_token
                : null;

        return {
            requestReady: !!request,
            idToken,
            prompt,
        };
    }, [prompt, request, response]);
};

