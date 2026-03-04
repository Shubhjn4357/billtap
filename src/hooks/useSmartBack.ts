import { useCallback } from 'react';
import { router } from 'expo-router';

type RouteTarget = Parameters<typeof router.push>[0];

export function useSmartBack(fallback?: RouteTarget) {
    return useCallback(() => {
        if (router.canGoBack()) {
            router.back();
            return;
        }

        if (fallback) {
            router.replace(fallback);
        }
    }, [fallback]);
}

