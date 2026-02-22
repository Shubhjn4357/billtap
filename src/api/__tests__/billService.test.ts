/**
 * @file billService.test.ts
 * @description Strict unit tests for billService — covers CREATE, READ, RANGE queries,
 * online/offline paths, paymentStatus derivation, and queue enqueuing.
 *
 * NOTE: vi.mock is hoisted to the top of the file by Vitest. To reference local variables
 * inside vi.mock factories they must be declared via vi.hoisted() which also runs at hoist time.
 */
import { billService } from '../billService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bill } from '../../types';

// ─── Hoisted mock references (run before vi.mock hoisting) ─────────────────────
const mocks = vi.hoisted(() => ({
    isOnline: vi.fn().mockResolvedValue(true),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
    flushQueue: vi.fn().mockResolvedValue(undefined),
    getCachedBills: vi.fn().mockResolvedValue([]),
    setCachedBills: vi.fn().mockResolvedValue(undefined),
    upsertCachedBill: vi.fn().mockResolvedValue(undefined),
    enqueueMutation: vi.fn().mockResolvedValue(undefined),
    applyLocalBillStock: vi.fn().mockResolvedValue(undefined),
    createLocalId: vi.fn((prefix: string) => `${prefix}_local_001`),
}));

// ─── Mock modules ───────────────────────────────────────────────────────────────
vi.mock('../../utils/network', () => ({ isOnline: mocks.isOnline }));

vi.mock('../httpClient', () => ({
    apiClient: {
        get: mocks.apiGet,
        post: mocks.apiPost,
        patch: mocks.apiPatch,
        delete: mocks.apiDelete,
    },
    ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
        }
    },
}));

vi.mock('../syncService', () => ({
    offlineSyncService: {
        flushQueue: mocks.flushQueue,
        getCachedBills: mocks.getCachedBills,
        setCachedBills: mocks.setCachedBills,
        upsertCachedBill: mocks.upsertCachedBill,
        enqueueMutation: mocks.enqueueMutation,
        applyLocalBillStock: mocks.applyLocalBillStock,
        createLocalId: mocks.createLocalId,
    },
}));

// ─── Test Data Factories ────────────────────────────────────────────────────────

const makeBill = (overrides: Partial<Omit<Bill, 'id' | 'createdAt'>> = {}): Omit<Bill, 'id' | 'createdAt'> => ({
    userId: 'user_abc',
    businessName: 'Test Store',
    businessAddress: '123 Main St',
    gstNumber: 'GST123',
    currency: 'INR',
    customerName: 'Alice',
    customerPhone: '9999999999',
    items: [
        { id: 'item_1', name: 'Pen', price: 10, quantity: 3, tax: 0, total: 30 },
        { id: 'item_2', name: 'Notebook', price: 50, quantity: 1, tax: 0, total: 50 },
    ],
    total: 80,
    paymentMode: 'CASH',
    billMode: 'GST',
    type: 'SALE',
    ...overrides,
});

