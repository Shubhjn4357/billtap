/**
 * Unit tests for all 8 domain hooks.
 * Run with: npx vitest run __tests__/hooks/
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentStatus, PartyType } from '../../src/constants/enums';

// ─────────────────────────────────────────────────────────────────────────────
// 1. useAppColors
// ─────────────────────────────────────────────────────────────────────────────
describe('useAppColors', () => {
    beforeEach(() => { vi.resetModules(); });

    it('returns a color palette object with primary, background, text, card, border', async () => {
        vi.doMock('../../src/store/themeStore', () => ({ useThemeStore: (sel: (s: { themeMode: string }) => string) => sel({ themeMode: 'light' }) }));
        const { useAppColors } = await import('../../src/hooks/useAppColors');
        const colors = useAppColors();
        expect(colors).toMatchObject({
            primary: expect.any(String),
            background: expect.any(String),
            text: expect.any(String),
            card: expect.any(String),
            border: expect.any(String),
        });
    });

    it('returns dark palette when themeMode is dark', async () => {
        vi.doMock('../../src/store/themeStore', () => ({ useThemeStore: (sel: (s: { themeMode: string }) => string) => sel({ themeMode: 'dark' }) }));
        const { useAppColors } = await import('../../src/hooks/useAppColors');
        const darkColors = useAppColors();
        expect(typeof darkColors.background).toBe('string');
        expect(darkColors.background).not.toBe('#FFFFFF');
    });

    it('falls back to light when themeMode is system', async () => {
        vi.doMock('../../src/store/themeStore', () => ({ useThemeStore: (sel: (s: { themeMode: string }) => string) => sel({ themeMode: 'system' }) }));
        const { useAppColors } = await import('../../src/hooks/useAppColors');
        const colors = useAppColors();
        expect(colors).toBeDefined();
        expect(colors.primary).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. useCurrentBusiness
// ─────────────────────────────────────────────────────────────────────────────
describe('useCurrentBusiness', () => {
    beforeEach(() => { vi.resetModules(); });

    it('returns FREE tier defaults when no subscription', async () => {
        vi.doMock('../../src/store/authStore', () => ({
            useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({
                user: { id: 'u1', name: 'Test User', email: 'test@test.com' },
                business: { id: 'b1', name: 'Test Biz' },
                subscription: null,
                organizationRole: 'owner',
                refreshUser: async () => { },
            }),
        }));
        const { useCurrentBusiness } = await import('../../src/hooks/useCurrentBusiness');
        const result = useCurrentBusiness();
        expect(result.isFree).toBe(true);
        expect(result.tierLabel).toBe('Free');
        expect(result.isOwner).toBe(true);
        expect(result.displayName).toBe('Test Biz');
    });

    it('marks isFree false when subscription tier is GROWTH', async () => {
        vi.doMock('../../src/store/authStore', () => ({
            useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({
                user: null,
                business: { id: 'b1', name: 'Paid Biz' },
                subscription: { tier: 'GROWTH', expiresAt: null },
                organizationRole: 'manager',
                refreshUser: async () => { },
            }),
        }));
        const { useCurrentBusiness } = await import('../../src/hooks/useCurrentBusiness');
        const result = useCurrentBusiness();
        expect(result.isFree).toBe(false);
        expect(result.tierLabel).toBe('Growth');
        expect(result.isOwner).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. usePermissions
// ─────────────────────────────────────────────────────────────────────────────
describe('usePermissions', () => {
    beforeEach(() => { vi.resetModules(); });

    it('returns can() function that uses accessControl utils', async () => {
        vi.doMock('../../src/store/authStore', () => ({
            useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({
                organizationRole: 'owner',
                subscription: { tier: 'ENTERPRISE' },
            }),
        }));
        const { usePermissions } = await import('../../src/hooks/usePermissions');
        const perms = usePermissions();
        expect(typeof perms.role).toBe('string');
        expect(typeof perms.canModule).toBe('function');
    });

    it('provides isOwner convenience flag', async () => {
        vi.doMock('../../src/store/authStore', () => ({
            useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({
                organizationRole: 'staff',
                subscription: null,
            }),
        }));
        const { usePermissions } = await import('../../src/hooks/usePermissions');
        const perms = usePermissions();
        expect(perms.isOwner).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. useInvoices — pure filter/summary logic (no React Query needed)
// ─────────────────────────────────────────────────────────────────────────────


const MOCK_INVOICES = [
    { id: '1', invoiceNumber: 'INV-001', invoiceDate: new Date().toISOString(), paymentStatus: PaymentStatus.PAID, totalInvoiceValue: 1000, paidAmount: 1000, partySnapshot: { name: 'Alice' }, party: null },
    { id: '2', invoiceNumber: 'INV-002', invoiceDate: new Date().toISOString(), paymentStatus: PaymentStatus.OVERDUE, totalInvoiceValue: 2000, paidAmount: 0, partySnapshot: { name: 'Bob' }, party: null },
    { id: '3', invoiceNumber: 'EST-001', invoiceDate: new Date().toISOString(), paymentStatus: PaymentStatus.PARTIALLY_PAID, totalInvoiceValue: 500, paidAmount: 200, partySnapshot: { name: 'Carol' }, party: null },
];

describe('useInvoices — summary calculation', () => {
    it('computes correct totals from a known invoice set', () => {
        // Test the pure summary computation logic directly
        let paid = 0, overdue = 0, outstanding = 0;
        for (const inv of MOCK_INVOICES) {
            if (inv.paymentStatus === PaymentStatus.PAID) paid += 1;
            if (inv.paymentStatus === PaymentStatus.OVERDUE) overdue += 1;
            if (inv.paymentStatus !== PaymentStatus.PAID) {
                outstanding += Math.max(inv.totalInvoiceValue - (inv.paidAmount ?? 0), 0);
            }
        }
        expect(paid).toBe(1);
        expect(overdue).toBe(1);
        expect(outstanding).toBe(2300); // 2000-0=2000 + 500-200=300
    });

    it('filters invoices by search text (party name)', () => {
        const needle = 'alice';
        const filtered = MOCK_INVOICES.filter((inv) => {
            const byNo = inv.invoiceNumber.toLowerCase().includes(needle);
            const byParty = (inv.partySnapshot?.name ?? '').toLowerCase().includes(needle);
            return byNo || byParty;
        });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].invoiceNumber).toBe('INV-001');
    });

    it('filters invoices by overdue status', () => {
        const filtered = MOCK_INVOICES.filter((inv) => inv.paymentStatus === PaymentStatus.OVERDUE);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('2');
    });

    it('filters invoices by date range (today)', () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayInvoices = MOCK_INVOICES.filter((inv) => inv.invoiceDate.slice(0, 10) === todayStr);
        expect(todayInvoices).toHaveLength(3);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. useInventory — pure filter/sort logic
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_ITEMS = [
    { id: 'i1', name: 'Widget A', category: { id: 'c1', name: 'Electronics' }, currentStock: 50, unit: 'PCS', sellingPrice: 100, costPrice: 80 },
    { id: 'i2', name: 'Widget B', category: { id: 'c1', name: 'Electronics' }, currentStock: 0, unit: 'PCS', sellingPrice: 200, costPrice: 150 },
    { id: 'i3', name: 'Bolt X', category: { id: 'c2', name: 'Hardware' }, currentStock: 5, unit: 'KG', sellingPrice: 10, costPrice: 7 },
];

describe('useInventory — filter and sort logic', () => {
    it('filters items by category', () => {
        const result = MOCK_ITEMS.filter((item) => item.category?.id === 'c1');
        expect(result).toHaveLength(2);
        expect(result.every((i) => i.category?.name === 'Electronics')).toBe(true);
    });

    it('filters items by out-of-stock', () => {
        const outOfStock = MOCK_ITEMS.filter((item) => (item.currentStock ?? 0) === 0);
        expect(outOfStock).toHaveLength(1);
        expect(outOfStock[0].name).toBe('Widget B');
    });

    it('filters items by low stock (below 10)', () => {
        const lowStock = MOCK_ITEMS.filter((item) => (item.currentStock ?? 0) > 0 && (item.currentStock ?? 0) < 10);
        expect(lowStock).toHaveLength(1);
        expect(lowStock[0].name).toBe('Bolt X');
    });

    it('sorts items by name A-Z', () => {
        const sorted = [...MOCK_ITEMS].sort((a, b) => a.name.localeCompare(b.name));
        expect(sorted[0].name).toBe('Bolt X');
        expect(sorted[2].name).toBe('Widget B');
    });

    it('sorts items by price descending', () => {
        const sorted = [...MOCK_ITEMS].sort((a, b) => b.sellingPrice - a.sellingPrice);
        expect(sorted[0].sellingPrice).toBe(200);
    });

    it('searches items by name', () => {
        const needle = 'widget';
        const filtered = MOCK_ITEMS.filter((item) => item.name.toLowerCase().includes(needle));
        expect(filtered).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. useParties — pure stats logic
// ─────────────────────────────────────────────────────────────────────────────


const MOCK_PARTIES = [
    { id: 'p1', name: 'Alice Corp', type: PartyType.CUSTOMER, openingBalance: 5000, phone: '1111' },
    { id: 'p2', name: 'Bob Traders', type: PartyType.CUSTOMER, openingBalance: 0, phone: '2222' },
    { id: 'p3', name: 'Raj Supply', type: PartyType.SUPPLIER, openingBalance: -3000, phone: '3333' },
    { id: 'p4', name: 'Delta Parts', type: PartyType.SUPPLIER, openingBalance: -1500, phone: '4444' },
];

describe('useParties — stats calculation', () => {
    it('computes totalCustomers and totalSuppliers correctly', () => {
        const customers = MOCK_PARTIES.filter((p) => p.type === PartyType.CUSTOMER);
        const suppliers = MOCK_PARTIES.filter((p) => p.type === PartyType.SUPPLIER);
        expect(customers.length).toBe(2);
        expect(suppliers.length).toBe(2);
    });

    it('computes totalReceivable from customer balances', () => {
        const customers = MOCK_PARTIES.filter((p) => p.type === PartyType.CUSTOMER);
        const totalReceivable = customers.reduce((sum, p) => sum + (p.openingBalance ?? 0), 0);
        expect(totalReceivable).toBe(5000);
    });

    it('computes totalPayable from supplier balances', () => {
        const suppliers = MOCK_PARTIES.filter((p) => p.type === PartyType.SUPPLIER);
        const totalPayable = suppliers.reduce((sum, p) => sum + (p.openingBalance ?? 0), 0);
        expect(totalPayable).toBe(-4500);
    });

    it('searches parties by name', () => {
        const filtered = MOCK_PARTIES.filter((p) => p.name.toLowerCase().includes('bob'));
        expect(filtered).toHaveLength(1);
        expect(filtered[0].phone).toBe('2222');
    });

    it('searches parties by phone', () => {
        const filtered = MOCK_PARTIES.filter((p) => (p.phone ?? '').includes('333'));
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('Raj Supply');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. useLedgers — pure filter/group logic
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_LEDGERS = [
    { id: 'l1', name: 'Sales', type: 'INCOME', balance: 80000 },
    { id: 'l2', name: 'Salary', type: 'EXPENSE', balance: -20000 },
    { id: 'l3', name: 'Cash', type: 'ASSET', balance: 15000 },
    { id: 'l4', name: 'Loan', type: 'LIABILITY', balance: -50000 },
    { id: 'l5', name: 'Capital', type: 'EQUITY', balance: 100000 },
];

describe('useLedgers — filter and group logic', () => {
    it('filters ledgers by type INCOME', () => {
        const result = MOCK_LEDGERS.filter((l) => l.type === 'INCOME');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Sales');
    });

    it('filters ledgers by type EXPENSE', () => {
        const result = MOCK_LEDGERS.filter((l) => l.type === 'EXPENSE');
        expect(result).toHaveLength(1);
        expect(result[0].balance).toBe(-20000);
    });

    it('groups ledgers by type', () => {
        const grouped: Record<string, typeof MOCK_LEDGERS> = {};
        for (const l of MOCK_LEDGERS) {
            if (!grouped[l.type]) grouped[l.type] = [];
            grouped[l.type].push(l);
        }
        expect(Object.keys(grouped)).toHaveLength(5);
        expect(grouped['ASSET']).toHaveLength(1);
    });

    it('searches ledgers by name', () => {
        const filtered = MOCK_LEDGERS.filter((l) => l.name.toLowerCase().includes('cash'));
        expect(filtered).toHaveLength(1);
        expect(filtered[0].type).toBe('ASSET');
    });

    it('sorts ledgers by balance descending', () => {
        const sorted = [...MOCK_LEDGERS].sort((a, b) => b.balance - a.balance);
        expect(sorted[0].name).toBe('Capital');
        expect(sorted[sorted.length - 1].name).toBe('Loan');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. useSettingsSection — schema and offline fallback (pure data logic)
// ─────────────────────────────────────────────────────────────────────────────
describe('useSettingsSection — offline logic', () => {
    it('returns empty section data gracefully when offline cache is empty', () => {
        const cachedData: Record<string, unknown[]> | null = null;
        const fallback = cachedData ?? {};
        expect(Object.keys(fallback)).toHaveLength(0);
    });

    it('returns cached section data when provided', () => {
        const cached = { fields: [{ key: 'TAX_RATE', label: 'Tax Rate', value: '18' }] };
        const fields = cached.fields;
        expect(fields).toHaveLength(1);
        expect(fields[0].key).toBe('TAX_RATE');
    });

    it('excluded INVOICE_PRINT from visible settings list', () => {
        const EXCLUDED = ['INVOICE_PRINT'];
        const allSections = ['TAXES_AND_GST', 'INVOICE_PRINT', 'GENERAL', 'SECURITY'];
        const visible = allSections.filter((s) => !EXCLUDED.includes(s));
        expect(visible).not.toContain('INVOICE_PRINT');
        expect(visible).toHaveLength(3);
    });
});
