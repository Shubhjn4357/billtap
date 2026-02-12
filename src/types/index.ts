
export interface UserProfile {
    uid: string;
    email: string | null;
    phoneNumber: string | null;
    displayName: string | null;
    photoURL: string | null;
    businessName?: string;
    gstNumber?: string;
    role?: 'owner' | 'staff';
}

export interface Item {
    id: string;
    userId: string;
    name: string;
    nameLowercase: string;
    price: number;
    stock: number;
    category?: string;
    barcode?: string;
    updatedAt: any; // Firestore Timestamp
}

export interface BillItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export interface Bill {
    id?: string;
    userId: string;
    customerName?: string;
    customerPhone?: string;
    items: BillItem[];
    total: number;
    createdAt: any; // Firestore Timestamp
}
