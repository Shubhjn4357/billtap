import type { BillItem, TransactionType } from '../types';
import type { CachedBill } from '../api/billService';
import type { DbTransaction } from '../types/db';

// This was previously defined inside useBills.ts.  We moved it here so that
// unit tests can import the mapping logic without dragging in the whole hook
// (and transitively the native expo-sqlite dependency).

export const mapTransactionToBill = (tx: DbTransaction): CachedBill => {
    let items: BillItem[] = [];
    try {
        items = tx.itemsSnapshot ? JSON.parse(tx.itemsSnapshot) : [];
    } catch {
        items = [];
    }

    return {
        id: tx.id,
        userId: tx.organizationId ?? '',
        billNumber: tx.billNumber ?? undefined,
        customerName: tx.partyName ?? undefined,
        customerPhone: undefined,
        businessName: undefined,
        businessAddress: undefined,
        gstNumber: undefined,
        currency: tx.currency ?? 'INR',
        items,
        total: tx.totalAmount,
        createdAt: tx.billDate ?? tx.createdAt,
        taxAmount: tx.taxAmount ?? 0,
        type: tx.type as TransactionType,
        billMode: tx.billMode as 'GST' | 'ESTIMATE',
        // CachedBill runtime payment fields
        paymentStatus: (tx.paymentStatus as CachedBill['paymentStatus']) ?? 'PENDING',
        paidAmount: tx.paidAmount ?? 0,
        dueAmount: Math.max(0, tx.totalAmount - (tx.paidAmount ?? 0)),
        paymentMode: (tx.paymentMode as CachedBill['paymentMode']) ?? 'CASH',
        partyId: tx.partyId ?? undefined,
        partyName: tx.partyName ?? undefined,
    };
};
