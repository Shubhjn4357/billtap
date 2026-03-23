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
    addItem: (item: Omit<PosCartItem, '_key' | 'taxableValue' | 'totalAmount'>) => { accepted: boolean; clamped: boolean; quantity: number; maxAvailable: number | null };
    updateItemQty: (key: string, qty: number) => { accepted: boolean; clamped: boolean; quantity: number; maxAvailable: number | null };
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

const getMaxAvailable = (availableStock?: number | null) => {
    if (typeof availableStock !== 'number' || !Number.isFinite(availableStock)) return null;
    return Math.max(0, availableStock);
};

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

        addItem: (item) => {
            let result = { accepted: true, clamped: false, quantity: item.quantity, maxAvailable: getMaxAvailable(item.availableStock) };
            set((s) => {
                const maxAvailable = getMaxAvailable(item.availableStock);
                const existing = s.cartItems.find((ci) => ci.itemId === item.itemId && item.itemId != null);
                const requestedQty = existing ? existing.quantity + 1 : item.quantity;
                const finalQty = maxAvailable === null ? requestedQty : Math.min(requestedQty, maxAvailable);

                result = {
                    accepted: finalQty > 0,
                    clamped: maxAvailable !== null && finalQty < requestedQty,
                    quantity: finalQty,
                    maxAvailable,
                };

                if (finalQty <= 0) return;

                if (existing) {
                    const idx = s.cartItems.indexOf(existing);
                    s.cartItems[idx] = computePosItem({ ...existing, availableStock: item.availableStock, quantity: finalQty });
                } else {
                    s.cartItems.push(computePosItem({ _key: Math.random().toString(36).slice(2), ...item, quantity: finalQty }));
                }
            });
            return result;
        },

        updateItemQty: (key, qty) => {
            let result = { accepted: true, clamped: false, quantity: qty, maxAvailable: null as number | null };
            set((s) => {
                const idx = s.cartItems.findIndex((ci) => ci._key === key);
                if (idx < 0) {
                    result = { accepted: false, clamped: false, quantity: 0, maxAvailable: null };
                    return;
                }
                const current = s.cartItems[idx];
                const maxAvailable = getMaxAvailable(current.availableStock);
                if (qty <= 0) {
                    s.cartItems = s.cartItems.filter((ci) => ci._key !== key);
                    result = { accepted: true, clamped: false, quantity: 0, maxAvailable };
                    return;
                }

                const finalQty = maxAvailable === null ? qty : Math.min(qty, maxAvailable);
                s.cartItems[idx] = computePosItem({ ...current, quantity: finalQty });
                result = {
                    accepted: true,
                    clamped: maxAvailable !== null && finalQty < qty,
                    quantity: finalQty,
                    maxAvailable,
                };
            });
            return result;
        },

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
