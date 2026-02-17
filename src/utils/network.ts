import NetInfo from '@react-native-community/netinfo';
import { useNetworkStore } from '../store';

type ConnectivitySnapshot = {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
};

const NETWORK_PROBE_TTL_MS = 4000;
const NETWORK_FETCH_TIMEOUT_MS = 2200;

let lastProbeAt = 0;
let lastProbeOnline: boolean | null = null;

const deriveOnlineState = ({ isConnected, isInternetReachable }: ConnectivitySnapshot): boolean | null => {
    if (isConnected === false || isInternetReachable === false) return false;
    if (isConnected === true) return true;
    return null;
};

const updateProbeCache = (online: boolean) => {
    lastProbeAt = Date.now();
    lastProbeOnline = online;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
    const timeoutPromise = new Promise<null>((resolve) => {
        const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve(null);
        }, ms);
    });
    return await Promise.race([promise, timeoutPromise]);
};

export const isOnline = async (forceRefresh = false): Promise<boolean> => {
    const snapshot: ConnectivitySnapshot = useNetworkStore.getState();
    const derived = deriveOnlineState(snapshot);

    if (derived !== null) {
        updateProbeCache(derived);
        return derived;
    }

    if (!forceRefresh && lastProbeOnline !== null && Date.now() - lastProbeAt < NETWORK_PROBE_TTL_MS) {
        return lastProbeOnline;
    }

    try {
        const state = await withTimeout(NetInfo.fetch(), NETWORK_FETCH_TIMEOUT_MS);
        if (!state) {
            if (lastProbeOnline !== null) return lastProbeOnline;
            // Fail open: let API calls attempt and report actual transport status.
            return true;
        }
        const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
        updateProbeCache(online);
        return online;
    } catch {
        if (lastProbeOnline !== null) {
            return lastProbeOnline;
        }
        return false;
    }
};
