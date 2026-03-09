import Storage from 'expo-sqlite/kv-store';

type BackendName = 'expo-sqlite-kv-store';

export const offlineKeyValueStore = {
    getBackendName(): BackendName {
        return 'expo-sqlite-kv-store';
    },

    async getItem(key: string): Promise<string | null> {
        return Storage.getItem(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        await Storage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
        await Storage.removeItem(key);
    },

    async multiRemove(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await Promise.all(keys.map((key) => Storage.removeItem(key)));
    },
};
