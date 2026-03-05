import axios, {
    AxiosError,
    type AxiosInstance,
    type AxiosRequestConfig,
    type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const normalizeApiBaseUrl = (value: string): string => {
    const trimmed = value.trim().replace(/\/+$/, '');
    return trimmed.toLowerCase().endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
};

const rawApiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    'https://api.vahi.app';

const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl);
const TOKEN_KEY = 'vahi_auth_token';
const BUSINESS_ID_KEY = 'vahi_business_id';

let _token: string | null = null;
let _businessId: string | null = null;

export const getApiBaseUrl = (): string => API_BASE_URL;

export type ApiErrorNormalized = {
    status: number;
    message: string;
    details?: unknown;
    code?: string;
};

const extractServerMessage = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message.trim();
    const nestedMessage = (payload as { error?: { message?: unknown } }).error?.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) return nestedMessage.trim();
    return null;
};

const extractServerCode = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const directCode = (payload as { code?: unknown }).code;
    if (typeof directCode === 'string' && directCode.trim().length > 0) return directCode.trim();
    const nestedCode = (payload as { error?: { code?: unknown } }).error?.code;
    if (typeof nestedCode === 'string' && nestedCode.trim().length > 0) return nestedCode.trim();
    return null;
};

export const toApiError = (error: unknown): ApiErrorNormalized => {
    if (error && typeof error === 'object') {
        const asKnown = error as Partial<ApiErrorNormalized>;
        if (typeof asKnown.status === 'number' && typeof asKnown.message === 'string') {
            return {
                status: asKnown.status,
                message: asKnown.message,
                details: asKnown.details,
                code: typeof asKnown.code === 'string' ? asKnown.code : undefined,
            };
        }
    }

    if (error instanceof AxiosError) {
        const status = error.response?.status ?? 0;
        const rawAxiosMessage = error.message ?? '';
        const statusFallbackMessage =
            status >= 500
                ? 'Server error. Please try again in a moment.'
                : status > 0
                    ? `Request failed (${status}).`
                    : 'Network request failed.';
        const message =
            extractServerMessage(error.response?.data) ??
            ((rawAxiosMessage.startsWith('Request failed with status code') ? statusFallbackMessage : rawAxiosMessage) || statusFallbackMessage);
        return {
            status,
            message,
            details: error.response?.data ?? error.toJSON?.(),
            code: extractServerCode(error.response?.data) ?? error.code,
        };
    }

    if (error instanceof Error) {
        return {
            status: 0,
            message: error.message || 'Unexpected error.',
            details: error.stack,
        };
    }

    return {
        status: 0,
        message: 'Unexpected error.',
    };
};

export const isUnauthorizedError = (error: unknown): boolean => {
    const normalized = toApiError(error);
    return normalized.status === 401;
};

export const toUserMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
    const normalized = toApiError(error);
    const message = normalized.message?.trim();
    if (normalized.status >= 500 && message && /request failed with status code\s*5\d\d/i.test(message)) {
        return 'Server error. Please try again in a moment.';
    }
    return message && message.length > 0 ? message : fallback;
};

export async function getStoredToken(): Promise<string | null> {
    if (_token) return _token;
    _token = await SecureStore.getItemAsync(TOKEN_KEY);
    return _token;
}

export async function storeToken(token: string): Promise<void> {
    _token = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
    _token = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function clearStoredBusinessId(): Promise<void> {
    _businessId = null;
    await SecureStore.deleteItemAsync(BUSINESS_ID_KEY);
}

export async function storeBusinessId(id: string): Promise<void> {
    _businessId = id;
    await SecureStore.setItemAsync(BUSINESS_ID_KEY, id);
}

export async function getStoredBusinessId(): Promise<string | null> {
    if (_businessId) return _businessId;
    _businessId = await SecureStore.getItemAsync(BUSINESS_ID_KEY);
    return _businessId;
}

const client: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30_000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Platform': Platform.OS.toUpperCase(),
        'X-Client-Version': process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
    },
});

type RequestConfigWithFlags = InternalAxiosRequestConfig & {
    skipOrganizationHeader?: boolean;
};

// Request interceptor: attach JWT + business ID
client.interceptors.request.use(async (config: RequestConfigWithFlags) => {
    const token = await getStoredToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.skipOrganizationHeader) {
        const businessId = await getStoredBusinessId();
        if (businessId) {
            config.headers['X-Organization-Id'] = businessId;
        }
    }
    return config;
});

// Response interceptor: unwrap and handle auth errors
client.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error instanceof AxiosError && error.response?.status === 401) {
            clearToken().catch(() => null);
            clearStoredBusinessId().catch(() => null);
        }
        return Promise.reject(toApiError(error));
    }
);

export default client;

export type ApiRequestConfig = AxiosRequestConfig & {
    skipOrganizationHeader?: boolean;
};

// Typed API helpers
export const api = {
    get: <T>(url: string, config?: ApiRequestConfig) =>
        client.get<T>(url, config).then((r) => r.data),
    post: <T>(url: string, data?: unknown, config?: ApiRequestConfig) =>
        client.post<T>(url, data, config).then((r) => r.data),
    put: <T>(url: string, data?: unknown, config?: ApiRequestConfig) =>
        client.put<T>(url, data, config).then((r) => r.data),
    patch: <T>(url: string, data?: unknown, config?: ApiRequestConfig) =>
        client.patch<T>(url, data, config).then((r) => r.data),
    delete: <T>(url: string, config?: ApiRequestConfig) =>
        client.delete<T>(url, config).then((r) => r.data),
};
