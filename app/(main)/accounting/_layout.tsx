import React from 'react';
import { Stack } from 'expo-router';
import { Text } from 'react-native-paper';
import { AppCard } from '../../../src/components/common/AppCard';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { useOrganizationAccess } from '../../../src/hooks/useOrganizationAccess';

export default function AccountingLayout() {
    const { canAccessAccounting } = useOrganizationAccess();

    if (!canAccessAccounting) {
        return (
            <ScreenWrapper>
                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Accounting Suite is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 6 }}>
                        Enable Accounting in module visibility to access this section.
                    </Text>
                </AppCard>
            </ScreenWrapper>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }} />
    );
}

