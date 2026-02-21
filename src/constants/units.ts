/**
 * Pre-defined measurement Units list
 * Used by UnitSelector — includes abbreviation and full label.
 */

export interface UnitOption {
    key: string;
    label: string;
    abbr: string;
}

export const PREDEFINED_UNITS: UnitOption[] = [
    { key: 'pcs', label: 'Pieces', abbr: 'Pcs' },
    { key: 'kg', label: 'Kilogram', abbr: 'Kg' },
    { key: 'gram', label: 'Gram', abbr: 'g' },
    { key: 'litre', label: 'Litre', abbr: 'L' },
    { key: 'ml', label: 'Millilitre', abbr: 'ml' },
    { key: 'meter', label: 'Meter', abbr: 'm' },
    { key: 'cm', label: 'Centimeter', abbr: 'cm' },
    { key: 'inch', label: 'Inch', abbr: 'in' },
    { key: 'feet', label: 'Feet', abbr: 'ft' },
    { key: 'box', label: 'Box', abbr: 'Box' },
    { key: 'pair', label: 'Pair', abbr: 'Pr' },
    { key: 'dozen', label: 'Dozen', abbr: 'Dz' },
    { key: 'set', label: 'Set', abbr: 'Set' },
    { key: 'bag', label: 'Bag', abbr: 'Bag' },
    { key: 'bundle', label: 'Bundle', abbr: 'Bndl' },
    { key: 'bottle', label: 'Bottle', abbr: 'Btl' },
    { key: 'can', label: 'Can', abbr: 'Can' },
    { key: 'sheet', label: 'Sheet', abbr: 'Sht' },
    { key: 'roll', label: 'Roll', abbr: 'Rol' },
    { key: 'unit', label: 'Unit', abbr: 'Unit' },
    { key: 'sqft', label: 'Square Feet', abbr: 'sqft' },
    { key: 'sqm', label: 'Square Meter', abbr: 'sqm' },
    { key: 'quintal', label: 'Quintal', abbr: 'Qtl' },
    { key: 'tonne', label: 'Tonne', abbr: 'T' },
];

export const DEFAULT_UNIT: UnitOption = PREDEFINED_UNITS[0]; // Pcs

export function getUnitByKey(key: string): UnitOption {
    return PREDEFINED_UNITS.find((u) => u.key === key) ?? DEFAULT_UNIT;
}

export function getUnitLabel(key: string): string {
    return getUnitByKey(key).abbr;
}
