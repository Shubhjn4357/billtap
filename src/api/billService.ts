
import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    type DocumentData,
    type QueryConstraint,
    where,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { Bill, FirestoreDate } from '../types';

export interface StoredBill extends Bill {
    id: string;
    createdAt: FirestoreDate;
}

const BILLS_COLLECTION = 'orders';
const ITEMS_COLLECTION = 'items';

const toStoredBill = (id: string, raw: DocumentData): StoredBill => ({
    id,
    userId: raw.userId,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    businessName: raw.businessName,
    businessAddress: raw.businessAddress,
    gstNumber: raw.gstNumber,
    currency: raw.currency,
    items: raw.items ?? [],
    total: Number(raw.total ?? 0),
    createdAt: raw.createdAt,
});

export const billService = {
    /**
     * Creates a new bill record.
     */
    async createBill(bill: Omit<Bill, 'createdAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, BILLS_COLLECTION), {
            ...bill,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    },

    /**
     * Creates a bill and decrements stock atomically.
     */
    async createBillWithStockValidation(bill: Omit<Bill, 'createdAt'>): Promise<string> {
        const orderRef = doc(collection(db, BILLS_COLLECTION));

        await runTransaction(db, async (transaction) => {
            const grouped = new Map<string, number>();
            for (const line of bill.items) {
                if (line.quantity <= 0) {
                    throw new Error(`Invalid quantity for "${line.name}".`);
                }
                grouped.set(line.id, (grouped.get(line.id) ?? 0) + line.quantity);
            }

            for (const [itemId, qty] of grouped.entries()) {
                const itemRef = doc(db, ITEMS_COLLECTION, itemId);
                const itemSnap = await transaction.get(itemRef);
                if (!itemSnap.exists()) {
                    throw new Error(`Item ${itemId} no longer exists.`);
                }

                const data = itemSnap.data();
                if (data.userId !== bill.userId) {
                    throw new Error('Item ownership mismatch. Please refresh and retry.');
                }

                const currentStock = Number(data.stock ?? 0);
                const nextStock = currentStock - qty;
                if (nextStock < 0) {
                    throw new Error(`Insufficient stock for "${data.name}".`);
                }

                transaction.update(itemRef, {
                    stock: nextStock,
                    updatedAt: serverTimestamp(),
                });
            }

            transaction.set(orderRef, {
                ...bill,
                createdAt: serverTimestamp(),
            });
        });

        return orderRef.id;
    },

    async getUserBills(userId: string, max = 200): Promise<StoredBill[]> {
        const q = query(
            collection(db, BILLS_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(max)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((billDoc) => toStoredBill(billDoc.id, billDoc.data()));
    },

    async getUserBillsInRange(userId: string, start: Date, end?: Date): Promise<StoredBill[]> {
        const constraints: QueryConstraint[] = [
            where('userId', '==', userId),
            where('createdAt', '>=', start),
            orderBy('createdAt', 'desc'),
        ];
        if (end) {
            constraints.splice(2, 0, where('createdAt', '<=', end));
        }

        const q = query(collection(db, BILLS_COLLECTION), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map((billDoc) => toStoredBill(billDoc.id, billDoc.data()));
    },
};
