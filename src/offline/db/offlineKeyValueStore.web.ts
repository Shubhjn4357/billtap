import 'expo-sqlite/localStorage/install';

type BackendName = 'expo-sqlite-localstorage-web-fallback';

const memoryStorage = new Map<string, string>();

const getLocalStorage = (): Storage | null => {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
        return null;
    }
    return globalThis.localStorage;
};

export const offlineKeyValueStore = {
    getBackendName(): BackendName {
        return 'expo-sqlite-localstorage-web-fallback';
    },

    async getItem(key: string): Promise<string | null> {
        const storage = getLocalStorage();
        if (storage) {
            return storage.getItem(key);
        }
        return memoryStorage.get(key) ?? null;
    },

    async setItem(key: string, value: string): Promise<void> {
        const storage = getLocalStorage();
        if (storage) {
            storage.setItem(key, value);
            return;
        }
        memoryStorage.set(key, value);
    },

    async removeItem(key: string): Promise<void> {
        const storage = getLocalStorage();
        if (storage) {
            storage.removeItem(key);
            return;
        }
        memoryStorage.delete(key);
    },

    async multiRemove(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        const storage = getLocalStorage();
        if (storage) {
            for (const key of keys) {
                storage.removeItem(key);
            }
            return;
        }
        for (const key of keys) {
            memoryStorage.delete(key);
        }
    },
};
