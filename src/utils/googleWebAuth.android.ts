import { useCallback } from 'react';

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

export const useWebGoogleAuth = (_input: UseWebGoogleAuthInput): UseWebGoogleAuthResult => {
    const prompt = useCallback(() => {
        return;
    }, []);

    return {
        requestReady: false,
        idToken: null,
        prompt,
    };
};

