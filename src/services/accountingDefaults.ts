import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DrizzleClient } from '../db/client';
import { accounts } from '../db/schema';

export const DEFAULT_SYSTEM_ACCOUNTS = [
    { code: '1000', name: 'Cash in Hand', type: 'ASSET' as const },
    { code: '1010', name: 'Bank Accounts', type: 'ASSET' as const },
    { code: '1100', name: 'Sundry Debtors', type: 'ASSET' as const },
    { code: '1200', name: 'Stock-in-Hand', type: 'ASSET' as const },
    { code: '1300', name: 'Fixed Assets', type: 'ASSET' as const },
    { code: '1400', name: 'Deposits (Asset)', type: 'ASSET' as const },
    { code: '1500', name: 'Loans & Advances (Asset)', type: 'ASSET' as const },
    { code: '1600', name: 'Investments', type: 'ASSET' as const },
    { code: '2000', name: 'Sundry Creditors', type: 'LIABILITY' as const },
    { code: '2100', name: 'Duties & Taxes', type: 'LIABILITY' as const },
    { code: '2200', name: 'Provisions', type: 'LIABILITY' as const },
    { code: '2300', name: 'Secured Loans', type: 'LIABILITY' as const },
    { code: '2400', name: 'Unsecured Loans', type: 'LIABILITY' as const },
    { code: '2500', name: 'Bank OD A/c', type: 'LIABILITY' as const },
    { code: '3000', name: 'Capital Account', type: 'EQUITY' as const },
    { code: '3100', name: 'Reserves & Surplus', type: 'EQUITY' as const },
    { code: '3200', name: 'Drawings / Suspense', type: 'EQUITY' as const },
    { code: '4000', name: 'Sales Accounts', type: 'INCOME' as const },
    { code: '4100', name: 'Direct Incomes', type: 'INCOME' as const },
    { code: '4200', name: 'Indirect Incomes', type: 'INCOME' as const },
    { code: '5000', name: 'Purchase Accounts', type: 'EXPENSE' as const },
    { code: '5100', name: 'Direct Expenses', type: 'EXPENSE' as const },
    { code: '5200', name: 'Indirect Expenses', type: 'EXPENSE' as const },
] as const;

export const ensureDefaultAccounts = async (
    db: DrizzleClient,
    businessId: string
): Promise<void> => {
    const existingRows = await db
        .select({ code: accounts.code })
        .from(accounts)
        .where(eq(accounts.businessId, businessId));

    const existingCodes = new Set(existingRows.map((entry) => entry.code));
    const missing = DEFAULT_SYSTEM_ACCOUNTS.filter((entry) => !existingCodes.has(entry.code));
    if (missing.length === 0) return;

    const now = new Date();
    await db.insert(accounts).values(missing.map((entry) => ({
        id: `acc_${nanoid(16)}`,
        businessId,
        code: entry.code,
        name: entry.name,
        type: entry.type,
        parentAccountId: null,
        isDefault: true,
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    })));
};
