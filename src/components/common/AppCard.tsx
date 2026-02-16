import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Card, useTheme } from 'react-native-paper';

type AppCardProps = React.ComponentProps<typeof Card> & {
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
};

export const AppCard: React.FC<AppCardProps> = ({
    style,
    contentStyle,
    children,
    ...props
}) => {
    const theme = useTheme();

    return (
        <Card
            mode="elevated"
            style={[
                styles.card,
                {
                    backgroundColor: theme.dark ? 'rgba(17,26,45,0.82)' : 'rgba(255,255,255,0.78)',
                    borderColor: theme.dark ? 'rgba(148,163,184,0.18)' : 'rgba(2,6,23,0.1)',
                    shadowColor: '#020617',
                },
                style,
            ]}
            {...props}
        >
            <Card.Content style={[styles.content, contentStyle]}>
                {children}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 22,
        borderWidth: 1,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 5,
    },
    content: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
});
