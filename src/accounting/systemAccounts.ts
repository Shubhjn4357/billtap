import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { accounts } from '../db/schema';

export const SYSTEM_ACCOUNT_DEFINITIONS = [
    { code: '1000', name: 'Cash', type: 'ASSET' },
    { code: '1100', name: 'Bank', type: 'ASSET' },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '1300', name: 'Inventory', type: 'ASSET' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '2200', name: 'Salary Payable', type: 'LIABILITY' },
    { code: '2100', name: 'GST Payable', type: 'LIABILITY' },
    { code: '3000', name: 'Owner Equity', type: 'EQUITY' },
    { code: '4000', name: 'Sales', type: 'INCOME' },
    { code: '5000', name: 'COGS', type: 'EXPENSE' },
    { code: '5100', name: 'Purchase', type: 'EXPENSE' },
    { code: '5200', name: 'Payroll Expense', type: 'EXPENSE' },
] as const;

export type SystemAccountCode = (typeof SYSTEM_ACCOUNT_DEFINITIONS)[number]['code'];

const SYSTEM_ACCOUNT_CODES = SYSTEM_ACCOUNT_DEFINITIONS.map((entry) => entry.code);
const SYSTEM_ACCOUNT_CODE_SET = new Set<string>(SYSTEM_ACCOUNT_CODES);

const isSystemAccountCode = (value: string): value is SystemAccountCode =>
    SYSTEM_ACCOUNT_CODE_SET.has(value);

export const ensureSystemAccounts = async (
    tx: any,
    userId: string,
    now: Date = new Date()
): Promise<Map<SystemAccountCode, string>> => {
    const existing = await tx
        .select({ id: accounts.id, code: accounts.code })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), inArray(accounts.code, [...SYSTEM_ACCOUNT_CODES])));

    const byCode = new Map<SystemAccountCode, string>();
    for (const row of existing) {
        if (isSystemAccountCode(row.code) && !byCode.has(row.code)) {
            byCode.set(row.code, row.id);
        }
    }

    for (const definition of SYSTEM_ACCOUNT_DEFINITIONS) {
        if (byCode.has(definition.code)) continue;

        const inserted = await tx
            .insert(accounts)
            .values({
                id: nanoid(),
                userId,
                code: definition.code,
                name: definition.name,
                type: definition.type,
                parentId: null,
                isSystem: true,
                isActive: true,
                createdAt: now,
                updatedAt: now,
            })
            .returning({ id: accounts.id });

        if (inserted[0]) {
            byCode.set(definition.code, inserted[0].id);
        }
    }

    return byCode;
};
