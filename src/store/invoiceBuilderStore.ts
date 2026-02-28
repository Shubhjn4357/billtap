import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { InvoiceType, PaymentMode } from '../constants/enums';
import type { InvoiceBuilderState, InvoiceLineItem } from '../types/domain';
import { computeGst } from '../constants/gstRates';

const EMPTY_LINE = (): InvoiceLineItem => ({
    _key: Math.random().toString(36).slice(2),
    itemId: null,
    description: '',
    quantity: 1,
    unit: 'pcs',
    rate: 0,
    discountPercent: 0,
    gstRate: 0,
    isInterState: false,
    discountAmount: 0,
    taxableValue: 0,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    total: 0,
});

function computeLine(line: InvoiceLineItem): InvoiceLineItem {
    const discountAmount = r2((line.rate * line.quantity * line.discountPercent) / 100);
    const taxableValue = r2(line.rate * line.quantity - discountAmount);
    const gst = computeGst(taxableValue, line.gstRate, line.isInterState);
    const total = r2(taxableValue + gst.total);
    return {
        ...line,
        discountAmount,
        taxableValue,
        cgstRate: line.isInterState ? 0 : line.gstRate / 2,
        cgstAmount: gst.cgst,
        sgstRate: line.isInterState ? 0 : line.gstRate / 2,
        sgstAmount: gst.sgst,
        igstRate: line.isInterState ? line.gstRate : 0,
        igstAmount: gst.igst,
        total,
    };
}

function r2(n: number): number { return Math.round(n * 100) / 100; }

interface InvoiceTotals {
    subtotal: number;
    totalDiscount: number;
    totalTaxable: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalTax: number;
    totalInvoiceValue: number;
}

interface InvoiceBuilderStore {
    state: InvoiceBuilderState;
    totals: InvoiceTotals;
    // Actions
    init: (invoiceType: InvoiceType) => void;
    reset: () => void;
    setInvoiceType: (type: InvoiceType) => void;
    setInvoiceNumber: (n: string) => void;
    setInvoiceDate: (d: string) => void;
    setDueDate: (d: string | null) => void;
    setParty: (id: string | null, snapshot?: InvoiceBuilderState['partySnapshot']) => void;
    setPlaceOfSupply: (s: string) => void;
    addLine: () => void;
    updateLine: (key: string, updates: Partial<InvoiceLineItem>) => void;
    removeLine: (key: string) => void;
    moveLine: (from: number, to: number) => void;
    setDiscount: (amount: number) => void;
    setAdditionalCharges: (amount: number) => void;
    setRoundOff: (amount: number) => void;
    setPaymentMode: (mode: PaymentMode) => void;
    setPaidAmount: (amount: number) => void;
    setNotes: (n: string) => void;
    setTerms: (t: string) => void;
    setReverseCharge: (v: boolean) => void;
    applyInterState: (isInterState: boolean) => void;
}

const defaultState = (): InvoiceBuilderState => ({
    invoiceType: InvoiceType.TAX_INVOICE,
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: null,
    partyId: null,
    partySnapshot: null,
    placeOfSupply: '',
    items: [EMPTY_LINE()],
    discountAmount: 0,
    additionalCharges: 0,
    roundOffAmount: 0,
    paymentMode: PaymentMode.CASH,
    paidAmount: 0,
    reverseCharge: false,
    notes: '',
    termsAndConditions: '',
});

function computeTotals(s: InvoiceBuilderState): InvoiceTotals {
    let subtotal = 0, totalDiscount = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    for (const line of s.items) {
        subtotal += r2(line.rate * line.quantity);
        totalDiscount += line.discountAmount;
        totalTaxable += line.taxableValue;
        totalCgst += line.cgstAmount;
        totalSgst += line.sgstAmount;
        totalIgst += line.igstAmount;
    }
    const totalTax = r2(totalCgst + totalSgst + totalIgst);
    const totalInvoiceValue = r2(totalTaxable + totalTax - s.discountAmount + s.additionalCharges + s.roundOffAmount);
    return { subtotal: r2(subtotal), totalDiscount: r2(totalDiscount), totalTaxable: r2(totalTaxable), totalCgst: r2(totalCgst), totalSgst: r2(totalSgst), totalIgst: r2(totalIgst), totalTax, totalInvoiceValue };
}

export const useInvoiceBuilderStore = create<InvoiceBuilderStore>()(
    immer((set, get) => {
        const syncTotals = (s: InvoiceBuilderState) => computeTotals(s);

        return {
            state: defaultState(),
            totals: computeTotals(defaultState()),

            init: (invoiceType) => set((store) => {
                store.state = { ...defaultState(), invoiceType };
                store.totals = computeTotals(store.state);
            }),

            reset: () => set((store) => {
                store.state = defaultState();
                store.totals = computeTotals(store.state);
            }),

            setInvoiceType: (type) => set((store) => { store.state.invoiceType = type; }),
            setInvoiceNumber: (n) => set((store) => { store.state.invoiceNumber = n; }),
            setInvoiceDate: (d) => set((store) => { store.state.invoiceDate = d; }),
            setDueDate: (d) => set((store) => { store.state.dueDate = d; }),
            setParty: (id, snapshot) => set((store) => { store.state.partyId = id; store.state.partySnapshot = snapshot ?? null; }),
            setPlaceOfSupply: (s) => set((store) => { store.state.placeOfSupply = s; }),

            addLine: () => set((store) => {
                store.state.items.push(EMPTY_LINE());
                store.totals = syncTotals(store.state);
            }),

            updateLine: (key, updates) => set((store) => {
                const idx = store.state.items.findIndex((l) => l._key === key);
                if (idx < 0) return;
                const updated = computeLine({ ...store.state.items[idx], ...updates });
                store.state.items[idx] = updated;
                store.totals = syncTotals(store.state);
            }),

            removeLine: (key) => set((store) => {
                if (store.state.items.length <= 1) return;
                store.state.items = store.state.items.filter((l) => l._key !== key);
                store.totals = syncTotals(store.state);
            }),

            moveLine: (from, to) => set((store) => {
                const items = [...store.state.items];
                const [moved] = items.splice(from, 1);
                items.splice(to, 0, moved);
                store.state.items = items;
            }),

            setDiscount: (amount) => set((store) => {
                store.state.discountAmount = amount;
                store.totals = syncTotals(store.state);
            }),

            setAdditionalCharges: (amount) => set((store) => {
                store.state.additionalCharges = amount;
                store.totals = syncTotals(store.state);
            }),

            setRoundOff: (amount) => set((store) => {
                store.state.roundOffAmount = amount;
                store.totals = syncTotals(store.state);
            }),

            setPaymentMode: (mode) => set((store) => { store.state.paymentMode = mode; }),
            setPaidAmount: (amount) => set((store) => { store.state.paidAmount = amount; }),
            setNotes: (n) => set((store) => { store.state.notes = n; }),
            setTerms: (t) => set((store) => { store.state.termsAndConditions = t; }),
            setReverseCharge: (v) => set((store) => { store.state.reverseCharge = v; }),

            applyInterState: (isInterState) => set((store) => {
                store.state.items = store.state.items.map((line) => computeLine({ ...line, isInterState }));
                store.totals = syncTotals(store.state);
            }),
        };
    })
);

export const useInvoiceState = () => useInvoiceBuilderStore((s) => s.state);
export const useInvoiceTotals = () => useInvoiceBuilderStore((s) => s.totals);
