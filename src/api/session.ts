import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_STORAGE_KEY } from '../constants/Api';

let cachedToken: string | null | undefined;

export const getSessionToken = async (): Promise<string | null> => {
    if (cachedToken !== undefined) {
        return cachedToken;
    }

    const token = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    cachedToken = token;
    return token;
};

export const setSessionToken = async (token: string): Promise<void> => {
    cachedToken = token;
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, token);
};

export const clearSessionToken = async (): Promise<void> => {
    cachedToken = null;
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
};
