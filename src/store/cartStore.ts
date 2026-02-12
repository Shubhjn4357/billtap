
import { create } from 'zustand';
import { BillItem, Item } from '../types';

interface CartState {
    items: BillItem[];
    customerName: string;
    customerPhone: string;
    setCustomerDetails: (name: string, phone: string) => void;
    addItem: (item: Item) => void;
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
    total: 0,
    itemCount: 0,

    setCustomerDetails: (name, phone) => set({ customerName: name, customerPhone: phone }),

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
            newItems = [...items, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
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
        }).filter(i => i.quantity > 0); // Remove if 0

        const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
        set({ items: newItems, total, itemCount });
    },

    clearCart: () => set({ items: [], total: 0, itemCount: 0, customerName: '', customerPhone: '' }),
}));
