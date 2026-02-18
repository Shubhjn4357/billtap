import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';
import { AppButton } from './AppButton';

interface AppDateFieldProps {
    label: string;
    value?: Date;
    onChange: (value: Date) => void;
    placeholder?: string;
    maximumDate?: Date;
    minimumDate?: Date;
}

export const AppDateField = ({
    label,
    value,
    onChange,
    placeholder = 'Select date',
    minimumDate,
    maximumDate,
}: AppDateFieldProps) => {
    const theme = useTheme();
    const [showPicker, setShowPicker] = React.useState(false);

    const handleChange = (_event: unknown, selected?: Date) => {
        if (Platform.OS !== 'ios') {
            setShowPicker(false);
        }
        if (selected) {
            onChange(selected);
        }
    };

    return (
        <View style={styles.wrapper}>
            <Text variant="labelMedium" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                {label}
            </Text>
            <AppButton
                mode="outlined"
                icon="calendar"
                onPress={() => setShowPicker((current) => !current)}
                contentStyle={styles.buttonContent}
            >
                {value ? value.toLocaleDateString() : placeholder}
            </AppButton>
            {showPicker && (
                <DateTimePicker
                    value={value ?? new Date()}
                    mode="date"
                    display="default"
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onChange={handleChange}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: DesignSystem.spacing.sm,
    },
    label: {
        marginBottom: DesignSystem.spacing.xs,
    },
    buttonContent: {
        minHeight: 48,
        justifyContent: 'flex-start',
    },
});
