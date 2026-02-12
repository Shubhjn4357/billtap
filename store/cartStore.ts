import { create } from 'zustand';
import { InventoryItem, CartItem } from '../types';

interface CartState {
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  setCustomerDetails: (name: string, phone: string) => void;
  addItem: (item: InventoryItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
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
        newItems = [...items, { ...item, quantity: 1 }];
    }
    
    const total = newItems.reduce((sum, i) => sum + (i.sellingPrice * i.quantity), 0);
    set({ items: newItems, total, itemCount: newItems.length });
  },

  removeItem: (itemId) => {
      const { items } = get();
      const newItems = items.filter(i => i.id !== itemId);
      const total = newItems.reduce((sum, i) => sum + (i.sellingPrice * i.quantity), 0);
      set({ items: newItems, total, itemCount: newItems.length });
  },

  updateQuantity: (itemId, quantity) => {
      const { items } = get();
      if (quantity <= 0) {
          get().removeItem(itemId);
          return;
      }
      
      const newItems = items.map(i => 
          i.id === itemId 
            ? { ...i, quantity } 
            : i
      );
      const total = newItems.reduce((sum, i) => sum + (i.sellingPrice * i.quantity), 0);
      set({ items: newItems, total, itemCount: newItems.length });
  },

  clearCart: () => set({ items: [], total: 0, itemCount: 0, customerName: '', customerPhone: '' }),
}));
