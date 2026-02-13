import type { MarketingOffer, UserProfile } from '../types';
import { adminService } from './adminService';

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
        const allOffers = await adminService.getOffers(false);
        const now = new Date();

        return allOffers
            .filter((offer) => offer.isActive && withinActiveWindow(offer, now) && matchesAudience(offer, user))
            .sort((a, b) => b.priority - a.priority);
    },
};
