import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/httpClient';

const shouldRetryQuery = (failureCount: number, error: unknown) => {
    if (error instanceof ApiError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
            return false;
        }
    }
    return failureCount < 2;
};

const queryRetryDelay = (attempt: number) => {
    const exponential = 350 * Math.pow(2, Math.max(0, attempt - 1));
    return Math.min(2500, exponential);
};

export const appQueryClient = new QueryClient({
    defaultOptions: {
        queries: {
            networkMode: 'offlineFirst',
            staleTime: 30_000,
            gcTime: 10 * 60 * 1000,
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
        },
        mutations: {
            networkMode: 'offlineFirst',
            retry: 0,
        },
    },
});
