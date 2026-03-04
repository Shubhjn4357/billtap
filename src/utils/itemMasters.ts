const normalizeEntry = (value: string) => value.trim();

const uniqueEntries = (values: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of values) {
        const normalized = normalizeEntry(raw);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }

    return result;
};

const parseStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return uniqueEntries(value.map((entry) => String(entry)));
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                return uniqueEntries(parsed.map((entry) => String(entry)));
            }
        } catch {
            // Ignore parse errors and fallback to plain-text split.
        }

        return uniqueEntries(trimmed.split(/[\n,]/g).map((entry) => entry.trim()));
    }

    return [];
};

export const ITEM_SETTINGS_CUSTOM_CATEGORIES_KEY = 'custom_item_categories_json';
export const ITEM_SETTINGS_CUSTOM_UNITS_KEY = 'custom_item_units_json';

export const DEFAULT_ITEM_CATEGORIES = [
    'General',
    'Electronics',
    'Grocery',
    'Stationery',
    'Clothing',
    'Medical',
    'Services',
];

export const DEFAULT_ITEM_UNITS = [
    'pcs',
    'kg',
    'g',
    'L',
    'mL',
    'box',
    'm',
    'ft',
    'dozen',
    'pack',
];

export const getCustomItemCategories = (settings: Record<string, unknown>) =>
    parseStringArray(settings[ITEM_SETTINGS_CUSTOM_CATEGORIES_KEY]);

export const getCustomItemUnits = (settings: Record<string, unknown>) =>
    parseStringArray(settings[ITEM_SETTINGS_CUSTOM_UNITS_KEY]);

export const getItemCategoryOptions = (settings: Record<string, unknown>) =>
    uniqueEntries([...DEFAULT_ITEM_CATEGORIES, ...getCustomItemCategories(settings)]);

export const getItemUnitOptions = (settings: Record<string, unknown>) =>
    uniqueEntries([...DEFAULT_ITEM_UNITS, ...getCustomItemUnits(settings)]);

export const withCustomItemCategories = (
    settings: Record<string, unknown>,
    values: string[]
): Record<string, unknown> => ({
    ...settings,
    [ITEM_SETTINGS_CUSTOM_CATEGORIES_KEY]: JSON.stringify(uniqueEntries(values)),
});

export const withCustomItemUnits = (
    settings: Record<string, unknown>,
    values: string[]
): Record<string, unknown> => ({
    ...settings,
    [ITEM_SETTINGS_CUSTOM_UNITS_KEY]: JSON.stringify(uniqueEntries(values)),
});
