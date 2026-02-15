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
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(2,6,23,0.06)',
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
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 2,
    },
    content: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
});
