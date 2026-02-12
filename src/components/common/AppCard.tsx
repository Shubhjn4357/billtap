import React from 'react';
import { Card } from 'react-native-paper';
import { StyleProp, ViewStyle } from 'react-native';

type AppCardProps = React.ComponentProps<typeof Card> & {
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
};

export const AppCard: React.FC<AppCardProps> = ({
    style,
    children,
    ...props
}) => {
    return (
        <Card
            style={[{ borderRadius: 12, marginBottom: 12 }, style]}
            {...props}
        >
            <Card.Content>
                {children}
            </Card.Content>
        </Card>
    );
};
