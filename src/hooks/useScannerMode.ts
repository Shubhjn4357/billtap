import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../api/endpoints';

export type ScannerMode = 'USB_SCANNER' | 'PHONE_CAMERA';

export function useScannerMode() {
    const { data, isLoading } = useQuery({
        queryKey: ['settings-section', 'ITEM_SETTINGS'],
        queryFn: () => settingsApi.get('ITEM_SETTINGS'),
        staleTime: 60_000,
    });

    const settings = (data?.data ?? {}) as Record<string, unknown>;
    const barcodeEnabled = Boolean(settings.barcode_scanning_enabled ?? false);
    const scannerType: ScannerMode = settings.barcode_scanner_type === 'PHONE_CAMERA'
        ? 'PHONE_CAMERA'
        : 'USB_SCANNER';
    const canUseCameraScanner = barcodeEnabled && scannerType === 'PHONE_CAMERA';

    return {
        isLoading,
        barcodeEnabled,
        scannerType,
        canUseCameraScanner,
        isUsbScannerMode: barcodeEnabled && scannerType === 'USB_SCANNER',
    };
}
