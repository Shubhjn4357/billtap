
import React from 'react';
import { StyleSheet } from 'react-native';
import { TextInput, TextInputProps, useTheme } from 'react-native-paper';

type AppInputProps = TextInputProps;

export const AppInput: React.FC<AppInputProps> = ({
    style,
    mode = 'outlined',
    dense = true,
    outlineStyle,
    contentStyle,
    ...props
}) => {
    const theme = useTheme();

    return (
        <TextInput
            mode={mode}
            dense={dense}
            style={[styles.input, style]}
            outlineStyle={[styles.outline, outlineStyle]}
            contentStyle={[styles.content, contentStyle]}
            activeOutlineColor={theme.colors.primary}
            outlineColor={theme.colors.outline}
            {...props}
        />
    );
};

const styles = StyleSheet.create({
    input: {
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    outline: {
        borderRadius: 14,
    },
    content: {
        paddingVertical: 6,
    },
});
