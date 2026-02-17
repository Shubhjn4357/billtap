import { Stack } from 'expo-router';
import { ProfileSetupScreen } from '../../src/screens/Profile/ProfileSetupScreen';

export default function ProfileRoute() {
    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Profile Setup' }} />
            <ProfileSetupScreen />
        </>
    );
}

