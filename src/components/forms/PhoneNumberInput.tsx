import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CountryCodePicker } from './CountryCodePicker';
import { AppInput } from '../common/AppInput';
import { DesignSystem } from '../../constants/DesignSystem';

type PhoneNumberInputProps = {
    dialCode: string;
    onDialCodeChange: (dialCode: string) => void;
    phoneNumber: string;
    onPhoneNumberChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
};

export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
    dialCode,
    onDialCodeChange,
    phoneNumber,
    onPhoneNumberChange,
    label = 'Phone Number',
    placeholder = '9876543210',
    disabled = false,
    style,
}) => {
    return (
        <View style={[styles.row, style]}>
            <CountryCodePicker
                value={dialCode}
                onChange={onDialCodeChange}
                disabled={disabled}
            />
            <View style={styles.inputWrap}>
                <AppInput
                    label={label}
                    value={phoneNumber}
                    onChangeText={onPhoneNumberChange}
                    inputType="phone"
                    placeholder={placeholder}
                    editable={!disabled}
                    style={styles.phoneInput}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.xs,
        alignItems: 'flex-start',
        marginBottom: DesignSystem.spacing.sm,
    },
    inputWrap: {
        flex: 1,
        minWidth: 0,
    },
    phoneInput: {
        marginBottom: 0,
    },
});
