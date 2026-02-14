export const API_CONFIG = {
    // Set your deployed API URL here (or via EXPO_PUBLIC_API_BASE_URL).
    baseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, ''),
    enableLivePayments: String(process.env.EXPO_PUBLIC_ENABLE_LIVE_PAYMENTS ?? '').toLowerCase() === 'true',
};

export const AUTH_STORAGE_KEY = 'billtap_access_token';
