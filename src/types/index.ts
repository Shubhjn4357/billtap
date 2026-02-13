
import type { Timestamp } from 'firebase/firestore';

export type FirestoreDate = Timestamp | Date | number | string;

export type SubscriptionStatus = 'inactive' | 'active' | 'expired' | 'canceled';
export type UserRole = 'owner' | 'staff' | 'admin';
export type OfferAudience = 'all' | 'active_subscribers' | 'inactive_subscribers';
export type AnalyticsEventType =
    | 'offer_impression'
    | 'offer_click'
    | 'subscription_screen_view'
    | 'plan_selected'
    | 'checkout_started'
    | 'checkout_redirected'
    | 'payment_success'
    | 'payment_failed';

export interface UserProfile {
    uid: string;
    email: string | null;
    phoneNumber: string | null;
    displayName: string | null;
    photoURL: string | null;
    businessName?: string;
    address?: string;
    gstEnabled?: boolean;
    gstNumber?: string;
    currency?: string;
    role?: UserRole;
    subscriptionStatus?: SubscriptionStatus;
    subscriptionPlanId?: string;
    subscriptionPlanName?: string;
    subscriptionAmountMonthly?: number;
    subscriptionCurrency?: string;
    subscriptionStartsAt?: FirestoreDate;
    subscriptionEndsAt?: FirestoreDate;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    currency: string;
    isActive: boolean;
    displayOrder: number;
    features: string[];
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

export interface MarketingOffer {
    id: string;
    title: string;
    message: string;
    bannerUrl?: string;
    bannerBackground?: string;
    ctaText?: string;
    ctaRoute?: string;
    audience: OfferAudience;
    isActive: boolean;
    priority: number;
    startsAt?: FirestoreDate;
    endsAt?: FirestoreDate;
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

export interface AnalyticsEvent {
    id: string;
    userId: string;
    eventType: AnalyticsEventType;
    source?: string;
    planId?: string;
    offerId?: string;
    value?: number;
    currency?: string;
    metadata?: Record<string, string | number | boolean>;
    createdAt?: FirestoreDate;
}

export interface PaymentIntent {
    id: string;
    userId: string;
    planId: string;
    planName: string;
    amount: number;
    currency: string;
    provider: 'stripe' | 'razorpay' | 'mock';
    status: 'pending' | 'succeeded' | 'failed' | 'canceled';
    checkoutUrl?: string;
    providerReference?: string;
    failureReason?: string;
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

export interface Item {
    id: string;
    userId: string;
    name: string;
    nameLowercase: string;
    price: number;
    stock: number;
    category?: string;
    barcode?: string;
    updatedAt: FirestoreDate;
}

export interface BillItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export interface Bill {
    id?: string;
    userId: string;
    customerName?: string;
    customerPhone?: string;
    businessName?: string;
    businessAddress?: string;
    gstNumber?: string;
    currency?: string;
    items: BillItem[];
    total: number;
    createdAt: FirestoreDate;
}
