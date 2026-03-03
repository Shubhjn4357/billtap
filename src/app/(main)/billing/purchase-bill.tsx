import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function PurchaseBillScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Purchase Bill',
                invoiceType: 'TAX_INVOICE',
                transactionType: 'PURCHASE',
                documentKind: 'PURCHASE_BILL',
                partyPlaceholder: '+ Select Supplier (optional)',
                helperText: 'Purchase voucher with stock inward and payable booking.',
            }}
        />
    );
}
