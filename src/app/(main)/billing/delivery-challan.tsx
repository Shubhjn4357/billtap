import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function DeliveryChallanScreen() {
    return (
        <DocumentCreateScreen
            config={{
                title: 'Delivery Challan',
                invoiceType: 'DELIVERY_CHALLAN_DOC',
                transactionType: 'SALE',
                documentKind: 'DELIVERY_CHALLAN_DOC',
                billMode: 'ESTIMATE',
                helperText: 'Delivery challan flow before final tax invoice.',
            }}
        />
    );
}
