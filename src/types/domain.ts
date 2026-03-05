// Full TypeScript domain types matching the server schema

import type { SubscriptionTier, SubscriptionStatus, BillingCycle, FeatureFlag, PartyType, InvoiceType, VoucherType, PaymentStatus, AccountType, SettingsSection, ExpenseCategory, PaymentMode, LoanType } from '../constants/enums';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
    id: string;
    googleSub: string;
    name: string;
    email: string;
    phone: string | null;
    photoUrl: string | null;
    isDisabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Business {
    id: string;
    ownerUserId: string;
    name: string;
    legalName: string | null;
    address: string | null;
    state: string | null;
    city?: string | null;
    pincode?: string | null;
    gstin: string | null;
    pan: string | null;
    booksStartDate: string | null;
    openingCashInHand?: number | null;
    openingCashInBank?: number | null;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    category: string | null;
    code: string | null;
    isActive: boolean;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface Subscription {
    id: string;
    businessId: string;
    tier: SubscriptionTier;
    billingCycle: BillingCycle | null;
    status: SubscriptionStatus;
    startDate: string | null;
    endDate: string | null;
    nextRenewalDate: string | null;
    renewsAt: string | null;        // alias for nextRenewalDate
    graceEndDate: string | null;
    maxBillsTotal: number | null;
    maxBillsPerMonth: number | null;
    maxStaffUsers: number | null;
    maxBusinesses: number | null;
    maxDevices: number | null;
    maxStorageMb: number | null;
    monthlyInvoiceCount: number;    // usage counter for current month
    offlineOnly: boolean;
    cloudSyncAllowed: boolean;
    webDashboardAllowed: boolean;
    featureFlagsEnabled: FeatureFlag[];
    createdAt: string;
    updatedAt: string;
}

// ─── Parties & Items ──────────────────────────────────────────────────────────

export interface Party {
    id: string;
    businessId: string;
    type: PartyType;
    name: string;
    phone: string | null;
    email: string | null;
    billingAddress: string | null;
    shippingAddress: string | null;
    gstin: string | null;
    openingBalance: number;
    creditLimit: number;
    loyaltyPoints: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Item {
    id: string;
    businessId: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    hsnCode: string | null;
    unit: string | null;
    category: string | null;
    mrp: number;
    purchasePrice: number;
    salePrice: number;
    gstRate: number;
    openingStock: number;
    stock: number;
    reorderLevel: number;
    description: string | null;
    location: string | null;
    imageUrl: string | null;
    expiresAt: string | null;
    autoDeleteAt: string | null;
    autoDeleteEnabled: boolean;
    isSalesPriceInclusiveGst: boolean;
    trackStock: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface InventoryMovement {
    id: string;
    businessId: string;
    itemId: string;
    movementType: string;
    quantity: number;
    balanceAfter: number | null;
    reason: string | null;
    referenceId: string | null;
    createdByUserId: string | null;
    createdAt: string;
}

// ─── Invoicing ────────────────────────────────────────────────────────────────

export interface InvoiceItem {
    id: string;
    invoiceId: string;
    itemId: string | null;
    description: string;
    quantity: number;
    unit: string | null;
    rate: number;
    discountPercent: number;
    discountAmount: number;
    taxableValue: number;
    gstRate: number;            // convenience: cgstRate * 2 or igstRate
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    cessRate: number;
    cessAmount: number;
    total: number;              // taxableValue + all tax amounts
    sortOrder: number;
}

export interface Invoice {
    id: string;
    businessId: string;
    invoiceType: InvoiceType;
    invoiceNumber: string;
    invoiceDate: string;
    partyId: string | null;
    placeOfSupply: string | null;
    totalTaxableValue: number;
    totalTaxAmount: number;
    totalInvoiceValue: number;
    discountAmount: number;
    roundOffAmount: number;
    additionalCharges: number;
    reverseCharge: boolean;
    gstRateBreakupJson: Record<string, unknown>;
    eInvoiceIrn: string | null;
    eInvoiceStatus: string | null;
    eWayBillNumber: string | null;
    paymentStatus: PaymentStatus;
    paidAmount: number;
    dueDate: string | null;
    notes: string | null;
    termsAndConditions: string | null;
    sourceVoucherType: string | null;
    sourceVoucherId: string | null;
    isDeleted: boolean;
    createdByUserId: string | null;
    createdAt: string;
    updatedAt: string;
    items?: InvoiceItem[];
    party?: Partial<Party>;
    partySnapshot?: { name: string; gstin?: string | null; phone?: string | null; address?: string | null };
    totalCgstAmount: number;
    totalSgstAmount: number;
    totalIgstAmount: number;
}

// ─── Invoice Builder (local state) ───────────────────────────────────────────

export interface InvoiceLineItem {
    _key: string;
    itemId: string | null;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    discountPercent: number;
    gstRate: number;
    isInterState: boolean;
    // Computed
    discountAmount: number;
    taxableValue: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    total: number;
}

export interface InvoiceBuilderState {
    invoiceType: InvoiceType;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    partyId: string | null;
    partySnapshot: Partial<Party> | null;
    placeOfSupply: string;
    items: InvoiceLineItem[];
    discountAmount: number;
    additionalCharges: number;
    roundOffAmount: number;
    paymentMode: PaymentMode;
    paidAmount: number;
    reverseCharge: boolean;
    notes: string;
    termsAndConditions: string;
}

// ─── Voucher & Accounting ────────────────────────────────────────────────────

export interface Voucher {
    id: string;
    businessId: string;
    voucherType: VoucherType;
    date: string;
    number: string;
    partyId: string | null;
    totalAmount: number;
    narration: string | null;
    status: string;
    createdByUserId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface VoucherLine {
    id: string;
    voucherId: string;
    accountId: string;
    debit: number;
    credit: number;
}

export interface Account {
    id: string;
    businessId: string;
    name: string;
    code: string;
    type: AccountType;
    parentAccountId: string | null;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    balance?: number;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface Expense {
    id: string;
    businessId: string;
    category: ExpenseCategory;
    accountId: string | null;
    amount: number;
    gstRate?: number;
    isGstIncluded?: boolean;
    date: string;
    expenseDate: string;    // alias: same as date, used by API
    description: string | null;
    paymentMode: string;
    partyId: string | null;
    partyName: string | null; // denormalized name for quick display
    receiptUrl: string | null;
    createdByUserId: string | null;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ExpenseCategorySummary {
    category: ExpenseCategory;
    total: number;
    count: number;
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export interface Loan {
    id: string;
    businessId: string;
    lenderBorrowerName: string;
    loanType: LoanType;
    openingDate: string;
    startDate: string;              // alias for openingDate
    openingBalance: number;
    principalAmount: number;        // initial amount
    currentBalance: number;
    interestRatePercent: number;
    interestType: 'SIMPLE' | 'COMPOUND';
    emiAmount: number | null;
    dueDate: string | null;
    accountId: string | null;
    partyId: string | null;
    description: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    transactions?: LoanTransaction[];
}

export interface LoanTransaction {
    id: string;
    loanId: string;
    businessId: string;
    transactionType: 'DISBURSEMENT' | 'REPAYMENT' | 'INTEREST';
    type: 'DISBURSEMENT' | 'REPAYMENT' | 'INTEREST';  // alias
    amount: number;
    balanceAfter: number;
    date: string;
    description: string | null;
    notes: string | null;
    createdAt: string;
}

// ─── Godowns ──────────────────────────────────────────────────────────────────

export interface Godown {
    id: string;
    businessId: string;
    name: string;
    address: string | null;
    managerName: string | null;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface GodownStockEntry {
    itemId: string;
    quantity: number;
    itemName: string | null;
    itemSku: string | null;
    itemUnit: string | null;
}

export interface StockTransfer {
    id: string;
    businessId: string;
    fromGodownId: string;
    toGodownId: string;
    itemId: string;
    quantity: number;
    date: string;
    notes: string | null;
    createdAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type BusinessSettingsMap = Partial<Record<SettingsSection, Record<string, unknown>>>;

export interface GeneralSettings {
    businessName?: string;
    gstin?: string;
    pan?: string;
    address?: string;
    state?: string;
    logoUrl?: string;
    signatureUrl?: string;
    currency?: string;
    amountRoundingMode?: string;
    paymentUpiId?: string;
    paymentReceiverName?: string;
}

export interface TaxSettings {
    defaultGstRate?: number;
    showHsn?: boolean;
    enableCess?: boolean;
    enableReverseCharge?: boolean;
    compositeScheme?: boolean;
    placeOfSupply?: string;
}

export interface TransactionSettings {
    currentInvoicePrefix?: string;
    invoiceAutoNumber?: boolean;
    defaultPaymentMode?: string;
    enableDueDate?: boolean;
    defaultDueDays?: number;
    enableEWayBill?: boolean;
    enableEInvoice?: boolean;
    shareTransactionMode?: string;
    showItemCodes?: boolean;
    showItemDescription?: boolean;
    showHsnInItems?: boolean;
    showDiscountPerItem?: boolean;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthSession {
    userId: string;
    token: string;
    refreshToken?: string;
    expiresAt: number;
}

export interface BusinessMember {
    id: string;
    businessId: string;
    userId: string;
    role: 'OWNER' | 'STAFF';
    permissions: Record<string, boolean>;
    isActive: boolean;
    phoneSnapshot: string | null;
    joinedAt: string;
}

export interface StaffMember {
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    role: 'owner' | 'staff';
    ownerId: string | null;
}

export interface StaffInvite {
    id: string;
    ownerId: string;
    organizationId: string;
    phoneNumber: string;
    role: 'owner' | 'staff';
    status: string;
    code: string;
    expiresAt: string | null;
    createdAt: string;
}

export interface OperationsControls {
    makerCheckerEnabled: boolean;
    journalApprovalRequired: boolean;
    stockAdjustmentApprovalRequired: boolean;
    periodLockEnabled: boolean;
}

export interface FinancialPeriod {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: 'OPEN' | 'LOCKED' | 'CLOSED';
    notes: string | null;
    lockedAt: string | null;
    closedAt: string | null;
    reopenedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type OperationApprovalActionType =
    | 'UPDATE_CONTROLS'
    | 'LOCK_PERIOD'
    | 'CLOSE_PERIOD'
    | 'REOPEN_PERIOD'
    | 'CUSTOM';

export type OperationApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OperationApproval {
    id: string;
    actionType: OperationApprovalActionType;
    module: string;
    status: OperationApprovalStatus;
    payload: Record<string, unknown>;
    requestedByUserId: string | null;
    requestedByRole: string | null;
    requestedAt: string;
    reviewedByUserId: string | null;
    reviewedByRole: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
}

export interface OperationsAuditLog {
    id: string;
    module: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    actorUid: string | null;
    actorRole: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

export interface Plan {
    id: string;
    tier: SubscriptionTier;
    billingCycle: BillingCycle | null;
    displayName: string;
    description: string;
    pricePerCycle: number;
    currency: string;
    isVisible: boolean;
    displayOrder: number;
    enabledFeatures: FeatureFlag[];
}

// ─── GST Reports ─────────────────────────────────────────────────────────────

export interface Gstr1Summary {
    period: string;
    b2b: number;
    b2c: number;
    cdnr: number;
    exports: number;
    totalTaxable: number;
    totalTax: number;
}

export interface Gstr3BSummary {
    period: string;
    outwardTaxable: number;
    outwardTax: number;
    inwardCredits: number;
    netTaxPayable: number;
}

// ─── POS ─────────────────────────────────────────────────────────────────────

export interface PosCartItem {
    _key: string;
    itemId: string | null;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    mrp: number;
    discountPercent: number;
    gstRate: number;
    isInterState: boolean;
    taxableValue: number;
    totalAmount: number;
}

// ─── Offers & Notifications ───────────────────────────────────────────────────

export interface Offer {
    id: string;
    title: string;
    message: string;
    bannerUrl: string | null;
    bannerBackground: string | null;
    ctaText: string | null;
    ctaRoute: string | null;
    audience: string;
    isActive: boolean;
    priority: number;
    startsAt: string | null;
    endsAt: string | null;
}
