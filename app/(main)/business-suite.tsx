import { Stack } from 'expo-router';
import { BusinessSuiteScreen } from '../../src/screens/BusinessSuite/BusinessSuiteScreen';

export default function BusinessSuiteRoute() {
    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Business Suite' }} />
            <BusinessSuiteScreen />
        </>
    );
}
