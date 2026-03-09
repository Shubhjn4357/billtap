import axios, {
    AxiosError,
    isAxiosError,
    type AxiosInstance,
    type AxiosRequestConfig,
    type InternalAxiosRequestConfig,
} from 'axios';
import { Platform } from 'react-native';
import { secureStorage } from '../services/secureStorage';

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

const isAxiosLikeError = (value: unknown): value is AxiosError =>
    isAxiosError(value)
    || Boolean(
        value
        && typeof value === 'object'
        && 'isAxiosError' in value
        && (value as { isAxiosError?: unknown }).isAxiosError === true
    );

const coerceErrorPayload = (payload: unknown): Record<string, unknown> | null => {
    if (typeof payload === 'string') {
        try {
            const parsed = JSON.parse(payload);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return null;
        }
        return null;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
};

const extractServerMessage = (payload: unknown): string | null => {
    const record = coerceErrorPayload(payload);
    if (!record) return null;
    const message = record.message;
    if (typeof message === 'string' && message.trim().length > 0) return message.trim();
    const nestedMessage = (record.error as { message?: unknown } | undefined)?.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) return nestedMessage.trim();
    const dataMessage = (record.data as { message?: unknown } | undefined)?.message;
    if (typeof dataMessage === 'string' && dataMessage.trim().length > 0) return dataMessage.trim();
    return null;
};

const extractServerCode = (payload: unknown): string | null => {
    const record = coerceErrorPayload(payload);
    if (!record) return null;
    const directCode = record.code;
    if (typeof directCode === 'string' && directCode.trim().length > 0) return directCode.trim();
    const nestedCode = (record.error as { code?: unknown } | undefined)?.code;
    if (typeof nestedCode === 'string' && nestedCode.trim().length > 0) return nestedCode.trim();
    const dataCode = (record.data as { code?: unknown } | undefined)?.code;
    if (typeof dataCode === 'string' && dataCode.trim().length > 0) return dataCode.trim();
    return null;
};

const inferCloudBlockedCode = (message: string | null | undefined): string | undefined => {
    const normalized = String(message ?? '').trim().toLowerCase();
    if (!normalized) return undefined;
    if (normalized.includes('read-only') || normalized.includes('grace mode')) {
        return 'SUBSCRIPTION_READ_ONLY';
    }
    if (normalized.includes('plan limit')) {
        return 'PLAN_LIMIT_EXCEEDED';
    }
    if (normalized.includes('not enabled for current subscription')) {
        return 'FEATURE_NOT_ENABLED';
    }
    return undefined;
};

const getKnownErrorDetails = (value: Partial<ApiErrorNormalized> & Record<string, unknown>): unknown =>
    value.details
    ?? value.responseData
    ?? (value.response as { data?: unknown } | undefined)?.data
    ?? (value.error as { details?: unknown; data?: unknown } | undefined)?.details
    ?? (value.error as { details?: unknown; data?: unknown } | undefined)?.data;

const extractBlockedLikeMessage = (error: unknown): string | null => {
    if (!error || typeof error !== 'object') return null;
    const record = error as Record<string, unknown>;
    return (
        extractServerMessage(record.details)
        ?? extractServerMessage(record.responseData)
        ?? extractServerMessage(record.error)
        ?? extractServerMessage(record.response)
        ?? null
    );
};

