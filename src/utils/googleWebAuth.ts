import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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

const NOOP_PROMPT = () => {};

const resolveClientId = (input: UseWebGoogleAuthInput): string | undefined =>
    Platform.select({
        web: input.webClientId ?? undefined,
        ios: input.iosClientId || input.webClientId || undefined,
        android: input.androidClientId || input.webClientId || undefined,
        default: input.webClientId ?? undefined,
    });

export const useWebGoogleAuth = ({
    webClientId,
    androidClientId,
    iosClientId,
}: UseWebGoogleAuthInput): UseWebGoogleAuthResult => {
    const redirectUri = makeRedirectUri({
        scheme: 'vahi',
        path: 'oauthredirect',
    });

    const clientId = resolveClientId({
        webClientId,
        androidClientId,
        iosClientId,
    });
    const hasClientId = Boolean(clientId);

    const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: clientId ?? 'missing-google-client-id',
        webClientId,
        androidClientId,
        iosClientId,
        redirectUri,
    });

    const idToken =
        response?.type === 'success' && response.params?.id_token
            ? response.params.id_token
            : null;

    return {
        requestReady: hasClientId && !!request,
        idToken,
        prompt: hasClientId
            ? () => {
            void promptAsync();
            }
            : NOOP_PROMPT,
    };
};
