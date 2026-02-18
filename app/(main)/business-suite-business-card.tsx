import { Stack } from 'expo-router';
import { Text } from 'react-native-paper';
import { AppCard } from '../../src/components/common/AppCard';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { BusinessSuiteBusinessCardStudioScreen } from '../../src/screens/BusinessSuite/BusinessSuiteBusinessCardStudioScreen';

export default function BusinessSuiteBusinessCardStudioRoute() {
    const { canManageBusinessCards, canAccessBusinessSuite } = useOrganizationAccess();

    if (!canAccessBusinessSuite || !canManageBusinessCards) {
        return (
            <ScreenWrapper>
                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Business Card Studio is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 6 }}>
                        Ask owner/admin to enable business card access for this store.
                    </Text>
                </AppCard>
            </ScreenWrapper>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Business Card Studio' }} />
            <BusinessSuiteBusinessCardStudioScreen />
        </>
    );
}
