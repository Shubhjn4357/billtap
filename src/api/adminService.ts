import {
    collection,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    setDoc,
    where,
    type DocumentData,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { MarketingOffer, SubscriptionPlan, UserProfile, UserRole } from '../types';

const USERS_COLLECTION = 'users';
const PLANS_COLLECTION = 'plans';
const OFFERS_COLLECTION = 'offers';

const toUserProfile = (uid: string, raw: DocumentData): UserProfile => ({
    uid,
    email: raw.email ?? null,
    phoneNumber: raw.phoneNumber ?? null,
    displayName: raw.displayName ?? null,
    photoURL: raw.photoURL ?? null,
    businessName: raw.businessName,
    address: raw.address,
    gstEnabled: raw.gstEnabled,
    gstNumber: raw.gstNumber,
    currency: raw.currency,
    role: raw.role,
    subscriptionStatus: raw.subscriptionStatus,
    subscriptionPlanId: raw.subscriptionPlanId,
    subscriptionPlanName: raw.subscriptionPlanName,
    subscriptionAmountMonthly: raw.subscriptionAmountMonthly,
    subscriptionCurrency: raw.subscriptionCurrency,
    subscriptionStartsAt: raw.subscriptionStartsAt,
    subscriptionEndsAt: raw.subscriptionEndsAt,
});

const toPlan = (id: string, raw: DocumentData): SubscriptionPlan => ({
    id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    monthlyPrice: Number(raw.monthlyPrice ?? 0),
    currency: raw.currency ?? 'INR',
    isActive: raw.isActive !== false,
    displayOrder: Number(raw.displayOrder ?? 0),
    features: Array.isArray(raw.features) ? raw.features : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
});

const toOffer = (id: string, raw: DocumentData): MarketingOffer => ({
    id,
    title: raw.title ?? '',
    message: raw.message ?? '',
    bannerUrl: raw.bannerUrl,
    bannerBackground: raw.bannerBackground,
    ctaText: raw.ctaText,
    ctaRoute: raw.ctaRoute,
    audience: raw.audience ?? 'all',
    isActive: raw.isActive !== false,
    priority: Number(raw.priority ?? 0),
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
});

export const adminService = {
    async getUsers(max = 200): Promise<UserProfile[]> {
        const usersQuery = query(collection(db, USERS_COLLECTION), limit(max));
        const snapshot = await getDocs(usersQuery);
        return snapshot.docs.map((userDoc) => toUserProfile(userDoc.id, userDoc.data()));
    },

    async updateUser(uid: string, payload: Partial<UserProfile>): Promise<void> {
        await setDoc(
            doc(db, USERS_COLLECTION, uid),
            {
                ...payload,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    },

    async updateUserRole(uid: string, role: UserRole): Promise<void> {
        await this.updateUser(uid, { role });
    },

    async getPlans(includeInactive = true): Promise<SubscriptionPlan[]> {
        const plansQuery = includeInactive
            ? query(collection(db, PLANS_COLLECTION), limit(100))
            : query(collection(db, PLANS_COLLECTION), where('isActive', '==', true), limit(100));

        const snapshot = await getDocs(plansQuery);
        return snapshot.docs
            .map((planDoc) => toPlan(planDoc.id, planDoc.data()))
            .sort((a, b) => a.displayOrder - b.displayOrder);
    },

    async upsertPlan(plan: SubscriptionPlan): Promise<void> {
        await setDoc(
            doc(db, PLANS_COLLECTION, plan.id),
            {
                ...plan,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    },

    async getOffers(includeInactive = true): Promise<MarketingOffer[]> {
        const offersQuery = includeInactive
            ? query(collection(db, OFFERS_COLLECTION), limit(200))
            : query(collection(db, OFFERS_COLLECTION), where('isActive', '==', true), limit(200));

        const snapshot = await getDocs(offersQuery);
        return snapshot.docs
            .map((offerDoc) => toOffer(offerDoc.id, offerDoc.data()))
            .sort((a, b) => b.priority - a.priority);
    },

    async upsertOffer(offer: MarketingOffer): Promise<void> {
        await setDoc(
            doc(db, OFFERS_COLLECTION, offer.id),
            {
                ...offer,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    },

    async setOfferActive(offerId: string, isActive: boolean): Promise<void> {
        await setDoc(
            doc(db, OFFERS_COLLECTION, offerId),
            {
                isActive,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    },
};
