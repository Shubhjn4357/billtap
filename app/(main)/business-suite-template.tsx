import { Stack } from 'expo-router';
import { Text } from 'react-native-paper';
import { AppCard } from '../../src/components/common/AppCard';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { BusinessSuiteTemplateStudioScreen } from '../../src/screens/BusinessSuite/BusinessSuiteTemplateStudioScreen';

export default function BusinessSuiteTemplateStudioRoute() {
    const { canManageTemplates, canAccessBusinessSuite } = useOrganizationAccess();

    if (!canAccessBusinessSuite || !canManageTemplates) {
        return (
            <ScreenWrapper>
                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Template Studio is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 6 }}>
                        Ask owner/admin to enable template access for this store.
                    </Text>
                </AppCard>
            </ScreenWrapper>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Template Studio' }} />
            <BusinessSuiteTemplateStudioScreen />
        </>
    );
}
