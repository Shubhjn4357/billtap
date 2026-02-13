
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    runTransaction,
    serverTimestamp,
    where,
    orderBy,
    type DocumentData
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { BillItem, Item } from '../types';

const ITEMS_COLLECTION = 'items';

const toItem = (raw: DocumentData, id: string): Item => ({
    id,
    userId: raw.userId,
    name: raw.name,
    nameLowercase: raw.nameLowercase,
    price: raw.price,
    stock: raw.stock,
    category: raw.category,
    barcode: raw.barcode,
    updatedAt: raw.updatedAt,
});

export const itemService = {
    /**
     * Adds a new item to inventory.
     */
    async addItem(item: Omit<Item, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
            ...item,
            nameLowercase: item.name.toLowerCase(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Updates an existing item.
     */
    async updateItem(id: string, updates: Partial<Item>): Promise<void> {
        const docRef = doc(db, ITEMS_COLLECTION, id);
        const payload: Record<string, unknown> = {
            ...updates,
            updatedAt: serverTimestamp(),
        };

        if (typeof updates.name === 'string') {
            payload.nameLowercase = updates.name.toLowerCase();
        }

        await updateDoc(docRef, {
            ...payload,
        });
    },

    /**
     * Updates stock for a single item in a transaction.
     */
    async updateStock(id: string, qty: number, type: 'IN' | 'OUT'): Promise<void> {
        if (qty <= 0) {
            throw new Error('Quantity must be greater than 0.');
        }

        const docRef = doc(db, ITEMS_COLLECTION, id);
        await runTransaction(db, async (transaction) => {
            const itemSnap = await transaction.get(docRef);
            if (!itemSnap.exists()) {
                throw new Error('Item not found.');
            }

            const currentStock = Number(itemSnap.data().stock ?? 0);
            const nextStock = type === 'IN' ? currentStock + qty : currentStock - qty;
            if (nextStock < 0) {
                throw new Error(`Insufficient stock for "${itemSnap.data().name}".`);
            }

            transaction.update(docRef, {
                stock: nextStock,
                updatedAt: serverTimestamp(),
            });
        });
    },

    /**
     * Atomically consumes stock for checkout.
     */
    async consumeStock(items: Pick<BillItem, 'id' | 'quantity'>[]): Promise<void> {
        const grouped = new Map<string, number>();
        for (const item of items) {
            if (item.quantity <= 0) continue;
            grouped.set(item.id, (grouped.get(item.id) ?? 0) + item.quantity);
        }

        if (grouped.size === 0) {
            throw new Error('No valid line items to consume stock.');
        }

        await runTransaction(db, async (transaction) => {
            for (const [itemId, qty] of grouped.entries()) {
                const itemRef = doc(db, ITEMS_COLLECTION, itemId);
                const itemSnap = await transaction.get(itemRef);
                if (!itemSnap.exists()) {
                    throw new Error(`Item ${itemId} no longer exists.`);
                }

                const currentStock = Number(itemSnap.data().stock ?? 0);
                const nextStock = currentStock - qty;
                if (nextStock < 0) {
                    throw new Error(`Insufficient stock for "${itemSnap.data().name}".`);
                }

                transaction.update(itemRef, {
                    stock: nextStock,
                    updatedAt: serverTimestamp(),
                });
            }
        });
    },

    /**
     * Deletes an item.
     */
    async deleteItem(id: string): Promise<void> {
        await deleteDoc(doc(db, ITEMS_COLLECTION, id));
    },

    /**
     * Fetches items for a specific user.
     */
    async getUserItems(userId: string): Promise<Item[]> {
        const q = query(
            collection(db, ITEMS_COLLECTION),
            where('userId', '==', userId),
            orderBy('nameLowercase', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((itemDoc) => toItem(itemDoc.data(), itemDoc.id));
    },

    /**
     * Fetches a single item.
     */
    async getItem(id: string): Promise<Item | null> {
        const itemDoc = await getDoc(doc(db, ITEMS_COLLECTION, id));
        if (!itemDoc.exists()) return null;
        return toItem(itemDoc.data(), itemDoc.id);
    },

    /**
     * Search items by name or barcode.
     */
    async searchItems(userId: string, queryText: string): Promise<Item[]> {
        const q = query(
            collection(db, ITEMS_COLLECTION),
            where('userId', '==', userId),
            where('nameLowercase', '>=', queryText.toLowerCase()),
            where('nameLowercase', '<=', queryText.toLowerCase() + '\uf8ff')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((itemDoc) => toItem(itemDoc.data(), itemDoc.id));
    }
};
