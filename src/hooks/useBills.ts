import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { billService, type StoredBill } from '../api/billService';
import { calculateBillStats } from '../utils/billStats';
import { useAuth } from './useAuth';

const BILL_CACHE_TTL_MS = 30_000;

export const useBills = (enabled = true) => {
    const { user } = useAuth();
    const [bills, setBills] = useState<StoredBill[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastFetchAtRef = useRef(0);
    const inFlightRef = useRef<Promise<void> | null>(null);

    const fetchBills = useCallback(async (force = false) => {
        if (!user) {
            setBills([]);
            setError(null);
            lastFetchAtRef.current = 0;
            return;
        }
        if (!enabled) {
            setBills([]);
            setError(null);
            return;
        }

        const withinCacheWindow = Date.now() - lastFetchAtRef.current < BILL_CACHE_TTL_MS;
        if (!force && bills.length > 0 && withinCacheWindow) {
            return;
        }

        if (inFlightRef.current) {
            await inFlightRef.current;
            return;
        }

        const request = (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await billService.getUserBills(user.uid, 1000);
                setBills(data);
                lastFetchAtRef.current = Date.now();
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load bills.');
            } finally {
                setLoading(false);
                inFlightRef.current = null;
            }
        })();

        inFlightRef.current = request;
        await request;
    }, [bills.length, enabled, user]);

    useEffect(() => {
        if (!enabled) {
            setBills([]);
            setError(null);
            return;
        }
        void fetchBills();
    }, [enabled, fetchBills]);

    const stats = useMemo(() => calculateBillStats(bills), [bills]);

    return {
        bills,
        loading,
        error,
        fetchBills,
        stats,
    };
};
