import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function EstimateScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Estimate / Quotation',
                invoiceType: 'ESTIMATE',
                transactionType: 'SALE',
                documentKind: 'ESTIMATE',
                billMode: 'ESTIMATE',
                helperText: 'Non-posting estimate. Convert to invoice when accepted.',
            }}
        />
    );
}
