import { Stack } from 'expo-router';
import { BusinessSuiteBusinessCardStudioScreen } from '../../src/screens/BusinessSuite/BusinessSuiteBusinessCardStudioScreen';

export default function BusinessSuiteBusinessCardStudioRoute() {
    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Business Card Studio' }} />
            <BusinessSuiteBusinessCardStudioScreen />
        </>
    );
}

