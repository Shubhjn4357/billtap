import { create } from 'zustand';
import { BillItem, Item, Party, TransactionType } from '../types';

interface CartState {
    items: BillItem[];
    customerName: string;
    customerPhone: string;
    partyId?: string;
    customerGst?: string;
    customerAddress?: string;
    transactionType: TransactionType;
    billDate?: Date;
    billNumber?: string;
    isGstBill: boolean;

    setCustomerDetails: (name: string, phone: string) => void;
    setCustomer: (party: Party | null) => void;
    setTransactionType: (type: TransactionType) => void;
    setBillDetails: (date?: Date, number?: string) => void;
    setIsGstBill: (enabled: boolean) => void;

    addItem: (item: Item) => void;
    addItemWithPrice: (item: Item, price: number) => void;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, delta: number) => void;
    clearCart: () => void;
    total: number;
    itemCount: number;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    customerName: '',
    customerPhone: '',
    partyId: undefined,
    customerGst: undefined,
    customerAddress: undefined,
    transactionType: 'SALE',
    billDate: undefined,
    billNumber: undefined,
    isGstBill: true,
    total: 0,
    itemCount: 0,

    setCustomerDetails: (name, phone) => set({ customerName: name, customerPhone: phone }),

    setCustomer: (party) => set({
        partyId: party?.id,
        customerName: party?.name ?? '',
        customerPhone: party?.phone ?? '',
        customerGst: party?.gstNumber,
        customerAddress: party?.address,
    }),

    setTransactionType: (type) => set({ transactionType: type }),

    setBillDetails: (date, number) => set({ billDate: date, billNumber: number }),

    setIsGstBill: (enabled) => set({ isGstBill: enabled }),

    addItem: (item) => {
        const { items } = get();
        const existingItem = items.find(i => i.id === item.id);
        
        let newItems;
        if (existingItem) {
            newItems = items.map(i => 
                i.id === item.id 
                    ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
                    : i
            );
        } else {
            newItems = [...items, {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                tax: item.gstPercentage,
                total: item.price
            }];
        }

        const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
        set({ items: newItems, total, itemCount });
    },

    addItemWithPrice: (item, price) => {
        const { items } = get();
        const existingItem = items.find(i => i.id === item.id);

        let newItems;
        if (existingItem) {
            newItems = items.map(i =>
                i.id === item.id
                    ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
                    : i
            );
        } else {
            newItems = [...items, {
                id: item.id,
                name: item.name,
                price: price,
                quantity: 1,
                tax: item.gstPercentage,
                total: price
            }];
        }

        const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
        set({ items: newItems, total, itemCount });
    },

    removeItem: (itemId) => {
        const { items } = get();
        const newItems = items.filter(i => i.id !== itemId);
        const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
        set({ items: newItems, total, itemCount });
    },

    updateQuantity: (itemId, delta) => {
        const { items } = get();
        const newItems = items.map(i => {
            if (i.id === itemId) {
                const newQty = Math.max(0, i.quantity + delta);
                return { ...i, quantity: newQty, total: newQty * i.price };
            }
            return i;
        }).filter(i => i.quantity > 0); 

        const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
        set({ items: newItems, total, itemCount });
    },

    clearCart: () => set({
        items: [],
        total: 0,
        itemCount: 0,
        customerName: '',
        customerPhone: '',
        partyId: undefined,
        customerGst: undefined,
        customerAddress: undefined,
        billNumber: undefined,
        // Keep transactionType and billDate? usually reset date to today?
        billDate: undefined,
        isGstBill: true,
    }),
}));
