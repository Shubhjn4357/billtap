import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function PurchaseOrderScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Purchase Order',
                invoiceType: 'PROFORMA',
                transactionType: 'PURCHASE',
                documentKind: 'PURCHASE_ORDER',
                billMode: 'ESTIMATE',
                partyPlaceholder: '+ Select Supplier (optional)',
                helperText: 'Non-posting purchase order. Convert to purchase bill on receipt.',
            }}
        />
    );
}
