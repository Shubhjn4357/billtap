import { describe, expect, it } from 'vitest';
import type { FirestoreDate } from '../types';
import { formatCurrency, formatDate, normalizeCurrencyCode } from './formatters';

describe('formatters', () => {
    it('formats INR currency consistently', () => {
        const value = formatCurrency(1234.5, 'INR');
        expect(value).toMatch(/1,234\.50/);
    });

    it('falls back to default currency for unsupported codes', () => {
        expect(normalizeCurrencyCode('XYZ')).toBe('INR');
    });

    it('formats Date values', () => {
        const value = formatDate(new Date(2026, 1, 13, 12, 0, 0));
        expect(value).toContain('2026');
    });

    it('formats Firestore-like timestamps', () => {
        const timestampLike = {
            toDate: () => new Date(2026, 1, 14, 12, 0, 0),
        } as unknown as FirestoreDate;
        const value = formatDate(timestampLike);
        expect(value).toContain('2026');
    });
});
