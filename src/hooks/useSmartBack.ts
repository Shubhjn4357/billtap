import { useCallback } from 'react';
import { router } from 'expo-router';

export type RouteTarget = Parameters<typeof router.push>[0];
type BackTarget = RouteTarget | string;

export function navigateBackOrReplace(fallback?: BackTarget) {
    if (router.canGoBack()) {
        router.back();
        return;
    }

    if (fallback) {
        router.replace(fallback as RouteTarget);
    }
}

export function resolveSingleParam<T extends string>(value?: T | T[]) {
    return Array.isArray(value) ? value[0] : value;
}

export function useSmartBack(fallback?: BackTarget) {
    return useCallback(() => {
        navigateBackOrReplace(fallback);
    }, [fallback]);
}
