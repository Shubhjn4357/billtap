import React from 'react';
import { StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { TextInput, TextInputProps, useTheme } from 'react-native-paper';

type AppInputProps = TextInputProps;

export const AppInput: React.FC<AppInputProps> = ({
    style,
    mode = 'outlined',
    dense = true,
    outlineStyle,
    contentStyle,
    onFocus,
    onBlur,
    ...props
}) => {
    const theme = useTheme();
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
        setIsFocused(true);
        onFocus?.(event);
    };

    const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
        setIsFocused(false);
        onBlur?.(event);
    };

    return (
        <MotiView
            animate={{ scale: isFocused ? 1.01 : 1, translateY: isFocused ? -1 : 0 }}
            transition={{ type: 'timing', duration: 160 }}
        >
            <TextInput
                mode={mode}
                dense={dense}
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.dark ? 'rgba(15,23,42,0.44)' : 'rgba(255,255,255,0.56)',
                    },
                    style,
                ]}
                outlineStyle={[
                    styles.outline,
                    {
                        borderColor: isFocused
                            ? theme.colors.primary
                            : (theme.dark ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.35)'),
                    },
                    outlineStyle,
                ]}
                contentStyle={[styles.content, contentStyle]}
                activeOutlineColor={theme.colors.primary}
                outlineColor={theme.colors.outline}
                onFocus={handleFocus}
                onBlur={handleBlur}
                {...props}
            />
        </MotiView>
    );
};

const styles = StyleSheet.create({
    input: {
        marginBottom: 10,
        backgroundColor: 'transparent',
    },
    outline: {
        borderRadius: 12,
    },
    content: {
        paddingVertical: 4,
    },
});
