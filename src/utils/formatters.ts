
import { Config } from '../constants/Config';
import type { FirestoreDate } from '../types';

const CURRENCY_LOCALE_MAP: Record<string, string> = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AED: 'en-AE',
};

export const normalizeCurrencyCode = (currency?: string | null): string => {
    const candidate = currency?.trim().toUpperCase();
    const supported = Config.supportedCurrencies.some((entry) => entry.code === candidate);
    return supported && candidate ? candidate : Config.defaultCurrency;
};

export const formatCurrency = (amount: number, currency?: string): string => {
    const currencyCode = normalizeCurrencyCode(currency);
    const locale = CURRENCY_LOCALE_MAP[currencyCode] ?? CURRENCY_LOCALE_MAP[Config.defaultCurrency];

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
    }).format(amount);
};

export const formatDate = (date: FirestoreDate): string => {
    if (!date) return '';
    // Handle Firestore Timestamp or JS Date
    const d = typeof date === 'object' && date !== null && 'toDate' in date
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date);
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d);
};
