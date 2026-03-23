import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { getBillingDocumentConfig } from '../../../constants/billingDocumentOptions';
import { DocumentCreateScreen } from '../../../components/billing/DocumentCreateScreen';
import { FormSkeleton } from '../../../components/ui/FormSkeleton';
import { invoiceRepository } from '../../../repositories/invoiceRepository';
import { useInvoiceBuilderStore } from '../../../store/invoiceBuilderStore';
import { useAppColors } from '../../../hooks/useAppColors';
import { InvoiceType } from '../../../constants/enums';
import { toUserMessage } from '../../../api/client';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function InvoiceCreateScreen() {
    const { type, convertFrom } = useLocalSearchParams<{ type?: string; convertFrom?: string }>();
    const config = useMemo(() => getBillingDocumentConfig(type), [type]);
    const colors = useAppColors();
    const dialog = useAppDialog();
    const loadFromInvoice = useInvoiceBuilderStore((s) => s.loadFromInvoice);
    const [isConverting, setIsConverting] = useState(Boolean(convertFrom));

    useEffect(() => {
        if (!convertFrom) return;
        let active = true;
        invoiceRepository.get(convertFrom)
            .then((res) => {
                if (!active || !res.data) return;
                loadFromInvoice(res.data, (config.invoiceType as InvoiceType) ?? InvoiceType.TAX_INVOICE);
            })
            .catch((err) => {
                if (!active) return;
                dialog.alert('Conversion Failed', toUserMessage(err, 'Could not map previous document'));
            })
            .finally(() => {
                if (active) setIsConverting(false);
            });
        return () => { active = false; };
    }, [convertFrom, config.invoiceType, dialog, loadFromInvoice]);

    if (isConverting) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <FormSkeleton />
            </View>
        );
    }

    return <DocumentCreateScreen config={config} isConversion={Boolean(convertFrom)} />;
}
