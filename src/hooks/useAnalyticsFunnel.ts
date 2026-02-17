import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../api/analyticsService';
import type { AnalyticsEvent, AnalyticsEventType } from '../types';
import { isNetworkLikeError } from '../utils/errorGuards';

export interface FunnelMetrics {
    views: number;
    planSelects: number;
    checkoutsStarted: number;
    redirects: number;
    successes: number;
    failures: number;
    viewToPlanRate: number;
    planToCheckoutRate: number;
    checkoutToSuccessRate: number;
    overallConversionRate: number;
}

const buildCounts = (events: AnalyticsEvent[]) => {
    const base: Record<AnalyticsEventType, number> = {
        offer_impression: 0,
        offer_click: 0,
        subscription_screen_view: 0,
        plan_selected: 0,
        checkout_started: 0,
        checkout_redirected: 0,
        payment_success: 0,
        payment_failed: 0,
    };

    for (const event of events) {
        base[event.eventType] = (base[event.eventType] ?? 0) + 1;
    }
    return base;
};

const safeRate = (numerator: number, denominator: number) => {
    if (!denominator || denominator <= 0) return 0;
    return numerator / denominator;
};

export const useAnalyticsFunnel = (days = 30) => {
    const normalizedDays = Math.max(1, days);

    const query = useQuery({
        queryKey: ['analytics-funnel', normalizedDays] as const,
        queryFn: async (): Promise<AnalyticsEvent[]> => {
            const start = new Date();
            start.setDate(start.getDate() - normalizedDays);
            return await analyticsService.getEventsInRange(start, 5000);
        },
        staleTime: 30_000,
    });

    const events = useMemo(() => query.data ?? [], [query.data]);
    const error = query.error && !isNetworkLikeError(query.error)
        ? (query.error instanceof Error ? query.error.message : 'Failed to load analytics.')
        : null;

    const fetchFunnelData = useCallback(async () => {
        await query.refetch();
    }, [query]);

    const metrics = useMemo<FunnelMetrics>(() => {
        const counts = buildCounts(events);
        const views = counts.subscription_screen_view;
        const planSelects = counts.plan_selected;
        const checkoutsStarted = counts.checkout_started;
        const redirects = counts.checkout_redirected;
        const successes = counts.payment_success;
        const failures = counts.payment_failed;

        return {
            views,
            planSelects,
            checkoutsStarted,
            redirects,
            successes,
            failures,
            viewToPlanRate: safeRate(planSelects, views),
            planToCheckoutRate: safeRate(checkoutsStarted, planSelects),
            checkoutToSuccessRate: safeRate(successes, checkoutsStarted),
            overallConversionRate: safeRate(successes, views),
        };
    }, [events]);

    return {
        events,
        loading: query.isFetching && events.length === 0,
        error,
        metrics,
        fetchFunnelData,
    };
};
