import { SettingsSection } from '../constants/enums';
import { useSettingsSelector } from './useSettingsSelector';
import { selectItemSettings, type ScannerMode } from '../selectors/settingsSelectors';

export function useScannerMode() {
    const { selected, isLoading } = useSettingsSelector(SettingsSection.ITEM_SETTINGS, selectItemSettings);

    return {
        isLoading,
        barcodeEnabled: selected.barcodeEnabled,
        scannerType: selected.scannerType as ScannerMode,
        canUseCameraScanner: selected.canUseCameraScanner,
        isUsbScannerMode: selected.isUsbScannerMode,
    };
}
