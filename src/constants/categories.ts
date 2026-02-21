/**
 * Pre-defined Item Category list
 * Use this for the CategorySelector — includes emoji icon, key, and label.
 * Users can also add custom categories via the CategoryManagerScreen.
 */

export interface CategoryOption {
    key: string;
    label: string;
    emoji: string;
}

export const PREDEFINED_CATEGORIES: CategoryOption[] = [
    { key: 'grocery', label: 'Grocery', emoji: '🛒' },
    { key: 'electronics', label: 'Electronics', emoji: '📱' },
    { key: 'clothing', label: 'Clothing & Apparel', emoji: '👗' },
    { key: 'medicines', label: 'Medicines & Healthcare', emoji: '💊' },
    { key: 'stationery', label: 'Stationery & Books', emoji: '📚' },
    { key: 'hardware', label: 'Hardware & Tools', emoji: '🔧' },
    { key: 'fmcg', label: 'FMCG', emoji: '🧴' },
    { key: 'food_beverage', label: 'Food & Beverages', emoji: '🍽️' },
    { key: 'agriculture', label: 'Agriculture', emoji: '🌾' },
    { key: 'raw_materials', label: 'Raw Materials', emoji: '🏗️' },
    { key: 'furniture', label: 'Furniture', emoji: '🪑' },
    { key: 'jewellery', label: 'Jewellery', emoji: '💍' },
    { key: 'services', label: 'Services', emoji: '🛎️' },
    { key: 'transport', label: 'Transport', emoji: '🚚' },
    { key: 'repair', label: 'Repair & Maintenance', emoji: '🔩' },
    { key: 'other', label: 'Other', emoji: '📦' },
];

export const CATEGORY_KEYS = PREDEFINED_CATEGORIES.map((c) => c.key);

export const DEFAULT_CATEGORY = PREDEFINED_CATEGORIES[PREDEFINED_CATEGORIES.length - 1];

export function getCategoryByKey(key: string): CategoryOption {
    return PREDEFINED_CATEGORIES.find((c) => c.key === key) ?? DEFAULT_CATEGORY;
}
