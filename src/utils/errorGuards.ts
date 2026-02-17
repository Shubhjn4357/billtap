import { ApiError } from '../api/httpClient';

const NETWORK_TOKENS = [
    'network request failed',
    'check your internet connection',
    'failed to fetch',
    'network error',
    'request timed out',
    'aborterror',
    'internet connection',
    'cors',
];

export const isNetworkLikeMessage = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return NETWORK_TOKENS.some((token) => normalized.includes(token));
};

export const isNetworkLikeError = (error: unknown): boolean => {
    if (error instanceof ApiError && error.status === 0) {
        return true;
    }
    if (error instanceof Error) {
        return isNetworkLikeMessage(error.message);
    }
    return false;
};

export const shouldThrowClientApiError = (error: unknown): error is ApiError => {
    return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408;
};

