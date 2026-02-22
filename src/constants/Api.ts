export const API_CONFIG = {
    // Set your deployed API URL via EXPO_PUBLIC_API_BASE_URL.
    // In production builds, localhost is auto-replaced to avoid device-side dead endpoints.
    baseUrl: (() => {
        const isDev = process.env.NODE_ENV !== 'production';
        const developmentDefault = 'http://localhost:3000/api';
        const productionDefault = 'https://vahi-api.shubhamjain-com-in.workers.dev/api';
        const configured = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
        const fallback = isDev ? developmentDefault : productionDefault;
        const initial = (configured || fallback).replace(/\/$/, '');
        const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

        if (!isDev && localhostPattern.test(initial)) {
            return productionDefault;
        }

        return initial;
    })(),
    enableLivePayments: String(process.env.EXPO_PUBLIC_ENABLE_LIVE_PAYMENTS ?? '').toLowerCase() === 'true',
};

export const AUTH_STORAGE_KEY = 'billtap_access_token';
