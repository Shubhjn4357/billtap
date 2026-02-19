import axios, { AxiosError, isAxiosError, type AxiosResponse } from 'axios';
import { API_CONFIG } from '../constants/Api';
import { useOrganizationStore } from '../store';
import { isOnline } from '../utils/network';
import { getSessionToken } from './session';

export class ApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

const resolveUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_CONFIG.baseUrl}${normalizedPath}`;
};

const tryParseJson = (value: string) => {
    if (!value) return null;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
};

const DEFAULT_TIMEOUT_MS = (() => {
    const raw = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000);
    if (!Number.isFinite(raw) || raw <= 0) return 15000;
    return Math.floor(raw);
})();

const RETRY_BASE_DELAY_MS = (() => {
    const raw = Number(process.env.EXPO_PUBLIC_API_RETRY_BASE_MS ?? 350);
    if (!Number.isFinite(raw) || raw <= 0) return 350;
    return Math.floor(raw);
})();

const RETRY_MAX_DELAY_MS = (() => {
    const raw = Number(process.env.EXPO_PUBLIC_API_RETRY_MAX_MS ?? 2400);
    if (!Number.isFinite(raw) || raw <= 0) return 2400;
    return Math.floor(raw);
})();

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
    params?: unknown;
}

const asServerMessage = (response: AxiosResponse<unknown>): string => {
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
            return message;
        }
    }
    return `Request failed (${response.status})`;
};

const isRetryableStatus = (status: number): boolean => status >= 500;

const isRetryableNetworkError = (error: AxiosError): boolean => {
    if (error.code === 'ECONNABORTED') return true;
    if (error.response) return false;
    return true;
};

const isRetryableError = (error: unknown): boolean => {
    if (!(error instanceof ApiError)) return false;
    if (error.status === 0) return true;
    return isRetryableStatus(error.status);
};

const createApiErrorFromAxios = (error: AxiosError): ApiError => {
    if (error.code === 'ECONNABORTED') {
        return new ApiError(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms.`, 0, error);
    }

    if (error.response) {
        return new ApiError(
            asServerMessage(error.response),
            error.response.status,
            error.response.data
        );
    }

    return new ApiError('Network request failed. Check your internet connection.', 0, error);
};

const getRetryDelayMs = (attemptNumber: number): number => {
    const exponential = RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attemptNumber - 1));
    const jitter = Math.floor(Math.random() * 120);
    return Math.min(RETRY_MAX_DELAY_MS, exponential + jitter);
};

const wait = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

// ... (existing code)

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const { method = 'GET', body, headers = {}, skipAuth = false, params } = options;
    const retryableMethod = method === 'GET';

    const requestHeaders: Record<string, string> = {
        ...headers,
    };

    if (!skipAuth) {
        const token = await getSessionToken();
        if (token) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }
        const organizationId = useOrganizationStore.getState().selectedOrganizationId;
        if (organizationId) {
            requestHeaders['X-Organization-Id'] = organizationId;
        }
    }

    const hasBody = body !== undefined;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (hasBody && !isFormData && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    let attempt = 0;
    const maxRetries = retryableMethod ? 2 : 1;

    const online = await isOnline();
    // For GET requests, attempt anyway to avoid false negatives from flaky reachability probes.
    if (!online && !retryableMethod) {
        throw new ApiError('Network request failed. Check your internet connection.', 0);
    }

    while (attempt < maxRetries) {
        try {
            const response = await axios.request<unknown>({
                method,
                url: resolveUrl(path),
                timeout: DEFAULT_TIMEOUT_MS,
                headers: requestHeaders,
                data: hasBody ? body : undefined,
                params,
                validateStatus: () => true,
            });

            if (response.status >= 400) {
                throw new ApiError(asServerMessage(response), response.status, response.data);
            }

            const payload = response.data;
            if (payload === undefined || payload === null) {
                return {} as T;
            }

            if (typeof payload === 'string') {
                const parsed = tryParseJson(payload);
                return (parsed ?? payload) as T;
            }

            return payload as T;
        } catch (error: unknown) {
            let normalizedError: ApiError;

            if (error instanceof ApiError) {
                normalizedError = error;
            } else if (isAxiosError(error)) {
                normalizedError = createApiErrorFromAxios(error);
                if (!isRetryableNetworkError(error) && normalizedError.status >= 400 && normalizedError.status < 500) {
                    throw normalizedError;
                }
            } else {
                normalizedError = new ApiError('Network request failed. Check your internet connection.', 0, error);
            }

            attempt += 1;
            const shouldRetry = retryableMethod && attempt < maxRetries && isRetryableError(normalizedError);
            if (!shouldRetry) {
                throw normalizedError;
            }

            await wait(getRetryDelayMs(attempt));
        }
    }

    throw new ApiError('Network request failed. Check your internet connection.', 0);
};

export const apiClient = {
    get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'DELETE' }),
};
