import NetInfo from '@react-native-community/netinfo';

const PROBE_TTL_MS = 4_000;
const PROBE_TIMEOUT_MS = 2_200;

let lastProbeAt = 0;
let lastProbeOnline: boolean | null = null;

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
    const timeoutPromise = new Promise<null>((resolve) => {
        const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve(null);
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]);
};

const updateProbe = (online: boolean) => {
    lastProbeAt = Date.now();
    lastProbeOnline = online;
};

export const isOnline = async (forceRefresh = false): Promise<boolean> => {
    if (!forceRefresh && lastProbeOnline !== null && Date.now() - lastProbeAt < PROBE_TTL_MS) {
        return lastProbeOnline;
    }

    try {
        const state = await withTimeout(NetInfo.fetch(), PROBE_TIMEOUT_MS);
        if (!state) {
            return lastProbeOnline ?? true;
        }
        const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
        updateProbe(online);
        return online;
    } catch {
        return lastProbeOnline ?? false;
    }
};

