import NetInfo from '@react-native-community/netinfo';
import { useNetworkStore } from '../store';

export const isOnline = async (): Promise<boolean> => {
    const { isConnected, isInternetReachable } = useNetworkStore.getState();

    if (isConnected === false) {
        return false;
    }

    if (isInternetReachable === false) {
        return false;
    }

    if (isConnected === true) {
        return true;
    }

    try {
        const state = await NetInfo.fetch();
        return Boolean(state.isConnected) && state.isInternetReachable !== false;
    } catch {
        return false;
    }
};
