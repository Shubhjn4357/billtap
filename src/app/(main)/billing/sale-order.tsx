import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function SaleOrderScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Sale Order',
                invoiceType: 'ESTIMATE',
                transactionType: 'SALE',
                documentKind: 'SALE_ORDER',
                billMode: 'ESTIMATE',
                helperText: 'Non-posting sale order. Convert to invoice when fulfilled.',
            }}
        />
    );
}
