
import { create } from 'zustand';
import { BillItem, Item } from '../types';

interface CartState {
    items: BillItem[];
    customerName: string;
    customerPhone: string;
    partyId?: string;
    customerGst?: string;
    customerAddress?: string;
    transactionType: 'SALE' | 'PURCHASE';
    billDate?: Date;
    billNumber?: string;
    isGstBill: boolean;

    setCustomerDetails: (name: string, phone: string) => void;
    setCustomer: (party: any) => void;
    setTransactionType: (type: 'SALE' | 'PURCHASE') => void;
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
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
            );
        } else {
            // For Purchase, we might want price to be purchasePrice. 
            // But item object passed in likely has 'price' as selling price.
            // We should handle this logic in UI before calling addItem.
            newItems = [...items, { id: item.id, name: item.name, price: item.price, quantity: 1, tax: item.gstPercentage }];
        }

        const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
        set({ items: newItems, total, itemCount });
    },

    addItemWithPrice: (item, price) => { // New helper for custom price (Purchase)
        const { items } = get();
        const existingItem = items.find(i => i.id === item.id);

        let newItems;
        if (existingItem) {
            newItems = items.map(i =>
                i.id === item.id
                    ? { ...i, quantity: i.quantity + 1 } // Keep existing price? Or update? usually keep
                    : i
            );
        } else {
            newItems = [...items, { id: item.id, name: item.name, price: price, quantity: 1, tax: item.gstPercentage }];
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
                return { ...i, quantity: newQty };
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
