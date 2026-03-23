export interface Plan {
    id: string;
    name: string;
    displayName?: string;
    description: string;
    monthlyPrice: number;
    pricePerCycle?: number;
    currency: string;
    isActive: boolean;
    isVisible?: boolean;
    displayOrder: number;
    features: string[];
    enabledFeatures?: string[];
    disabledFeatures?: string[];
    tier?: "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
    billingCycle?: "MONTHLY" | "YEARLY" | "THREE_YEAR" | null;
    effectiveDiscountVsMonthlyPercent?: number | null;
    maxBillsTotal?: number | null;
    maxBillsPerMonth?: number | null;
    maxStaffUsers?: number | null;
    maxBusinesses?: number | null;
    maxDevices?: number | null;
    maxStorageMb?: number | null;
    offlineOnly?: boolean;
    cloudSyncAllowed?: boolean;
    webDashboardAllowed?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    businessName: string | null;
    primaryBusinessId?: string | null;
    businesses?: { id: string; name: string; ownerUserId: string }[];
    phoneNumber: string | null;
    role: "owner" | "staff" | "admin";
    subscriptionStatus: "active" | "inactive" | "canceled" | "past_due";
    subscriptionPlanId: string | null;
    subscriptionPlanName: string | null;
    subscriptionEndsAt: string | null;
    createdAt: string;
}

export interface Offer {
    id: string;
    title: string;
    message: string;
    bannerUrl?: string | null;
    bannerBackground?: string | null;
    ctaText?: string | null;
    ctaRoute?: string | null;
    isActive: boolean;
    priority: number;
    audience: "all" | "owners" | "staff";
    startsAt?: string | null;
    endsAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ApiResponse<T> {
    ok: boolean;
    message?: string;
    data?: T;
    // Specific keys based on server response structure
    plans?: T;
    plan?: T;
    users?: T;
    user?: T;
    offers?: T;
    offer?: T;
}

export type TemplateType = "invoice" | "card" | "email";

export interface TemplateContent {
    // Flexible structure for now, but strictly typed as record
    html?: string;
    json?: Record<string, unknown>;
    styles?: Record<string, string>;
    [key: string]: unknown;
}

export interface Template {
    id: string;
    name: string;
    type: TemplateType;
    content: TemplateContent;
    isDefault: boolean;
    thumbnailUrl?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
