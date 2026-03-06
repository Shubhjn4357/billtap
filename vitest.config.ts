import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['__tests__/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
        exclude: ['node_modules', 'android', 'ios', 'dist'],
        setupFiles: ['__tests__/setup.ts'],
        alias: {
            // Expo / React Native modules that don't run in Node must be mocked
            'react-native': path.resolve(__dirname, '__tests__/__mocks__/react-native.ts'),
            'expo-router': path.resolve(__dirname, '__tests__/__mocks__/expo-router.ts'),
            '@react-native-async-storage/async-storage': path.resolve(__dirname, '__tests__/__mocks__/async-storage.ts'),
            '@react-native-community/netinfo': path.resolve(__dirname, '__tests__/__mocks__/netinfo.ts'),
            '@expo/vector-icons': path.resolve(__dirname, '__tests__/__mocks__/vector-icons.ts'),
            'expo-haptics': path.resolve(__dirname, '__tests__/__mocks__/expo-haptics.ts'),
            'expo-sqlite': path.resolve(__dirname, '__tests__/__mocks__/expo-sqlite.ts'),
            '@/components/providers/DialogProvider': path.resolve(__dirname, '__tests__/__mocks__/dialog-provider.ts'),
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
