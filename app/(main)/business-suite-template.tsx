import { Stack } from 'expo-router';
import { BusinessSuiteTemplateStudioScreen } from '../../src/screens/BusinessSuite/BusinessSuiteTemplateStudioScreen';

export default function BusinessSuiteTemplateStudioRoute() {
    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Template Studio' }} />
            <BusinessSuiteTemplateStudioScreen />
        </>
    );
}

