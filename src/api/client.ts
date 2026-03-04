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
        const message =
            extractServerMessage(error.response?.data) ??
            error.message ??
            'Network request failed.';
        return {
            status,
            message,
            details: error.response?.data ?? error.toJSON?.(),
            code: error.code,
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
    return normalized.status === 401 || normalized.status === 403;
};

export const toUserMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
    const normalized = toApiError(error);
    const message = normalized.message?.trim();
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
    _businessId = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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

// Request interceptor: attach JWT + business ID
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await getStoredToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const businessId = await getStoredBusinessId();
    if (businessId) {
        config.headers['X-Organization-Id'] = businessId;
    }
    return config;
});

// Response interceptor: unwrap and handle auth errors
client.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error instanceof AxiosError && (error.response?.status === 401 || error.response?.status === 403)) {
            clearToken().catch(() => null);
        }
        return Promise.reject(toApiError(error));
    }
);

export default client;

// Typed API helpers
export const api = {
    get: <T>(url: string, config?: AxiosRequestConfig) =>
        client.get<T>(url, config).then((r) => r.data),
    post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
        client.post<T>(url, data, config).then((r) => r.data),
    put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
        client.put<T>(url, data, config).then((r) => r.data),
    patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
        client.patch<T>(url, data, config).then((r) => r.data),
    delete: <T>(url: string, config?: AxiosRequestConfig) =>
        client.delete<T>(url, config).then((r) => r.data),
};
