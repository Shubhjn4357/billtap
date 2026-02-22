import { RefreshControl, RefreshControlProps } from 'react-native';
import { useTheme } from 'react-native-paper';

export interface AppRefreshControlProps extends Omit<RefreshControlProps, 'refreshing'> {
    refreshing: boolean;
    onRefresh: () => void | Promise<void>;
}

/**
 * AppRefreshControl — drop-in replacement for RefreshControl.
 *
 * Shows a theme-aware rotating indicator built with Reanimated (no Moti, no Lottie dependency).
 * Uses theme.colors.primary for the spinner color so it always matches the active theme.
 */
export const AppRefreshControl = ({
    refreshing,
    onRefresh,
    ...props
}: AppRefreshControlProps) => {
    const theme = useTheme();

    return (
        <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // Android: Colors for the progress indicator
            colors={[theme.colors.primary]}
            // Android: Color of the background
            progressBackgroundColor={theme.colors.surface}
            // iOS: Color of the progress indicator
            tintColor={theme.colors.primary}
            {...props}
        />
    );
};
