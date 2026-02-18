import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';

interface FocusRefreshOptions {
    enabled?: boolean;
    minIntervalMs?: number;
    delayMs?: number;
}

const DEFAULT_MIN_INTERVAL_MS = 5_000;
const MIN_REFRESH_FLOOR_MS = 5_000;

export const useFocusRefresh = (
    refresh: () => void | Promise<void>,
    options: FocusRefreshOptions = {}
) => {
    const {
        enabled = true,
        minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
        delayMs = 0,
    } = options;
    const refreshRef = useRef(refresh);
    const lastRunRef = useRef(0);
    const runningRef = useRef(false);
    const effectiveMinIntervalMs = Math.max(MIN_REFRESH_FLOOR_MS, minIntervalMs);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useFocusEffect(
        useCallback(() => {
            if (!enabled) return;

            const now = Date.now();
            if (now - lastRunRef.current < effectiveMinIntervalMs) {
                return;
            }

            let cancelled = false;
            const run = async () => {
                if (cancelled) return;
                if (runningRef.current) return;

                runningRef.current = true;
                lastRunRef.current = Date.now();
                try {
                    await refreshRef.current();
                } finally {
                    runningRef.current = false;
                }
            };

            if (delayMs > 0) {
                const timer = setTimeout(() => {
                    void run();
                }, delayMs);
                return () => {
                    cancelled = true;
                    clearTimeout(timer);
                };
            }

            void run();

            return () => {
                cancelled = true;
            };
        }, [delayMs, effectiveMinIntervalMs, enabled])
    );
};
