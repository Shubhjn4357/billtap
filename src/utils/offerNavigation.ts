import { Linking } from 'react-native';
import { router } from 'expo-router';

const normalizeOfferRoute = (route: string) => {
    const trimmed = route.trim();
    if (!trimmed) return null;
    if (trimmed.includes('://')) return trimmed;
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export const openOfferDestination = async (route: string | null | undefined) => {
    const normalized = route ? normalizeOfferRoute(route) : null;
    if (!normalized) return false;

    if (normalized.startsWith('/')) {
        router.push(normalized as Parameters<typeof router.push>[0]);
        return true;
    }

    const supported = await Linking.canOpenURL(normalized);
    if (!supported) return false;

    await Linking.openURL(normalized);
    return true;
};
