import AsyncStorage from '@react-native-async-storage/async-storage';

type BackendName = 'async-storage';

export const offlineKeyValueStore = {
    getBackendName(): BackendName {
        return 'async-storage';
    },

    async getItem(key: string): Promise<string | null> {
        return AsyncStorage.getItem(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        await AsyncStorage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
        await AsyncStorage.removeItem(key);
    },

    async multiRemove(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        for (const key of keys) {
            await AsyncStorage.removeItem(key);
        }
    },
};
