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

export const useWebGoogleAuth = (_: UseWebGoogleAuthInput): UseWebGoogleAuthResult => ({
    requestReady: false,
    idToken: null,
    prompt: NOOP_PROMPT,
});
