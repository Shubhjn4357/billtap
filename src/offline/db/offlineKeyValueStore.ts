import AsyncStorage from '@react-native-async-storage/async-storage';

type BackendName = 'sqlite-drizzle' | 'async-storage';

export const offlineKeyValueStore = {
    getBackendName(): BackendName {
        return 'async-storage';
    },

    async getItem(key: string): Promise<string | null> {
        return await AsyncStorage.getItem(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        await AsyncStorage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
        await AsyncStorage.removeItem(key);
    },

    async multiRemove(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await AsyncStorage.multiRemove(keys);
    },
};
