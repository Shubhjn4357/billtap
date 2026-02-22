import { vi } from 'vitest';

// Provide basic window/document stubs for libraries that expect them
if (typeof global.window === 'undefined') {
    (global as any).window = {};
}
if (typeof global.document === 'undefined') {
    (global as any).document = {
        createElement: () => ({}),
    };
}
if (typeof global.navigator === 'undefined') {
    (global as any).navigator = {
        userAgent: 'node',
    };
}

// Global mocks for native modules that cannot run in the node test environment.
// These are executed before each test file loads.

vi.mock('expo-sqlite', () => {
    return {
        openDatabaseSync: (_name: string) => {
            return {
                transaction: (fn: Function) => {
                    try {
                        fn({ executeSql: () => { } });
                    } catch { }
                },
                exec: () => { },
                prepareStatement: () => ({ execute: () => { } }),
            } as any;
        },
        SQLTransactionCallback: Function,
        SQLResultSetCallback: Function,
    };
});

vi.mock('@react-native-async-storage/async-storage', () => {
    const storage: Record<string, string> = {};
    return {
        default: {
            getItem: vi.fn(async (key: string) => storage[key] || null),
            setItem: vi.fn(async (key: string, value: string) => {
                storage[key] = value;
            }),
            removeItem: vi.fn(async (key: string) => {
                delete storage[key];
            }),
            multiRemove: vi.fn(async (keys: string[]) => {
                keys.forEach(key => delete storage[key]);
            }),
            clear: vi.fn(async () => {
                Object.keys(storage).forEach(key => delete storage[key]);
            }),
        },
    };
});
