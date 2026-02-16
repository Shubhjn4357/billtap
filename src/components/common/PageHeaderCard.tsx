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
    const backgroundColor = theme.dark ? 'rgba(10,76,96,0.28)' : 'rgba(207,243,250,0.68)';
    const textColor = theme.dark ? theme.colors.onSurface : theme.colors.onPrimaryContainer;

    return (
        <AppCard
            style={{
                backgroundColor,
                borderColor: theme.dark ? 'rgba(103,212,234,0.22)' : 'rgba(14,116,144,0.18)',
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: right ? 12 : 0 }}>
                    <Text variant="headlineSmall" style={{ fontWeight: '800', color: textColor }}>
                        {title}
                    </Text>
                    {!!subtitle && (
                        <Text variant="bodySmall" style={{ color: textColor, marginTop: 4, opacity: 0.86 }}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                {right}
            </View>
        </AppCard>
    );
};
