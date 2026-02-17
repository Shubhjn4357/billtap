import React from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';
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
        <MotiView
            from={{ opacity: 0.85, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
        >
            <AppCard
                disableMotion
                style={{
                    backgroundColor,
                    borderColor: theme.dark ? 'rgba(103,212,234,0.22)' : 'rgba(14,116,144,0.18)',
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: right ? 12 : 0 }}>
                        <Text variant="titleLarge" style={{ fontWeight: '700', color: textColor }}>
                            {title}
                        </Text>
                        {!!subtitle && (
                            <Text variant="labelMedium" style={{ color: textColor, marginTop: 3, opacity: 0.82 }}>
                                {subtitle}
                            </Text>
                        )}
                    </View>
                    {right}
                </View>
            </AppCard>
        </MotiView>
    );
};
