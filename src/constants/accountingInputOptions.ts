import type { PaymentMode } from './enums';

export type CashBankAccountKind = 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER';

export type PaymentModeOption = {
    label: string;
    value: PaymentMode | 'CREDIT';
    description: string;
};

export const INVOICE_SETTLEMENT_MODE_OPTIONS: PaymentModeOption[] = [
    { label: 'Cash', value: 'CASH', description: 'Immediate collection into cash account.' },
    { label: 'Bank', value: 'BANK', description: 'Direct bank receipt or payment.' },
    { label: 'UPI', value: 'UPI', description: 'Digital receipt to bank account.' },
    { label: 'Cheque', value: 'CHEQUE', description: 'Cheque receipt or issuance.' },
    { label: 'Card', value: 'CARD', description: 'Card payment processed to bank.' },
    { label: 'Credit', value: 'CREDIT', description: 'No immediate cash or bank movement.' },
];

export const CASH_BANK_VOUCHER_MODE_OPTIONS: PaymentModeOption[] = INVOICE_SETTLEMENT_MODE_OPTIONS.filter(
    (entry) => entry.value !== 'CREDIT'
);

export const CASH_BANK_ACCOUNT_KIND_OPTIONS: {
    label: string;
    value: CashBankAccountKind;
    description: string;
}[] = [
    { label: 'Cash in Hand', value: 'CASH', description: 'Physical cash drawer or office cash balance.' },
    { label: 'Bank Account', value: 'BANK', description: 'Current, savings, overdraft, or merchant settlement account.' },
    { label: 'Cheque in Hand', value: 'CHEQUE', description: 'Post-dated or received cheques awaiting deposit.' },
    { label: 'Other Asset', value: 'OTHER', description: 'Temporary asset account not classified as cash or bank.' },
];

export const getPaymentModeLabel = (mode: string | null | undefined): string => {
    const match = INVOICE_SETTLEMENT_MODE_OPTIONS.find((entry) => entry.value === mode);
    return match?.label ?? (mode || 'Cash');
};

export const getVoucherReferenceHint = (mode: string | null | undefined): string => {
    if (mode === 'UPI') return 'UPI ref, PSP ID, or note';
    if (mode === 'BANK') return 'Bank ref, transfer ID, or note';
    if (mode === 'CHEQUE') return 'Cheque no, bank, or note';
    if (mode === 'CARD') return 'Card ref, terminal ID, or note';
    return 'Optional narration';
};