const makeServerTransaction = (overrides: Record<string, unknown> = {}) => ({
    id: 'tx_server_001',
    userId: 'user_abc',
    billNumber: 'BILL-001',
    partyName: 'Alice',
    partyPhone: '9999999999',
    currency: 'INR',
    items: [{ id: 'item_1', name: 'Pen', quantity: 3, price: 10, tax: 0, total: 30 }],
    totalAmount: '30',
    billDate: new Date('2026-01-15').toISOString(),
    createdAt: new Date('2026-01-15').toISOString(),
    ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('billService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isOnline.mockResolvedValue(true);
        mocks.getCachedBills.mockResolvedValue([]);
    });

    // ── CREATE BILL — ONLINE ────────────────────────────────────────────────────

    describe('createBill — online', () => {
        it('returns the server-issued bill ID on success', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_server_001' });
            const id = await billService.createBill(makeBill());
            expect(id).toBe('tx_server_001');
        });

        it('calls POST /transactions with correct payload shape', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_002' });
            await billService.createBill(makeBill({ customerName: 'Bob', total: 100 }));

            const [url, body] = mocks.apiPost.mock.calls[0] as [string, Record<string, unknown>];
            expect(url).toBe('/transactions');
            expect(body.partyName).toBe('Bob');
            expect(body.totalAmount).toBe(100);
            expect(body.type).toBe('SALE');
        });

        it('upserts the bill to local cache after server success', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_003' });
            await billService.createBill(makeBill());

            expect(mocks.upsertCachedBill).toHaveBeenCalled();
            const stored = mocks.upsertCachedBill.mock.calls[mocks.upsertCachedBill.mock.calls.length - 1][0];
            expect(stored.id).toBe('tx_003');
            expect(stored.paymentStatus).toBe('PAID'); // CASH = full payment
        });

        it('derives PAID paymentStatus when paymentMode is CASH', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_cash' });
            await billService.createBill(makeBill({ paymentMode: 'CASH', total: 100 }));

            const stored = mocks.upsertCachedBill.mock.calls[0][0];
            expect(stored.paymentStatus).toBe('PAID');
            expect(stored.paidAmount).toBe(100);
            expect(stored.dueAmount).toBe(0);
        });

        it('derives PENDING paymentStatus when paymentMode is CREDIT', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_credit' });
            await billService.createBill(makeBill({ paymentMode: 'CREDIT', total: 500 }));

            const stored = mocks.upsertCachedBill.mock.calls[0][0];
            expect(stored.paymentStatus).toBe('PENDING');
            expect(stored.paidAmount).toBe(0);
            expect(stored.dueAmount).toBe(500);
        });

        it('flushes offline queue before making server call', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_flush' });
            await billService.createBill(makeBill());
            expect(mocks.flushQueue).toHaveBeenCalled();
        });

        it('falls back to offline queue when API throws', async () => {
            mocks.apiPost.mockRejectedValueOnce(new Error('Internal server error'));
            mocks.isOnline.mockResolvedValue(true);

            const id = await billService.createBill(makeBill());
            expect(id).toBe('bill_local_001');
            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
        });

        it('calculates nested tax amount correctly', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_tax' });
            const bill = makeBill({
                items: [{ id: 'i1', name: 'Widget', price: 100, quantity: 2, tax: 18, total: 236 }],
                total: 236,
            });

            await billService.createBill(bill);

            const [, body] = mocks.apiPost.mock.calls[0] as [string, Record<string, unknown>];
            // taxAmount = (100 * 2 * 18) / 100 = 36
            expect(body.taxAmount).toBe(36);
        });
    });

    // ── CREATE BILL — OFFLINE ───────────────────────────────────────────────────

    describe('createBill — offline', () => {
        beforeEach(() => {
            mocks.isOnline.mockResolvedValue(false);
        });

        it('returns a local ID when offline', async () => {
            const id = await billService.createBill(makeBill());
            expect(id).toBe('bill_local_001');
        });

        it('does NOT call the API when offline', async () => {
            await billService.createBill(makeBill());
            expect(mocks.apiPost).not.toHaveBeenCalled();
        });

        it('enqueues a create_bill mutation', async () => {
            await billService.createBill(makeBill());
            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
            const mutation = mocks.enqueueMutation.mock.calls[0][0];
            expect(mutation.type).toBe('create_bill');
        });

        it('stores bill locally with correct PENDING status for CREDIT', async () => {
            await billService.createBill(makeBill({ paymentMode: 'CREDIT', total: 200 }));
            expect(mocks.upsertCachedBill).toHaveBeenCalledOnce();
            const stored = mocks.upsertCachedBill.mock.calls[0][0];
            expect(stored.paymentStatus).toBe('PENDING');
            expect(stored.paidAmount).toBe(0);
        });

        it('applies local stock changes when offline', async () => {
            await billService.createBill(makeBill());
            expect(mocks.applyLocalBillStock).toHaveBeenCalledOnce();
        });
    });

    // ── GET USER BILLS ──────────────────────────────────────────────────────────

    describe('getUserBills — online', () => {
        it('fetches from API and maps server transactions to StoredBill', async () => {
            mocks.apiGet.mockResolvedValueOnce({
                ok: true,
                transactions: [makeServerTransaction()],
            });

            const bills = await billService.getUserBills('user_abc');
            expect(bills).toHaveLength(1);
            expect(bills[0].id).toBe('tx_server_001');
            expect(bills[0].customerName).toBe('Alice');
        });

        it('caches the fetched bills locally', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, transactions: [makeServerTransaction()] });
            await billService.getUserBills('user_abc');
            expect(mocks.setCachedBills).toHaveBeenCalledOnce();
        });

        it('maps totalAmount string → total number', async () => {
            mocks.apiGet.mockResolvedValueOnce({
                ok: true,
                transactions: [makeServerTransaction({ totalAmount: '1500' })],
            });
            const bills = await billService.getUserBills('user_abc');
            expect(bills[0].total).toBe(1500);
        });

        it('maps partyName → customerName on StoredBill', async () => {
            mocks.apiGet.mockResolvedValueOnce({
                ok: true,
                transactions: [makeServerTransaction({ partyName: 'Charlie' })],
            });
            const bills = await billService.getUserBills('user_abc');
            expect(bills[0].customerName).toBe('Charlie');
        });
    });

    describe('getUserBills — offline fallback', () => {
        it('returns cached bills when offline', async () => {
            mocks.isOnline.mockResolvedValue(false);
            const cached = [{ id: 'cached_bill_1', total: 100, createdAt: new Date().toISOString() }];
            mocks.getCachedBills.mockResolvedValueOnce(cached);

            const bills = await billService.getUserBills('user_abc');
            expect(bills).toEqual(cached);
            expect(mocks.apiGet).not.toHaveBeenCalled();
        });

        it('falls back to cache when API throws', async () => {
            mocks.apiGet.mockRejectedValueOnce(new Error('Network error'));
            const cached = [{ id: 'cached_bill_2', total: 200, createdAt: new Date().toISOString() }];
            mocks.getCachedBills.mockResolvedValueOnce(cached);

            const bills = await billService.getUserBills('user_abc');
            expect(bills).toEqual(cached);
        });
    });

    // ── GET BILLS IN RANGE ──────────────────────────────────────────────────────

    describe('getUserBillsInRange', () => {
        const jan1 = new Date('2026-01-01T00:00:00Z');
        const jan31 = new Date('2026-01-31T23:59:59Z');

        it('returns only bills within the date range', async () => {
            mocks.apiGet.mockResolvedValue({
                ok: true,
                transactions: [
                    makeServerTransaction({ billDate: '2026-01-10T00:00:00Z', createdAt: '2026-01-10T00:00:00Z', id: 'in_range' }),
                    makeServerTransaction({ billDate: '2026-02-20T00:00:00Z', createdAt: '2026-02-20T00:00:00Z', id: 'out_of_range' }),
                ],
            });

            const bills = await billService.getUserBillsInRange('user_abc', jan1, jan31);
            expect(bills.map((b) => b.id)).toContain('in_range');
            expect(bills.map((b) => b.id)).not.toContain('out_of_range');
        });

        it('returns all bills after start when no end date is given', async () => {
            mocks.apiGet.mockResolvedValue({
                ok: true,
                transactions: [
                    makeServerTransaction({ billDate: '2026-01-10T00:00:00Z', createdAt: '2026-01-10T00:00:00Z', id: 'bill_jan' }),
                    makeServerTransaction({ billDate: '2026-02-15T00:00:00Z', createdAt: '2026-02-15T00:00:00Z', id: 'bill_feb' }),
                ],
            });

            const bills = await billService.getUserBillsInRange('user_abc', jan1);
            expect(bills).toHaveLength(2);
        });

        it('returns empty array when no bills in range', async () => {
            mocks.apiGet.mockResolvedValue({
                ok: true,
                transactions: [makeServerTransaction({ billDate: '2026-02-15T00:00:00Z', createdAt: '2026-02-15T00:00:00Z', id: 'far' })],
            });

            const bills = await billService.getUserBillsInRange('user_abc', jan1, jan31);
            expect(bills).toHaveLength(0);
        });

        it('includes bills on exactly the start date (inclusive)', async () => {
            mocks.apiGet.mockResolvedValue({
                ok: true,
                transactions: [makeServerTransaction({ billDate: jan1.toISOString(), id: 'on_start' })],
            });

            const bills = await billService.getUserBillsInRange('user_abc', jan1, jan31);
            expect(bills.map((b) => b.id)).toContain('on_start');
        });
    });

    // ── createBillWithStockValidation ───────────────────────────────────────────

    describe('createBillWithStockValidation', () => {
        it('delegates to createBill', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'tx_stock' });
            const spy = vi.spyOn(billService, 'createBill');

            await billService.createBillWithStockValidation(makeBill());
            expect(spy).toHaveBeenCalledOnce();
        });
    });
});
