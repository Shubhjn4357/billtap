import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppScanCaptureScreen } from '../../components/scanner/AppScanCaptureScreen';

type ScanTarget = 'stock' | 'billing' | 'item_detail' | 'upi' | 'upi_profile';

const getSingleParam = (value?: string | string[]) => {
    return Array.isArray(value) ? value[0] : value;
};

export default function ScanScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ target?: string | string[]; returnPath?: string | string[]; scanField?: string | string[] }>();

    const handleScan = (data: string) => {
        const targetParam = getSingleParam(params.target) as ScanTarget | undefined;
        const returnPathParam = getSingleParam(params.returnPath);
        const scanAt = Date.now().toString();

        if (targetParam === 'item_detail') {
            const destination = returnPathParam || '/item/new';
            const scanFieldParam = getSingleParam(params.scanField) || 'barcode';
            router.replace({
                pathname: destination as never,
                params: { barcode: data, scanned: 'true', scanAt, scanField: scanFieldParam },
            });
            return;
        }

        if (targetParam === 'upi' || targetParam === 'upi_profile') {
            const destination = returnPathParam || '/profile';
            router.replace({
                pathname: destination as never,
                params: { upiPayload: data, scanAt },
            });
            return;
        }

        const destination = targetParam === 'billing' ? '/(main)/(tabs)/billing' : '/(main)/(tabs)/stock';
        router.replace({
            pathname: destination as never,
            params: { search: data, scanAt },
        });
    };

    return (
        <AppScanCaptureScreen
            title="Scan Barcode"
            subtitle="Align barcode or QR within the frame"
            onClose={() => router.back()}
            onScan={handleScan}
        />
    );
}
