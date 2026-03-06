import { memo } from 'react';
import {
    Pressable,
    StyleSheet,
    type StyleProp,
    Text,
    TextInput,
    type TextInputProps,
    View,
    type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useHaptics } from '../../hooks/useHaptics';

export type AppInputType =
    | 'text'
    | 'name'
    | 'email'
    | 'phone'
    | 'number'
    | 'decimal'
    | 'date'
    | 'url'
    | 'password'
    | 'upi'
    | 'search';

type AppInputProps = TextInputProps & {
    label?: string;
    inputType?: AppInputType;
    error?: string | null;
    leadingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    trailingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    onPressTrailingIcon?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
};

const inferInputType = (label?: string, placeholder?: string): AppInputType => {
    const joined = `${label ?? ''} ${placeholder ?? ''}`.toLowerCase();
    if (joined.includes('email')) return 'email';
    if (joined.includes('phone') || joined.includes('mobile') || joined.includes('contact')) return 'phone';
    if (joined.includes('upi')) return 'upi';
    if (joined.includes('website') || joined.includes('url')) return 'url';
    if (joined.includes('password') || joined.includes('otp')) return 'password';
    if (joined.includes('date')) return 'date';
    if (joined.includes('amount') || joined.includes('price') || joined.includes('tax') || joined.includes('rate')) return 'decimal';
    if (joined.includes('qty') || joined.includes('quantity') || joined.includes('stock') || joined.includes('count')) return 'number';
    if (joined.includes('name')) return 'name';
    if (joined.includes('search')) return 'search';
    return 'text';
};

const getDefaultsForType = (type: AppInputType): Partial<TextInputProps> => {
    switch (type) {
        case 'email':
            return {
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'phone':
            return {
                keyboardType: 'phone-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'number':
            return {
                keyboardType: 'number-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'decimal':
            return {
                keyboardType: 'decimal-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'date':
            return {
                keyboardType: 'number-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'url':
            return {
                keyboardType: 'url',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'password':
            return {
                autoCapitalize: 'none',
                autoCorrect: false,
                secureTextEntry: true,
            };
        case 'upi':
            return {
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoCorrect: false,
            };
        case 'search':
            return {
                keyboardType: 'default',
                autoCapitalize: 'none',
                autoCorrect: false,
                returnKeyType: 'search',
            };
        case 'name':
            return {
                keyboardType: 'default',
                autoCapitalize: 'words',
                autoCorrect: false,
            };
        case 'text':
        default:
            return {
                keyboardType: 'default',
                autoCapitalize: 'sentences',
                autoCorrect: true,
            };
    }
};

export const AppInput = memo(function AppInput({
    label,
    inputType,
    error,
    leadingIcon,
    trailingIcon,
    onPressTrailingIcon,
    containerStyle,
    placeholder,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    style,
    onFocus,
    onBlur,
    ...props
}: AppInputProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const { selection } = useHaptics();
    const resolvedType = inputType ?? inferInputType(typeof label === 'string' ? label : undefined, placeholder);
    const defaults = getDefaultsForType(resolvedType);

    return (
        <View style={containerStyle}>
            {label ? <Text style={[s.label, error && { color: colors.error }]}>{label}</Text> : null}
            <View style={[s.inputWrap, error && { borderColor: colors.error }]}>
                {leadingIcon ? (
                    <MaterialCommunityIcons name={leadingIcon} size={18} color={colors.textSecondary} />
                ) : null}
                <TextInput
                    {...props}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType={keyboardType ?? defaults.keyboardType}
                    autoCapitalize={autoCapitalize ?? defaults.autoCapitalize}
                    autoCorrect={autoCorrect ?? defaults.autoCorrect}
                    style={[s.input, style]}
                    secureTextEntry={props.secureTextEntry ?? defaults.secureTextEntry}
                    onFocus={(event) => {
                        void selection();
                        onFocus?.(event);
                    }}
                    onBlur={onBlur}
                />
                {trailingIcon ? (
                    <Pressable
                        onPress={() => {
                            void selection();
                            onPressTrailingIcon?.();
                        }}
                        hitSlop={10}
                    >
                        <MaterialCommunityIcons name={trailingIcon} size={18} color={colors.textSecondary} />
                    </Pressable>
                ) : null}
            </View>
            {error ? <Text style={s.errorText}>{error}</Text> : null}
        </View>
    );
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        label: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            marginBottom: 6,
        },
        inputWrap: {
            minHeight: 46,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceVariant,
            paddingHorizontal: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        input: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.body.size,
            paddingVertical: Spacing.sm,
        },
        errorText: {
            marginTop: 4,
            color: colors.error,
            fontSize: Typography.caption.size,
        },
    });
