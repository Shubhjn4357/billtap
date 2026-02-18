import React from 'react';
import { StyleSheet } from 'react-native';
import { MotionView } from '../motion/Motion';
import { TextInput, TextInputProps, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

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
    inputType?: AppInputType;
};

const inferInputType = (label?: React.ReactNode, placeholder?: string): AppInputType => {
    const joined = `${typeof label === 'string' ? label : ''} ${placeholder ?? ''}`.toLowerCase();

    if (joined.includes('email')) return 'email';
    if (joined.includes('phone') || joined.includes('mobile') || joined.includes('contact')) return 'phone';
    if (joined.includes('upi')) return 'upi';
    if (joined.includes('website') || joined.includes('url')) return 'url';
    if (joined.includes('password') || joined.includes('otp')) return 'password';
    if (joined.includes('date')) return 'date';
    if (joined.includes('amount') || joined.includes('price') || joined.includes('tax') || joined.includes('rate')) return 'decimal';
    if (joined.includes('qty') || joined.includes('quantity') || joined.includes('stock') || joined.includes('count')) return 'number';
    if (joined.includes('name')) return 'name';
    return 'text';
};

const getInputDefaults = (type: AppInputType): Partial<TextInputProps> => {
    switch (type) {
        case 'email':
            return {
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoCorrect: false,
                autoComplete: 'email',
                textContentType: 'emailAddress',
            };
        case 'phone':
            return {
                keyboardType: 'phone-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
                autoComplete: 'tel',
                textContentType: 'telephoneNumber',
            };
        case 'number':
            return {
                keyboardType: 'number-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
                inputMode: 'numeric',
            };
        case 'decimal':
            return {
                keyboardType: 'decimal-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
                inputMode: 'decimal',
            };
        case 'date':
            return {
                keyboardType: 'number-pad',
                autoCapitalize: 'none',
                autoCorrect: false,
                inputMode: 'numeric',
            };
        case 'url':
            return {
                keyboardType: 'url',
                autoCapitalize: 'none',
                autoCorrect: false,
                autoComplete: 'off',
                textContentType: 'URL',
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
                autoComplete: 'off',
            };
        case 'search':
            return {
                keyboardType: 'default',
                autoCapitalize: 'none',
            };
        case 'name':
            return {
                keyboardType: 'default',
                autoCapitalize: 'words',
                autoCorrect: false,
                autoComplete: 'name',
                textContentType: 'name',
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

export const AppInput: React.FC<AppInputProps> = ({
    style,
    mode = 'outlined',
    dense = true,
    outlineStyle,
    contentStyle,
    onFocus,
    onBlur,
    inputType,
    label,
    placeholder,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    autoComplete,
    textContentType,
    inputMode,
    secureTextEntry,
    ...props
}) => {
    const theme = useTheme();
    const [isFocused, setIsFocused] = React.useState(false);
    const resolvedType = inputType ?? inferInputType(label, placeholder);
    const defaults = getInputDefaults(resolvedType);

    const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
        setIsFocused(true);
        onFocus?.(event);
    };

    const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
        setIsFocused(false);
        onBlur?.(event);
    };

    return (
        <MotionView
            animate={{ scale: isFocused ? 1.01 : 1, translateY: isFocused ? -1 : 0 }}
            transition={{ type: 'timing', duration: DesignSystem.motion.fast + 40 }}
        >
            <TextInput
                mode={mode}
                dense={dense}
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.colors.surface,
                    },
                    style,
                ]}
                outlineStyle={[
                    styles.outline,
                    {
                        borderColor: isFocused
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                    },
                    outlineStyle,
                ]}
                contentStyle={[styles.content, contentStyle]}
                activeOutlineColor={theme.colors.primary}
                outlineColor={theme.colors.outline}
                label={label}
                placeholder={placeholder}
                keyboardType={keyboardType ?? defaults.keyboardType}
                autoCapitalize={autoCapitalize ?? defaults.autoCapitalize}
                autoCorrect={autoCorrect ?? defaults.autoCorrect}
                autoComplete={autoComplete ?? defaults.autoComplete}
                textContentType={textContentType ?? defaults.textContentType}
                inputMode={inputMode ?? defaults.inputMode}
                secureTextEntry={secureTextEntry ?? defaults.secureTextEntry}
                onFocus={handleFocus}
                onBlur={handleBlur}
                {...props}
            />
        </MotionView>
    );
};

const styles = StyleSheet.create({
    input: {
        marginBottom: DesignSystem.spacing.sm,
        backgroundColor: 'transparent',
    },
    outline: {
        borderRadius: DesignSystem.radius.sm,
    },
    content: {
        paddingVertical: 1,
    },
});
