import { ExpenseCategory, LoanType, PartyType, type PaymentMode } from './enums';
import { CASH_BANK_VOUCHER_MODE_OPTIONS, type PaymentModeOption } from './accountingInputOptions';
import { GST_SLABS } from './gstRates';

export type InterestType = 'SIMPLE' | 'COMPOUND';
export type StaffInviteRole = 'staff' | 'salesman' | 'manager';

export const PARTY_TYPE_OPTIONS: {
    label: string;
    value: typeof PartyType[keyof typeof PartyType];
    description: string;
}[] = [
    { label: 'Customer', value: PartyType.CUSTOMER, description: 'Use for sales invoices, receipts, and receivables.' },
    { label: 'Supplier', value: PartyType.SUPPLIER, description: 'Use for purchase bills, payments, and payables.' },
];

export const EXPENSE_CATEGORY_OPTIONS: {
    label: string;
    value: typeof ExpenseCategory[keyof typeof ExpenseCategory];
    description: string;
}[] = Object.values(ExpenseCategory).map((value) => ({
    value,
    label: value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
    description: 'Use for expense grouping and reporting.',
}));

export const EXPENSE_CATEGORY_FILTER_OPTIONS = [
    { label: 'All', value: 'ALL', description: 'Show expenses from every category.' },
    ...EXPENSE_CATEGORY_OPTIONS,
] as const;

export const EXPENSE_PAYMENT_MODE_OPTIONS: PaymentModeOption[] =
    CASH_BANK_VOUCHER_MODE_OPTIONS;

export const LOAN_TYPE_OPTIONS: {
    label: string;
    value: typeof LoanType[keyof typeof LoanType];
    description: string;
}[] = [
    { label: 'Borrowed', value: LoanType.BORROWED, description: 'Money the business owes to another party.' },
    { label: 'Given', value: LoanType.GIVEN, description: 'Money another party owes to the business.' },
];

export const INTEREST_TYPE_OPTIONS: {
    label: string;
    value: InterestType;
    description: string;
}[] = [
    { label: 'Simple', value: 'SIMPLE', description: 'Interest calculated on principal amount only.' },
    { label: 'Compound', value: 'COMPOUND', description: 'Interest calculated on principal plus accrued interest.' },
];

export const STAFF_ROLE_OPTIONS: {
    label: string;
    value: StaffInviteRole;
    description: string;
}[] = [
    { label: 'Staff', value: 'staff', description: 'General operational access with limited permissions.' },
    { label: 'Salesman', value: 'salesman', description: 'Focused on billing, receipts, and field selling workflows.' },
    { label: 'Manager', value: 'manager', description: 'Supervisory access without owner-only controls.' },
];

export const ITEM_GST_RATE_OPTIONS = GST_SLABS.map((value) => ({
    label: `${value}%`,
    value: String(value),
    description: `Apply ${value}% GST to this item.`,
}));

export const getPaymentModeOption = (mode: string | null | undefined) =>
    EXPENSE_PAYMENT_MODE_OPTIONS.find((entry) => entry.value === mode);

export const getPaymentModeLabelFromOptions = (mode: PaymentMode | string | null | undefined) =>
    getPaymentModeOption(mode)?.label ?? (String(mode ?? '').trim() || 'Cash');
