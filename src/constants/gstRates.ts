// GST computation utilities per India GST 2026

export const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28] as const;
export type GstSlab = typeof GST_SLABS[number];

export type GstComponents = { cgst: number; sgst: number; igst: number; cess: number; total: number };
export type GstBreakupLine = { rate: number; taxable: number; cgst: number; sgst: number; igst: number; cess: number };

export function computeGst(taxableValue: number, gstRate: number, isInterState: boolean, cessRate = 0): GstComponents {
    if (gstRate === 0) return { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 };
    const halfRate = gstRate / 2;
    const cgst = isInterState ? 0 : r2((taxableValue * halfRate) / 100);
    const sgst = isInterState ? 0 : r2((taxableValue * halfRate) / 100);
    const igst = isInterState ? r2((taxableValue * gstRate) / 100) : 0;
    const cess = cessRate > 0 ? r2((taxableValue * cessRate) / 100) : 0;
    return { cgst, sgst, igst, cess, total: cgst + sgst + igst + cess };
}

export function computeGstBreakup(items: { taxableValue: number; gstRate: number; isInterState: boolean; cessRate?: number }[]): GstBreakupLine[] {
    const map = new Map<number, GstBreakupLine>();
    for (const item of items) {
        const gst = computeGst(item.taxableValue, item.gstRate, item.isInterState, item.cessRate ?? 0);
        const ex = map.get(item.gstRate);
        if (ex) {
            ex.taxable += item.taxableValue; ex.cgst += gst.cgst; ex.sgst += gst.sgst; ex.igst += gst.igst; ex.cess += gst.cess;
        } else {
            map.set(item.gstRate, { rate: item.gstRate, taxable: item.taxableValue, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst, cess: gst.cess });
        }
    }
    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
}

export function taxableFromInclusive(inclusiveAmount: number, gstRate: number): number {
    if (gstRate === 0) return inclusiveAmount;
    return r2((inclusiveAmount * 100) / (100 + gstRate));
}

export function isInterState(supplierState: string, placeOfSupply: string): boolean {
    return supplierState.toUpperCase() !== placeOfSupply.toUpperCase();
}

export const INDIAN_STATES: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
    '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh (New)',
};

export const INDIAN_STATE_LIST = Object.entries(INDIAN_STATES).map(([code, name]) => ({ code, name, label: `${name} (${code})` }));

export const GST_RATE_LABELS: Record<number, string> = {
    0: 'Exempt/Nil', 0.25: '0.25%', 3: '3% (Gold)', 5: '5%', 12: '12%', 18: '18%', 28: '28%',
};

function r2(n: number): number { return Math.round(n * 100) / 100; }
