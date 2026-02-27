export interface Plan {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    currency: string;
    isActive: boolean;
    displayOrder: number;
    features: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    businessName: string | null;
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
    bannerUrl?: string;
    isActive: boolean;
    priority: number;
    audience: "all" | "owners" | "staff";
    startsAt?: string;
    endsAt?: string;
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
