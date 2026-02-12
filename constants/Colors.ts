import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const Colors = {
    light: {
        ...MD3LightTheme.colors,
        primary: '#6750A4',
        secondary: '#625B71',
        tertiary: '#7D5260',
        background: '#FDF8FD',
        surface: '#FDF8FD',
        glass: 'rgba(255, 255, 255, 0.65)',
        glassBorder: 'rgba(255, 255, 255, 0.8)',
        text: '#1C1B1F',
        success: '#2E7D32',
        error: '#B3261E',
        warning: '#ED6C02',
    },
    dark: {
        ...MD3DarkTheme.colors,
        primary: '#D0BCFF',
        secondary: '#CCC2DC',
        tertiary: '#EFB8C8',
        background: '#141218', // Deep OLED black
        surface: '#141218',
        glass: 'rgba(30, 30, 30, 0.65)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        text: '#E6E1E5',
        success: '#81C784',
        error: '#F2B8B5',
        warning: '#FFB74D',
    },
};

export const Layout = {
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
    },
    glassIntensity: 50,
};

export const Strings = {
    // Can be moved to i18n later
    appName: 'BillTap',
    welcome: 'Welcome back,',
    lowStock: 'Low Stock Alert',
    currency: '₹',
};
