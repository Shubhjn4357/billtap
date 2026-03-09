import type { PrinterConnection, StandardLayout, ThermalPreset } from '../selectors/settingsSelectors';

export type PrintTab = 'thermal' | 'standard';
export type PrintLayoutType = 'THERMAL' | 'REGULAR';

export const PRINT_TAB_OPTIONS: { key: PrintTab; label: string; icon: string }[] = [
    { key: 'thermal', label: 'Thermal / POS', icon: 'printer-pos-outline' },
    { key: 'standard', label: 'Standard / PDF', icon: 'file-pdf-box' },
];

export const PRINT_LAYOUT_TYPE_OPTIONS: { key: PrintLayoutType; label: string }[] = [
    { key: 'THERMAL', label: 'THERMAL' },
    { key: 'REGULAR', label: 'REGULAR' },
];

export const THERMAL_PRESET_OPTIONS: { key: ThermalPreset; label: string; desc: string }[] = [
    { key: '58MM_COMPACT', label: '58mm Compact', desc: 'Small POS printer, 24 chars/line' },
    { key: '80MM_STANDARD', label: '80mm Standard', desc: 'Full POS counter, 34 chars/line - Recommended' },
    { key: 'A4_CLASSIC', label: 'A4 (Thermal)', desc: 'Wide format, 44 chars/line' },
];

export const PRINTER_CONNECTION_OPTIONS: { key: PrinterConnection; icon: string; label: string }[] = [
    { key: 'USB', icon: 'usb', label: 'USB' },
    { key: 'BLUETOOTH', icon: 'bluetooth', label: 'Bluetooth' },
    { key: 'WIFI', icon: 'wifi', label: 'Wi-Fi' },
];

export const STANDARD_LAYOUT_OPTIONS: { key: StandardLayout; label: string; desc: string }[] = [
    { key: 'MODERN', label: 'Modern', desc: 'Clean header, colored accents, logo top-right' },
    { key: 'CLASSIC', label: 'Classic', desc: 'Traditional business layout, black & white' },
    { key: 'MINIMAL', label: 'Minimal', desc: 'Compact spacing for e-invoicing portals' },
];
