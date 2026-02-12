
import { Config } from '../constants/Config';

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: Config.defaultCurrency,
        minimumFractionDigits: 2,
    }).format(amount);
};

export const formatDate = (date: any): string => {
    if (!date) return '';
    // Handle Firestore Timestamp or JS Date
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d);
};
