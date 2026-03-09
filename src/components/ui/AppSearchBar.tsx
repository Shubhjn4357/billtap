import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
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
    const colors = useAppColors();
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
                    style={[s.scanBtn, { backgroundColor: colors.card, borderColor: withAlpha(colors.primary, '18') }]}
                    onPress={() => {
                        void selection();
                        onScanPress?.();
                    }}
                >
                    <View style={[s.scanIconWrap, { backgroundColor: withAlpha(colors.primary, '12') }]}>
                        <MaterialCommunityIcons name="barcode-scan" size={18} color={colors.primary} />
                    </View>
                    <Text style={[s.scanText, { color: colors.primary }]}>{scanLabel}</Text>
                </Pressable>
            ) : null}
        </View>
    );
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        row: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.sm,
        },
        scanBtn: {
            minHeight: 48,
            borderRadius: Radius.md,
            borderWidth: 1,
            paddingHorizontal: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            shadowColor: colors.primary,
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 1,
            paddingRight: Spacing.md,
        },
        scanIconWrap: {
            width: 28,
            height: 28,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        scanText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
    });
