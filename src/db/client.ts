import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

export const DATABASENAME = 'vahi.db';

// Safely initialize DB only on native platforms
const getDb = () => {
    if (Platform.OS === 'web') {
        // Return a mock or handle web DB if needed in the future
        // For now, we simply avoid native sqlite calls that break web builds
        return drizzle({} as any, { schema });
    }
    const expoDb = openDatabaseSync(DATABASENAME);
    return drizzle(expoDb, { schema });
};

export const db = getDb();
