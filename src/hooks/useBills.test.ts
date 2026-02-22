import { mapTransactionToBill } from './mapTransactionToBill';
import type { DbTransaction } from '../types/db';
import { describe, expect, it, vi } from 'vitest';

// mock expo-sqlite before any other imports that transitively rely on it
vi.mock('expo-sqlite', () => {
    return {
        openDatabaseSync: (_name: string) => ({
            transaction: (fn: Function) => { try { fn({ executeSql: () => { } }); } catch { } },
            exec: () => { },
            prepareStatement: () => ({ execute: () => { } }),
        } as any),
        SQLTransactionCallback: Function,
        SQLResultSetCallback: Function,
    };
});


describe('mapTransactionToBill helper', () => {
    it('returns an empty items array when itemsSnapshot is undefined', () => {
        const tx = {
            id: '1',
            organizationId: 'org',
            totalAmount: 100,
            type: 'SALE',
            billMode: 'GST',
            paymentStatus: 'PENDING',
            paymentMode: 'CASH',
            billDate: new Date().toISOString(),
            itemsSnapshot: undefined as any,
        } as unknown as DbTransaction;

        const bill = mapTransactionToBill(tx);
        expect(bill.items).toEqual([]);
    });

    it('swallows invalid JSON in itemsSnapshot and returns []', () => {
        const tx = {
            id: '2',
            organizationId: 'org',
            totalAmount: 200,
            type: 'SALE',
            billMode: 'GST',
            paymentStatus: 'PENDING',
            paymentMode: 'CASH',
            billDate: new Date().toISOString(),
            itemsSnapshot: 'not a json',
        } as unknown as DbTransaction;

        const bill = mapTransactionToBill(tx);
        expect(bill.items).toEqual([]);
    });
});
