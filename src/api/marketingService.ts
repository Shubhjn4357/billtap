import type { MarketingOffer, UserProfile } from '../types';
import { isNetworkLikeError } from '../utils/errorGuards';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import { subscriptionService } from './subscriptionService';

const OFFERS_CACHE_KEY = 'billtap_offer_cache_v1';

const readOffersCache = async (): Promise<MarketingOffer[]> => {
    const raw = await offlineKeyValueStore.getItem(OFFERS_CACHE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as MarketingOffer[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeOffersCache = async (offers: MarketingOffer[]) => {
    await offlineKeyValueStore.setItem(OFFERS_CACHE_KEY, JSON.stringify(offers));
};

const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' || typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
        return (value as { toDate: () => Date }).toDate();
    }
    return null;
};

const matchesAudience = (offer: MarketingOffer, user: UserProfile | null) => {
    const status = user?.subscriptionStatus ?? 'inactive';
    if (offer.audience === 'all') return true;
    if (offer.audience === 'active_subscribers') return status === 'active';
    if (offer.audience === 'inactive_subscribers') return status !== 'active';
    return false;
};

const withinActiveWindow = (offer: MarketingOffer, now: Date) => {
    const start = toDate(offer.startsAt);
    const end = toDate(offer.endsAt);

    if (start && start > now) return false;
    if (end && end < now) return false;
    return true;
};

export const marketingService = {
    async getActiveOffersForUser(user: UserProfile | null): Promise<MarketingOffer[]> {
        let allOffers: MarketingOffer[] = [];

        try {
            allOffers = await subscriptionService.getActiveOffers();
            await writeOffersCache(allOffers);
        } catch (error: unknown) {
            const cachedOffers = await readOffersCache();
            if (cachedOffers.length > 0 || isNetworkLikeError(error)) {
                allOffers = cachedOffers;
            } else {
                throw error;
            }
        }

        const now = new Date();
        return allOffers
            .filter((offer) => offer.isActive && withinActiveWindow(offer, now) && matchesAudience(offer, user))
            .sort((a, b) => b.priority - a.priority);
    },
};
