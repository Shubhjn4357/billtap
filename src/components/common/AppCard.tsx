import React from 'react';
import { Card } from 'react-native-paper';
import { StyleProp, ViewStyle } from 'react-native';

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
    return (
        <Card
            style={[{ borderRadius: 16, marginBottom: 12 }, style]}
            {...props}
        >
            <Card.Content style={[{ paddingVertical: 14, paddingHorizontal: 14 }, contentStyle]}>
                {children}
            </Card.Content>
        </Card>
    );
};
