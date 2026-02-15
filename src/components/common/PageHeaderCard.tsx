import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from './AppCard';

type PageHeaderCardProps = {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
};

export const PageHeaderCard: React.FC<PageHeaderCardProps> = ({ title, subtitle, right }) => {
    const theme = useTheme();

    return (
        <AppCard style={{ backgroundColor: theme.colors.primaryContainer }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: right ? 12 : 0 }}>
                    <Text variant="headlineSmall" style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
                        {title}
                    </Text>
                    {!!subtitle && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, marginTop: 4 }}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                {right}
            </View>
        </AppCard>
    );
};
