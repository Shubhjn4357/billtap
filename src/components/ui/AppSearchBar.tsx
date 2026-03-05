import { memo } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, Radius, Spacing, Typography } from '../../constants/theme';
import { AppInput } from './AppInput';
import { useHaptics } from '../../hooks/useHaptics';

type AppSearchBarProps = {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    onScanPress?: () => void;
    scanLabel?: string;
    showScanAction?: boolean;
};

export const AppSearchBar = memo(function AppSearchBar({
    value,
    onChangeText,
    placeholder = 'Search...',
    onScanPress,
    scanLabel = 'Scan',
    showScanAction = false,
}: AppSearchBarProps) {
    const scheme = useColorScheme();
    const colors = getColors(scheme);
    const s = styles(colors);
    const { selection } = useHaptics();

    return (
        <View style={s.row}>
            <AppInput
                inputType="search"
                leadingIcon="magnify"
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                containerStyle={{ flex: 1 }}
            />
            {showScanAction ? (
                <Pressable
                    style={[s.scanBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                    onPress={() => {
                        void selection();
                        onScanPress?.();
                    }}
                >
                    <MaterialCommunityIcons name="barcode-scan" size={18} color={colors.primary} />
                    <Text style={[s.scanText, { color: colors.primary }]}>{scanLabel}</Text>
                </Pressable>
            ) : null}
        </View>
    );
});

const styles = (colors: ReturnType<typeof getColors>) =>
    StyleSheet.create({
        row: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.sm,
        },
        scanBtn: {
            minHeight: 46,
            borderRadius: Radius.md,
            borderWidth: 1,
            paddingHorizontal: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        scanText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
    });

