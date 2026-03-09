import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { getBillingDocumentConfig } from '../../../constants/billingDocumentOptions';
import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';

export default function InvoiceCreateScreen() {
    const { type } = useLocalSearchParams<{ type?: string }>();
    const config = useMemo(() => getBillingDocumentConfig(type), [type]);
    return <DocumentCreateScreen config={config} />;
}
