import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function PurchaseReturnScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Purchase Return (Debit Note)',
                invoiceType: 'DEBIT_NOTE_DOC',
                transactionType: 'RETURN_INWARD',
                documentKind: 'DEBIT_NOTE_DOC',
                partyPlaceholder: '+ Select Supplier (optional)',
                helperText: 'Debit note for supplier return. Purchase impact with stock outward.',
            }}
        />
    );
}
