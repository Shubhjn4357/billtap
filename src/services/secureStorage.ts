import * as SecureStore from 'expo-secure-store';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';

const FALLBACK_PREFIX = 'secure_store_fallback:';
const canUseSecureStore = typeof SecureStore.getItemAsync === 'function'
    && typeof SecureStore.setItemAsync === 'function'
    && typeof SecureStore.deleteItemAsync === 'function';

const toFallbackKey = (key: string) => `${FALLBACK_PREFIX}${key}`;

export const secureStorage = {
    async getItemAsync(key: string): Promise<string | null> {
        if (canUseSecureStore) {
            try {
                return await SecureStore.getItemAsync(key);
            } catch {
                // Fall back to app storage when SecureStore is unavailable, notably on web.
            }
        }
        return offlineKeyValueStore.getItem(toFallbackKey(key));
    },

    async setItemAsync(key: string, value: string): Promise<void> {
        if (canUseSecureStore) {
            try {
                await SecureStore.setItemAsync(key, value);
                return;
            } catch {
                // Fall back to app storage when SecureStore is unavailable, notably on web.
            }
        }
        await offlineKeyValueStore.setItem(toFallbackKey(key), value);
    },

    async deleteItemAsync(key: string): Promise<void> {
        if (canUseSecureStore) {
            try {
                await SecureStore.deleteItemAsync(key);
                return;
            } catch {
                // Fall back to app storage when SecureStore is unavailable, notably on web.
            }
        }
        await offlineKeyValueStore.removeItem(toFallbackKey(key));
    },
};
