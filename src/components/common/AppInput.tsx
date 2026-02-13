
import React from 'react';
import { TextInput, TextInputProps } from 'react-native-paper';

type AppInputProps = TextInputProps;

export const AppInput: React.FC<AppInputProps> = ({ 
    style, 
    mode = 'outlined',
    ...props 
}) => {
    return (
        <TextInput 
            mode={mode}
            style={[{ marginBottom: 12, backgroundColor: 'transparent' }, style]}
            {...props}
        />
    );
};
