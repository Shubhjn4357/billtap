import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DocumentCreateScreen, type BillingDocumentConfig } from '../../../components/billing/DocumentCreateScreen';

const toConfig = (rawType?: string): BillingDocumentConfig => {
    const type = String(rawType ?? 'TAX_INVOICE').toUpperCase();

    if (type === 'PURCHASE_BILL') {
        return {
            title: 'Purchase Bill',
            invoiceType: 'TAX_INVOICE',
            transactionType: 'PURCHASE',
            documentKind: 'PURCHASE_BILL',
            partyPlaceholder: '+ Select Supplier (optional)',
            helperText: 'Purchase voucher with stock inward and payable booking.',
        };
    }

    if (type === 'CREDIT_NOTE_DOC') {
        return {
            title: 'Sale Return (Credit Note)',
            invoiceType: 'CREDIT_NOTE_DOC',
            transactionType: 'RETURN_OUTWARD',
            documentKind: 'CREDIT_NOTE_DOC',
            partyPlaceholder: '+ Select Customer (optional)',
            helperText: 'Credit note against outward return. Sales impact with stock inward.',
        };
    }

    if (type === 'DEBIT_NOTE_DOC') {
        return {
            title: 'Purchase Return (Debit Note)',
            invoiceType: 'DEBIT_NOTE_DOC',
            transactionType: 'RETURN_INWARD',
            documentKind: 'DEBIT_NOTE_DOC',
            partyPlaceholder: '+ Select Supplier (optional)',
            helperText: 'Debit note for supplier return. Purchase impact with stock outward.',
        };
    }

    if (type === 'SALE_ORDER') {
        return {
            title: 'Sale Order',
            invoiceType: 'ESTIMATE',
            transactionType: 'SALE',
            documentKind: 'SALE_ORDER',
            billMode: 'ESTIMATE',
            helperText: 'Non-posting sale order. Convert to invoice when fulfilled.',
        };
    }

    if (type === 'PURCHASE_ORDER') {
        return {
            title: 'Purchase Order',
            invoiceType: 'PROFORMA',
            transactionType: 'PURCHASE',
            documentKind: 'PURCHASE_ORDER',
            billMode: 'ESTIMATE',
            partyPlaceholder: '+ Select Supplier (optional)',
            helperText: 'Non-posting purchase order. Convert to purchase bill on receipt.',
        };
    }

    if (type === 'DELIVERY_CHALLAN_DOC') {
        return {
            title: 'Delivery Challan',
            invoiceType: 'DELIVERY_CHALLAN_DOC',
            transactionType: 'SALE',
            documentKind: 'DELIVERY_CHALLAN_DOC',
            billMode: 'ESTIMATE',
            helperText: 'Delivery challan flow before final tax invoice.',
        };
    }

    if (type === 'ESTIMATE') {
        return {
            title: 'Estimate / Quotation',
            invoiceType: 'ESTIMATE',
            transactionType: 'SALE',
            documentKind: 'ESTIMATE',
            billMode: 'ESTIMATE',
            helperText: 'Non-posting estimate. Convert to invoice when accepted.',
        };
    }

    if (type === 'PROFORMA') {
        return {
            title: 'Proforma Invoice',
            invoiceType: 'PROFORMA',
            transactionType: 'SALE',
            documentKind: 'PROFORMA',
            billMode: 'ESTIMATE',
        };
    }

    return {
        title: 'Sale Invoice',
        invoiceType: 'TAX_INVOICE',
        transactionType: 'SALE',
        documentKind: 'TAX_INVOICE',
        helperText: 'GST tax invoice with posting to receivables/cash.',
    };
};

export default function InvoiceCreateScreen() {
    const { type } = useLocalSearchParams<{ type?: string }>();
    const config = useMemo(() => toConfig(type), [type]);
    return <DocumentCreateScreen config={config} />;
}
