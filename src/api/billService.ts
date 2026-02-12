
import { 
    collection, 
    addDoc, 
    Timestamp 
} from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface BillItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export interface Bill {
    userId: string;
    customerName?: string;
    customerPhone?: string;
    items: BillItem[];
    total: number;
    createdAt: any;
}

const BILLS_COLLECTION = 'orders'; // Using 'orders' to match existing structure if any

export const billService = {
    /**
     * Creates a new bill record.
     */
    async createBill(bill: Omit<Bill, 'createdAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, BILLS_COLLECTION), {
            ...bill,
            createdAt: Timestamp.now() // Use Server Timestamp ideally
        });
        return docRef.id;
    },

    // Add other bill related methods here (getBills, etc.)
};
