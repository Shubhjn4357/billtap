import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.vahi.app';
const TOKEN_KEY = 'vahi_auth_token';
const BUSINESS_ID_KEY = 'vahi_business_id';

let _token: string | null = null;
let _businessId: string | null = null;

async function getStoredToken(): Promise<string | null> {
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
        if (error.response?.status === 401) {
            clearToken().catch(() => null);
        }
        return Promise.reject(error);
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
