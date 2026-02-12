
import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { useAuth } from '../../hooks/useAuth';

export const DashboardScreen = () => {
    const { user } = useAuth();
    const theme = useTheme();

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 80, paddingTop: 20 }}>
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 5 }}>
                    Hello, {user?.displayName || 'Merchant'}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 20 }}>
                    Overview
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppCard style={{ flex: 1, marginRight: 8, backgroundColor: theme.colors.primaryContainer }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>Today's Sales</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>₹ 0.00</Text>
                    </AppCard>
                    <AppCard style={{ flex: 1, marginLeft: 8, backgroundColor: theme.colors.secondaryContainer }}>
                         <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>Total Orders</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onSecondaryContainer }}>0</Text>
                    </AppCard>
                </View>

                {/* More dashboard widgets can go here */}
            </ScrollView>
        </ScreenWrapper>
    );
};
