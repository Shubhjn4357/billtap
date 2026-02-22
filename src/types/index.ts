export type FirestoreDate = Date | number | string;

export type SubscriptionStatus = 'inactive' | 'active' | 'expired' | 'canceled';
export type UserRole = 'owner' | 'staff' | 'admin';
export type OfferAudience = 'all' | 'active_subscribers' | 'inactive_subscribers';
export type PartyType = 'customer' | 'supplier';
export type TransactionType = 'SALE' | 'PURCHASE';

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
    category?: string;
    role?: UserRole;
    ownerId?: string | null; // For staff
    subscriptionStatus?: SubscriptionStatus;
    subscriptionPlanId?: string;
    subscriptionPlanName?: string;
    subscriptionAmountMonthly?: number;
    subscriptionCurrency?: string;
    subscriptionEndsAt?: FirestoreDate;
    upiId?: string;
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
    provider: 'stripe' | 'razorpay';
    status: 'pending' | 'succeeded' | 'failed' | 'canceled';
    checkoutUrl?: string;
    providerReference?: string;
    failureReason?: string;
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

// Updated Item Interface
export interface Item {
    id: string;
    userId: string;
    organizationId?: string;
    name: string;
    nameLowercase: string;

    // Pricing
    price: number; // Selling Price
    purchasePrice?: number;
    mrp?: number;

    // Taxes
    hsn?: string;
    gstPercentage?: number;

    // Stock
    stock: number;
    lowStockThreshold?: number;
    minimumStock?: number;
    openingStock?: number;
    unit?: string;

    // Meta
    category?: string;
    subcategory?: string;
    location?: string;
    barcode?: string;
    imageUrl?: string;
    expiresAt?: FirestoreDate | null;
    autoDeleteAt?: FirestoreDate | null;
    autoDeleteEnabled?: boolean;
    isActive?: boolean;

    createdAt?: FirestoreDate;
    updatedAt: FirestoreDate;
}

// New Party Interface
export interface Party {
    id: string;
    userId: string;
    name: string;
    type: PartyType;
    phone?: string;
    email?: string;
    address?: string;
    gstNumber?: string;
    isActive: boolean;
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

// New Transaction Interface (Replacing Bill/Orders)
export interface TransactionItem {
    id: string;
    name: string;
    quantity: number;
    price: number; // Unit Price
    tax: number;
    total: number;
}

export interface Transaction {
    id: string;
    userId: string;
    organizationId?: string;
    type: TransactionType;
    partyId?: string;
    partyName?: string;
    partyPhone?: string;
    billNumber?: string;
    billDate: FirestoreDate;
    items: TransactionItem[];
    totalAmount: number;
    discountAmount?: number;
    taxAmount?: number;
    paidAmount?: number;
    paymentMode?: 'CASH' | 'CREDIT';
    paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
    billMode?: 'GST' | 'ESTIMATE';
    affectsGst?: boolean;
    createdByUid?: string;
    dueDate?: FirestoreDate | null;
    reminderEnabled?: boolean;
    reminderFrequencyDays?: number;
    nextReminderAt?: FirestoreDate | null;
    lastReminderAt?: FirestoreDate | null;
    billingAddress?: string;
    deliveryAddress?: string;
    currency: string;
    remark?: string;
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

// Billing UI model backed by SALE transactions on the server.
export interface BillItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    tax?: number;
    total?: number;
}

export interface Bill {
    id: string;
    userId: string;
    type?: TransactionType; // Defaults to SALE
    billMode?: 'GST' | 'ESTIMATE';
    partyId?: string; // Links to Party
    customerName?: string; // Legacy/Display
    customerPhone?: string; // Legacy/Display
    businessName?: string;
    businessAddress?: string;
    gstNumber?: string;
    customerAddress?: string;
    currency?: string;
    billNumber?: string;
    billDate?: FirestoreDate;
    paymentMode?: 'CASH' | 'CREDIT';
    printerType?: 'STANDARD' | 'THERMAL';
    paperSize?: 'A4' | 'A5' | '2INCH' | '3INCH';
    acknowledgmentText?: string;
    footerText?: string;
    upiId?: string;
    qrImageDataUrl?: string;
    signatureImageUrl?: string;
    taxAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    items: BillItem[];
    total: number;
    billingAddress?: string;
    deliveryAddress?: string;
    createdAt: FirestoreDate;
}

export interface StaffInvite {
    id: string;
    ownerId: string;
    phoneNumber: string;
    role: string;
    status: 'pending' | 'accepted' | 'rejected';
    code: string;
    expiresAt: FirestoreDate;
    createdAt: FirestoreDate;
}

// Consolidated Account Type
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | 'CASH' | 'BANK';

export interface Account {
    id: string;
    organizationId: string;
    code?: string; // Added for Chart of Accounts
    name: string;
    type: AccountType;
    balance: number;
    isDefault: boolean;
    isActive?: boolean;
    isSystem?: boolean; // Added for protected accounts
    details?: string; // JSON string for bank details
    createdAt?: FirestoreDate;
    updatedAt?: FirestoreDate;
}

export interface JournalLineInput {
    accountId: string;
    partyId?: string;
    debit?: number;
    credit?: number;
    hsn?: string;
    gstRate?: number;
    taxType?: 'CGST' | 'SGST' | 'IGST' | 'CESS';
}
