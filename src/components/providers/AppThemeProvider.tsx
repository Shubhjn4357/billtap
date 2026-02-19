
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationDefaultTheme,
    ThemeProvider as NavigationThemeProvider,
    type Theme as NavigationTheme,
} from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';
import {
    MD3DarkTheme,
    MD3LightTheme,
    MD3Theme,
    PaperProvider,
    adaptNavigationTheme,
    configureFonts,
} from 'react-native-paper';
import { Colors } from '../../constants/Colors';
import { DesignSystem } from '../../constants/DesignSystem';
import { useSettingsStore } from '../../store';

type AppTheme = MD3Theme & NavigationTheme;

const appFontConfig = {
    bodyLarge: { fontFamily: 'System', fontWeight: '400', lineHeight: 24, letterSpacing: 0.1, fontSize: 16 },
    bodyMedium: { fontFamily: 'System', fontWeight: '400', lineHeight: 20, letterSpacing: 0.1, fontSize: 14 },
    titleLarge: { fontFamily: 'SpaceMono', fontWeight: '700', lineHeight: 28, letterSpacing: 0.1, fontSize: 22 },
    titleMedium: { fontFamily: 'SpaceMono', fontWeight: '700', lineHeight: 24, letterSpacing: 0.1, fontSize: 16 },
    titleSmall: { fontFamily: 'SpaceMono', fontWeight: '700', lineHeight: 20, letterSpacing: 0.1, fontSize: 14 },
    headlineSmall: { fontFamily: 'SpaceMono', fontWeight: '800', lineHeight: 34, letterSpacing: 0, fontSize: 28 },
} as const;

const { LightTheme, DarkTheme } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
});

const CustomLightTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    roundness: DesignSystem.radius.xs / 4,
    colors: {
        ...MD3LightTheme.colors,
        ...LightTheme.colors,
        ...Colors.light,
        elevation: Colors.light.elevation,
    },
    fonts: configureFonts({
        config: appFontConfig,
    }),
} as AppTheme;

const CustomDarkTheme = {
    ...MD3DarkTheme,
    ...DarkTheme,
    roundness: DesignSystem.radius.xs / 4,
    colors: {
        ...MD3DarkTheme.colors,
        ...DarkTheme.colors,
        ...Colors.dark,
        elevation: Colors.dark.elevation,
    },
    fonts: configureFonts({
        config: appFontConfig,
    }),
} as AppTheme;

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const { themeMode, autoTheme } = useSettingsStore();

    const preferredMode = autoTheme || themeMode === 'system' ? 'system' : themeMode;
    const activeMode = preferredMode === 'system'
        ? (systemColorScheme === 'dark' ? 'dark' : 'light')
        : preferredMode;
    const theme = activeMode === 'dark' ? CustomDarkTheme : CustomLightTheme;

    return (
        <PaperProvider theme={theme}>
            <NavigationThemeProvider value={theme}>
                {children}
            </NavigationThemeProvider>
        </PaperProvider>
    );
};
