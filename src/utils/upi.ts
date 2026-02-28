const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,128}@[a-zA-Z0-9._-]{2,64}$/;

export const sanitizeUpiId = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, '');

export const isValidUpiId = (value: string): boolean => {
    const normalized = sanitizeUpiId(value);
    if (!normalized) return false;
    return UPI_ID_PATTERN.test(normalized);
};

const sanitizeAmount = (amount: number): string => {
    if (!Number.isFinite(amount) || amount <= 0) return '0';
    return amount.toFixed(2);
};

export type UpiPaymentOptions = {
    upiId: string;
    payeeName?: string;
    amount?: number;
    note?: string;
    transactionRef?: string;
    currency?: string;
};

export const buildUpiPaymentUri = (options: UpiPaymentOptions): string => {
    const normalizedUpiId = sanitizeUpiId(options.upiId);
    if (!isValidUpiId(normalizedUpiId)) return '';

    const params = new URLSearchParams();
    params.set('pa', normalizedUpiId);
    params.set('pn', options.payeeName?.trim() || 'Vahi Merchant');
    params.set('cu', options.currency?.trim().toUpperCase() || 'INR');

    if (typeof options.amount === 'number' && Number.isFinite(options.amount) && options.amount > 0) {
        params.set('am', sanitizeAmount(options.amount));
    }
    if (options.note?.trim()) params.set('tn', options.note.trim());
    if (options.transactionRef?.trim()) params.set('tr', options.transactionRef.trim());

    return `upi://pay?${params.toString()}`;
};

export const buildUpiQrImageUrl = (upiPayload: string, size = 220): string => {
    const dimension = Math.max(120, Math.min(512, Math.trunc(size)));
    const encodedPayload = encodeURIComponent(upiPayload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${dimension}x${dimension}&data=${encodedPayload}`;
};

export const extractUpiIdFromPayload = (payload: string): string | null => {
    const normalizedPayload = payload.trim();
    if (!normalizedPayload) return null;

    if (normalizedPayload.includes('upi://pay')) {
        const queryIndex = normalizedPayload.indexOf('?');
        if (queryIndex < 0) return null;

        const params = new URLSearchParams(normalizedPayload.slice(queryIndex + 1));
        const upiId = params.get('pa');
        if (!upiId) return null;
        const normalized = sanitizeUpiId(upiId);
        return isValidUpiId(normalized) ? normalized : null;
    }

    const normalized = sanitizeUpiId(normalizedPayload);
    return isValidUpiId(normalized) ? normalized : null;
};
