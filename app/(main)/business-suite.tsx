import { Stack } from 'expo-router';
import { BusinessSuiteHubScreen } from '../../src/screens/BusinessSuite/BusinessSuiteHubScreen';

export default function BusinessSuiteRoute() {
    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Business Suite' }} />
            <BusinessSuiteHubScreen />
        </>
    );
}
