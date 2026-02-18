import React from 'react';
import { Text } from 'react-native-paper';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { AppCard } from '../../src/components/common/AppCard';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { OperationsControlsScreen } from '../../src/screens/Operations/OperationsControlsScreen';

export default function OperationsRoute() {
    const { canAccessOperations } = useOrganizationAccess();

    if (!canAccessOperations) {
        return (
            <ScreenWrapper>
                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Operations Controls is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 6 }}>
                        Enable Operations in module visibility to access this section.
                    </Text>
                </AppCard>
            </ScreenWrapper>
        );
    }

    return <OperationsControlsScreen />;
}
