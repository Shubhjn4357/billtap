import { API_CONFIG } from '../constants/Api';
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

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    const requestHeaders: Record<string, string> = {
        ...headers,
    };

    if (!skipAuth) {
        const token = await getSessionToken();
        if (token) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }
    }

    const hasBody = body !== undefined;
    if (hasBody && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let response: Response | undefined;
    let attempt = 0;
    const maxRetries = 3;

    try {
        while (attempt < maxRetries) {
            try {
                response = await fetch(resolveUrl(path), {
                    method,
                    headers: requestHeaders,
                    body: hasBody ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });

                // If 5xx error, throw to trigger retry
                if (response.status >= 500) {
                    throw new Error(`Server Error: ${response.status}`);
                }

                // If success or client error (4xx), break loop
                break;
            } catch (err: unknown) {
                attempt++;
                const isAbort = err instanceof Error && err.name === 'AbortError';
                if (isAbort || attempt >= maxRetries) {
                    throw err;
                }
                // Exponential backoff: 500ms, 1000ms, 2000ms
                const delay = 500 * Math.pow(2, attempt - 1);
                console.warn(`Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, err);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiError(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms.`, 0, error);
        }
        throw new ApiError('Network request failed. Check your internet connection.', 0, error);
    } finally {
        clearTimeout(timeout);
    }

    if (!response) {
        throw new ApiError('Network request failed.', 0);
    }

    const text = await response.text();
    const parsed = tryParseJson(text) as { message?: string } | null;

    if (!response.ok) {
        const message = parsed?.message ?? `Request failed (${response.status})`;
        throw new ApiError(message, response.status, parsed ?? text);
    }

    return (parsed as T) ?? ({} as T);
};

export const apiClient = {
    get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'DELETE' }),
};
