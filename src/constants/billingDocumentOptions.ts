import { InvoiceType } from './enums';

export type BillingDocumentConfig = {
    title: string;
    invoiceType: InvoiceType;
    transactionType?: 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD';
    documentKind?: string;
    billMode?: 'GST' | 'ESTIMATE';
    partyPlaceholder?: string;
    helperText?: string;
};

const DEFAULT_BILLING_DOCUMENT_TYPE = 'TAX_INVOICE';

const BILLING_DOCUMENT_CONFIGS: Record<string, BillingDocumentConfig> = {
    TAX_INVOICE: {
        title: 'Sale Invoice',
        invoiceType: 'TAX_INVOICE',
        transactionType: 'SALE',
        documentKind: 'TAX_INVOICE',
        helperText: 'GST tax invoice with posting to receivables/cash.',
    },
    PURCHASE_BILL: {
        title: 'Purchase Bill',
        invoiceType: 'TAX_INVOICE',
        transactionType: 'PURCHASE',
        documentKind: 'PURCHASE_BILL',
        partyPlaceholder: '+ Select Supplier (required)',
        helperText: 'Purchase voucher with stock inward and payable booking.',
    },
    CREDIT_NOTE_DOC: {
        title: 'Sale Return (Credit Note)',
        invoiceType: 'CREDIT_NOTE_DOC',
        transactionType: 'RETURN_OUTWARD',
        documentKind: 'CREDIT_NOTE_DOC',
        partyPlaceholder: '+ Select Customer (optional)',
        helperText: 'Credit note against outward return. Sales impact with stock inward.',
    },
    DEBIT_NOTE_DOC: {
        title: 'Purchase Return (Debit Note)',
        invoiceType: 'DEBIT_NOTE_DOC',
        transactionType: 'RETURN_INWARD',
        documentKind: 'DEBIT_NOTE_DOC',
        partyPlaceholder: '+ Select Supplier (required)',
        helperText: 'Debit note for supplier return. Purchase impact with stock outward.',
    },
    SALE_ORDER: {
        title: 'Sale Order',
        invoiceType: 'ESTIMATE',
        transactionType: 'SALE',
        documentKind: 'SALE_ORDER',
        billMode: 'ESTIMATE',
        helperText: 'Non-posting sale order. Convert to invoice when fulfilled.',
    },
    PURCHASE_ORDER: {
        title: 'Purchase Order',
        invoiceType: 'PROFORMA',
        transactionType: 'PURCHASE',
        documentKind: 'PURCHASE_ORDER',
        billMode: 'ESTIMATE',
        partyPlaceholder: '+ Select Supplier (required)',
        helperText: 'Non-posting purchase order. Convert to purchase bill on receipt.',
    },
    DELIVERY_CHALLAN_DOC: {
        title: 'Delivery Challan',
        invoiceType: 'DELIVERY_CHALLAN_DOC',
        transactionType: 'SALE',
        documentKind: 'DELIVERY_CHALLAN_DOC',
        billMode: 'ESTIMATE',
        helperText: 'Delivery challan flow before final tax invoice.',
    },
    ESTIMATE: {
        title: 'Estimate / Quotation',
        invoiceType: 'ESTIMATE',
        transactionType: 'SALE',
        documentKind: 'ESTIMATE',
        billMode: 'ESTIMATE',
        helperText: 'Non-posting estimate. Convert to invoice when accepted.',
    },
    PROFORMA: {
        title: 'Proforma Invoice',
        invoiceType: 'PROFORMA',
        transactionType: 'SALE',
        documentKind: 'PROFORMA',
        billMode: 'ESTIMATE',
    },
};

export const getBillingDocumentConfig = (rawType?: string): BillingDocumentConfig => {
    const type = String(rawType ?? DEFAULT_BILLING_DOCUMENT_TYPE).toUpperCase();
    return BILLING_DOCUMENT_CONFIGS[type] ?? BILLING_DOCUMENT_CONFIGS[DEFAULT_BILLING_DOCUMENT_TYPE];
};
