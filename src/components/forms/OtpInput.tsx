import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

type OtpInputProps = {
    value: string;
    onChange: (next: string) => void;
    length?: number;
    disabled?: boolean;
    label?: string;
};

export const OtpInput: React.FC<OtpInputProps> = ({
    value,
    onChange,
    length = 6,
    disabled = false,
    label = 'Verification Code',
}) => {
    const theme = useTheme();
    const inputRef = React.useRef<TextInput | null>(null);
    const sanitized = React.useMemo(() => value.replace(/\D/g, '').slice(0, length), [length, value]);

    React.useEffect(() => {
        if (sanitized !== value) {
            onChange(sanitized);
        }
    }, [onChange, sanitized, value]);

    return (
        <View>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                {label}
            </Text>
            <Pressable
                onPress={() => inputRef.current?.focus()}
                style={styles.boxRow}
                disabled={disabled}
            >
                {Array.from({ length }).map((_, index) => {
                    const digit = sanitized[index] ?? '';
                    const isActive = index === sanitized.length || (sanitized.length === length && index === length - 1);
                    return (
                        <View
                            key={`otp-slot-${index}`}
                            style={[
                                styles.box,
                                {
                                    borderColor: isActive ? theme.colors.primary : theme.colors.outline,
                                    backgroundColor: theme.colors.surface,
                                },
                            ]}
                        >
                            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                                {digit || ' '}
                            </Text>
                        </View>
                    );
                })}
            </Pressable>
            <TextInput
                ref={inputRef}
                value={sanitized}
                onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, length))}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={length}
                editable={!disabled}
                style={styles.hiddenInput}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    boxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    box: {
        width: 42,
        height: 48,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hiddenInput: {
        position: 'absolute',
        opacity: 0,
        width: 1,
        height: 1,
    },
});