export const toApiError = (error: unknown): ApiErrorNormalized => {
    if (isAxiosLikeError(error)) {
        const status = error.response?.status ?? 0;
        const details = error.response?.data ?? error.toJSON?.();
        const nestedMessage = extractServerMessage(details);
        const nestedCode = extractServerCode(details);
        const rawAxiosMessage = error.message ?? '';
        const statusFallbackMessage =
            status >= 500
                ? 'Server error. Please try again in a moment.'
                : status > 0
                    ? `Request failed (${status}).`
                    : 'Network request failed.';
        const message =
            nestedMessage
            ?? ((rawAxiosMessage.startsWith('Request failed with status code') ? statusFallbackMessage : rawAxiosMessage) || statusFallbackMessage);
        return {
            status,
            message,
            details,
            code: nestedCode ?? inferCloudBlockedCode(nestedMessage ?? message) ?? error.code,
        };
    }

    if (error && typeof error === 'object') {
        const asKnown = error as Partial<ApiErrorNormalized> & Record<string, unknown>;
        if (typeof asKnown.status === 'number' && typeof asKnown.message === 'string') {
            const details = getKnownErrorDetails(asKnown);
            const nestedMessage = extractServerMessage(details);
            const nestedCode = extractServerCode(details);
            return {
                status: asKnown.status,
                message: nestedMessage ?? asKnown.message,
                details,
                code:
                    nestedCode
                    ?? inferCloudBlockedCode(nestedMessage ?? asKnown.message)
                    ?? (typeof asKnown.code === 'string' ? asKnown.code : undefined),
            };
        }
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

const CLOUD_WRITE_BLOCKED_CODES = new Set([
    'SUBSCRIPTION_READ_ONLY',
    'SUBSCRIPTION_WRITE_BLOCKED',
    'PLAN_LIMIT_EXCEEDED',
    'FEATURE_NOT_ENABLED',
    'MULTI_BUSINESS_NOT_ALLOWED',
    'STAFF_INVITE_NOT_ALLOWED',
    'DEVICE_REGISTRATION_NOT_ALLOWED',
]);

export const isCloudWriteBlockedError = (error: unknown): boolean => {
    const normalized = toApiError(error);
    const code = String(normalized.code ?? '').trim().toUpperCase();
    const nestedMessage = extractBlockedLikeMessage(error);
    const message = String(nestedMessage ?? normalized.message ?? '').trim().toLowerCase();

    if (CLOUD_WRITE_BLOCKED_CODES.has(code)) {
        return true;
    }

    if (normalized.status !== 400 && normalized.status !== 403 && normalized.status !== 409) {
        return false;
    }

    return (
        message.includes('read-only')
        || message.includes('grace mode')
        || message.includes('offline mode only')
        || message.includes('plan limit')
        || message.includes('not enabled for current subscription')
        || message.includes('subscription is required')
    );
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
    _token = await secureStorage.getItemAsync(TOKEN_KEY);
    return _token;
}

export async function storeToken(token: string): Promise<void> {
    _token = token;
    await secureStorage.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
    _token = null;
    await secureStorage.deleteItemAsync(TOKEN_KEY);
}

export async function clearStoredBusinessId(): Promise<void> {
    _businessId = null;
    await secureStorage.deleteItemAsync(BUSINESS_ID_KEY);
}

export async function storeBusinessId(id: string): Promise<void> {
    _businessId = id;
    await secureStorage.setItemAsync(BUSINESS_ID_KEY, id);
}

export async function getStoredBusinessId(): Promise<string | null> {
    if (_businessId) return _businessId;
    _businessId = await secureStorage.getItemAsync(BUSINESS_ID_KEY);
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
        const responseData = isAxiosLikeError(error) ? error.response?.data : undefined;
        const normalizedBase = toApiError(error);
        const blockedMessage = extractServerMessage(responseData) ?? extractBlockedLikeMessage(error);
        const normalized: ApiErrorNormalized & { responseData?: unknown } = {
            ...normalizedBase,
            details: normalizedBase.details ?? responseData,
            ...(responseData !== undefined ? { responseData } : {}),
            ...(blockedMessage ? { message: blockedMessage } : {}),
            code:
                normalizedBase.code
                ?? inferCloudBlockedCode(blockedMessage ?? normalizedBase.message)
                ?? extractServerCode(responseData)
                ?? undefined,
        };
        const config = isAxiosLikeError(error) ? error.config : undefined;
        if (!isCloudWriteBlockedError(normalized)) {
            console.error('[api] request failed', {
                method: config?.method?.toUpperCase?.() ?? config?.method,
                url: config?.url,
                status: normalized.status,
                code: normalized.code,
                message: normalized.message,
                requestData: config?.data,
                responseData: responseData ?? normalized.details,
            });
        }
        if (isAxiosLikeError(error) && error.response?.status === 401) {
            clearToken().catch(() => null);
            clearStoredBusinessId().catch(() => null);
        }
        return Promise.reject(normalized);
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
