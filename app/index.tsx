import { Redirect } from 'expo-router';
import { useUserStore } from '../store';

export default function Index() {
    const { isAuthenticated } = useUserStore();

    // If authenticated, _layout handles the logic to go to home or setup
    // If not, it sends to login.
    // This index is just a fallback entry

    return <Redirect href={isAuthenticated ? "/(tabs)/home" : "/login"} />;
}
