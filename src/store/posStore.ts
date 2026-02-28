import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PosCartItem } from '../types/domain';

interface PosState {
    cartItems: PosCartItem[];
    partyId: string | null;
    partyName: string | null;
    discountAmount: number;
    roundOffAmount: number;
    paymentMode: 'CASH' | 'CARD' | 'UPI' | 'BANK';
    paidAmount: number;
    placeOfSupply: string;
    notes: string;
    isInterState: boolean;
}

interface PosActions {
    addItem: (item: Omit<PosCartItem, '_key' | 'taxableValue' | 'totalAmount'>) => void;
    updateItemQty: (key: string, qty: number) => void;
    removeItem: (key: string) => void;
    clearCart: () => void;
    setParty: (id: string | null, name: string | null) => void;
    setDiscount: (amount: number) => void;
    setRoundOff: (amount: number) => void;
    setPaymentMode: (mode: PosState['paymentMode']) => void;
    setPaidAmount: (amount: number) => void;
    setNotes: (notes: string) => void;
    setInterState: (v: boolean) => void;
    // Computed
    getSubtotal: () => number;
    getTotalTax: () => number;
    getTotal: () => number;
}

function r2(n: number): number { return Math.round(n * 100) / 100; }

function computePosItem(item: Omit<PosCartItem, 'taxableValue' | 'totalAmount'> & { taxableValue?: number; totalAmount?: number }): PosCartItem {
    const discountAmt = r2((item.rate * item.quantity * item.discountPercent) / 100);
    const taxableValue = r2(item.rate * item.quantity - discountAmt);
    const halfGst = item.gstRate / 2;
    const cgst = item.isInterState ? 0 : r2((taxableValue * halfGst) / 100);
    const sgst = item.isInterState ? 0 : r2((taxableValue * halfGst) / 100);
    const igst = item.isInterState ? r2((taxableValue * item.gstRate) / 100) : 0;
    const totalAmount = r2(taxableValue + cgst + sgst + igst);
    return { ...item, taxableValue, totalAmount };
}

export const usePosStore = create<PosState & PosActions>()(
    immer((set, get) => ({
        cartItems: [],
        partyId: null,
        partyName: null,
        discountAmount: 0,
        roundOffAmount: 0,
        paymentMode: 'CASH',
        paidAmount: 0,
        placeOfSupply: '',
        notes: '',
        isInterState: false,

        addItem: (item) => set((s) => {
            const existing = s.cartItems.find((ci) => ci.itemId === item.itemId && item.itemId != null);
            if (existing) {
                const idx = s.cartItems.indexOf(existing);
                s.cartItems[idx] = computePosItem({ ...existing, quantity: existing.quantity + 1 });
            } else {
                s.cartItems.push(computePosItem({ _key: Math.random().toString(36).slice(2), ...item }));
            }
        }),

        updateItemQty: (key, qty) => set((s) => {
            if (qty <= 0) { s.cartItems = s.cartItems.filter((ci) => ci._key !== key); return; }
            const idx = s.cartItems.findIndex((ci) => ci._key === key);
            if (idx < 0) return;
            s.cartItems[idx] = computePosItem({ ...s.cartItems[idx], quantity: qty });
        }),

        removeItem: (key) => set((s) => { s.cartItems = s.cartItems.filter((ci) => ci._key !== key); }),
        clearCart: () => set((s) => { s.cartItems = []; s.partyId = null; s.partyName = null; s.discountAmount = 0; s.roundOffAmount = 0; s.paidAmount = 0; }),
        setParty: (id, name) => set((s) => { s.partyId = id; s.partyName = name; }),
        setDiscount: (amount) => set((s) => { s.discountAmount = amount; }),
        setRoundOff: (amount) => set((s) => { s.roundOffAmount = amount; }),
        setPaymentMode: (mode) => set((s) => { s.paymentMode = mode; }),
        setPaidAmount: (amount) => set((s) => { s.paidAmount = amount; }),
        setNotes: (notes) => set((s) => { s.notes = notes; }),
        setInterState: (v) => set((s) => {
            s.isInterState = v;
            s.cartItems = s.cartItems.map((ci) => computePosItem({ ...ci, isInterState: v }));
        }),

        getSubtotal: () => {
            const { cartItems } = get();
            return r2(cartItems.reduce((sum, ci) => sum + ci.rate * ci.quantity, 0));
        },
        getTotalTax: () => {
            const { cartItems } = get();
            return r2(cartItems.reduce((sum, ci) => {
                const taxable = ci.taxableValue;
                const half = ci.gstRate / 2;
                const cgst = ci.isInterState ? 0 : r2((taxable * half) / 100);
                const sgst = ci.isInterState ? 0 : r2((taxable * half) / 100);
                const igst = ci.isInterState ? r2((taxable * ci.gstRate) / 100) : 0;
                return sum + cgst + sgst + igst;
            }, 0));
        },
        getTotal: () => {
            const s = get();
            return r2(s.cartItems.reduce((sum, ci) => sum + ci.totalAmount, 0) - s.discountAmount + s.roundOffAmount);
        },
    }))
);
