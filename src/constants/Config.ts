import { BRAND } from './staticText';

export const Config = {
    appName: BRAND.productName,
    defaultCurrency: 'INR',
    supportedCurrencies: [
        { code: 'INR', label: 'Indian Rupee' },
        { code: 'USD', label: 'US Dollar' },
        { code: 'EUR', label: 'Euro' },
        { code: 'GBP', label: 'British Pound' },
        { code: 'AED', label: 'UAE Dirham' },
    ],
    gstRates: [0, 5, 12, 18, 28],
    units: ['pcs', 'kg', 'ltr', 'box', 'mts'],
    companyName: `${BRAND.companyName} Merchant`,
    companyAddress: 'Set your business address in Profile',
    apiUrl: (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, ''),
};
