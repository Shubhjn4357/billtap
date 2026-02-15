
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
} from 'react-native-paper';
import { Colors } from '../../constants/Colors';
import { useSettingsStore } from '../../store';

type AppTheme = MD3Theme & NavigationTheme;

const { LightTheme, DarkTheme } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
});

const CustomLightTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    roundness: 16,
    colors: {
        ...MD3LightTheme.colors,
        ...LightTheme.colors,
        ...Colors.light,
    },
    fonts: MD3LightTheme.fonts,
} as AppTheme;

const CustomDarkTheme = {
    ...MD3DarkTheme,
    ...DarkTheme,
    roundness: 16,
    colors: {
        ...MD3DarkTheme.colors,
        ...DarkTheme.colors,
        ...Colors.dark,
    },
    fonts: MD3DarkTheme.fonts,
} as AppTheme;

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const { themeMode, autoTheme } = useSettingsStore();

    const activeMode = autoTheme ? systemColorScheme : themeMode;
    const theme = activeMode === 'dark' ? CustomDarkTheme : CustomLightTheme;

    return (
        <PaperProvider theme={theme}>
            <NavigationThemeProvider value={theme}>
                {children}
            </NavigationThemeProvider>
        </PaperProvider>
    );
};
