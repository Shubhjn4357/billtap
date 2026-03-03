import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function SaleReturnScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Sale Return (Credit Note)',
                invoiceType: 'CREDIT_NOTE_DOC',
                transactionType: 'RETURN_OUTWARD',
                documentKind: 'CREDIT_NOTE_DOC',
                partyPlaceholder: '+ Select Customer (optional)',
                helperText: 'Credit note against outward return. Sales impact with stock inward.',
            }}
        />
    );
}
