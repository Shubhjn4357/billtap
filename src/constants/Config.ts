import { BRAND } from './staticText';
import { API_CONFIG } from './Api';

export const Config = {
    appName: BRAND.productName,
    defaultCurrency: 'INR',
    features: {
        imageUploadsEnabled: false,
    },
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
    apiUrl: API_CONFIG.baseUrl,
};
