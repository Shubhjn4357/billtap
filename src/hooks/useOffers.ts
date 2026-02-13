import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marketingService } from '../api/marketingService';
import type { MarketingOffer } from '../types';
import { useAuth } from './useAuth';

const OFFERS_CACHE_TTL_MS = 60_000;

export const useOffers = () => {
    const { user } = useAuth();
    const [offers, setOffers] = useState<MarketingOffer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlightRef = useRef<Promise<void> | null>(null);
    const lastFetchAtRef = useRef(0);

    const fetchOffers = useCallback(async (force = false) => {
        const withinCacheWindow = Date.now() - lastFetchAtRef.current < OFFERS_CACHE_TTL_MS;
        if (!force && offers.length > 0 && withinCacheWindow) {
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
                const data = await marketingService.getActiveOffersForUser(user ?? null);
                setOffers(data);
                lastFetchAtRef.current = Date.now();
            } catch (fetchError: unknown) {
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load offers.');
            } finally {
                setLoading(false);
                inFlightRef.current = null;
            }
        })();

        inFlightRef.current = request;
        await request;
    }, [offers.length, user]);

    useEffect(() => {
        void fetchOffers(true);
    }, [fetchOffers]);

    const primaryOffer = useMemo(() => offers[0] ?? null, [offers]);

    return {
        offers,
        primaryOffer,
        loading,
        error,
        fetchOffers,
    };
};
