import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            // Expo SQLite module is a native dependency that cannot run in
            // node tests.  Redirect imports to our lightweight stub which
            // provides the minimal API used by `db/client.ts`.
            'expo-sqlite': path.resolve(__dirname, 'src/__mocks__/expo-sqlite.ts'),
        },
    },
    test: {
        environment: 'node',
        globals: true,
        setupFiles: path.resolve(__dirname, 'src/test-setup.ts'),
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
        },
    },

});
