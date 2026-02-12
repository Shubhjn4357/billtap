import {
    MD3DarkTheme,
    MD3LightTheme,
    adaptNavigationTheme,
    PaperProvider,
    configureFonts,
} from 'react-native-paper';
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationDefaultTheme,
    ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { Colors } from './Colors';
import { useColorScheme } from 'react-native';
import React from 'react';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
});

const CustomLightTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        ...LightTheme.colors,
        ...Colors.light,
    },
    fonts: {
        ...MD3LightTheme.fonts,
        ...LightTheme.fonts,
    },
};

const CustomDarkTheme = {
    ...MD3DarkTheme,
    ...DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        ...DarkTheme.colors,
        ...Colors.dark,
    },
    fonts: {
        ...MD3DarkTheme.fonts,
        ...DarkTheme.fonts,
    },
};

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const colorScheme = useColorScheme();

    const theme = colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme;

    return (
        <PaperProvider theme={theme}>
            <NavigationThemeProvider value={theme}>
                {children}
            </NavigationThemeProvider>
        </PaperProvider>
    );
};

export const useAppTheme = () => {
    // This is valid but for now we just use the paper hook in components
    // or we can expose specific glass values here
    const colorScheme = useColorScheme();
    return colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme;
}
