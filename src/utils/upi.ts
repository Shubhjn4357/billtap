const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,128}@[a-zA-Z0-9._-]{2,64}$/;

export const sanitizeUpiId = (value: string): string => {
    return value.trim().toLowerCase().replace(/\s+/g, '');
};

export const isValidUpiId = (value: string): boolean => {
    const normalized = sanitizeUpiId(value);
    return UPI_ID_PATTERN.test(normalized);
};

export const extractUpiIdFromPayload = (payload: string): string | null => {
    const normalizedPayload = payload.trim();
    if (!normalizedPayload) return null;

    if (normalizedPayload.includes('upi://pay')) {
        const queryIndex = normalizedPayload.indexOf('?');
        if (queryIndex < 0) return null;

        const query = normalizedPayload.slice(queryIndex + 1);
        const params = new URLSearchParams(query);
        const candidate = params.get('pa');
        if (!candidate) return null;
        const normalized = sanitizeUpiId(candidate);
        return isValidUpiId(normalized) ? normalized : null;
    }

    const normalized = sanitizeUpiId(normalizedPayload);
    return isValidUpiId(normalized) ? normalized : null;
};

interface BuildUpiPaymentUriOptions {
    upiId: string;
    amount: number;
    payeeName?: string;
    note?: string;
    transactionRef?: string;
    currency?: string;
}

export const buildUpiPaymentUri = (options: BuildUpiPaymentUriOptions): string | null => {
    const normalizedUpiId = sanitizeUpiId(options.upiId);
    if (!isValidUpiId(normalizedUpiId)) return null;
    if (!Number.isFinite(options.amount) || options.amount <= 0) return null;

    const params = new URLSearchParams();
    params.set('pa', normalizedUpiId);
    params.set('am', options.amount.toFixed(2));
    params.set('cu', (options.currency || 'INR').toUpperCase());

    if (options.payeeName?.trim()) {
        params.set('pn', options.payeeName.trim().slice(0, 80));
    }
    if (options.note?.trim()) {
        params.set('tn', options.note.trim().slice(0, 120));
    }
    if (options.transactionRef?.trim()) {
        params.set('tr', options.transactionRef.trim().slice(0, 80));
    }

    return `upi://pay?${params.toString()}`;
};

export const buildUpiQrImageUrl = (payload: string, size = 280): string => {
    const dimension = Math.max(128, Math.min(512, Math.round(size)));
    return `https://api.qrserver.com/v1/create-qr-code/?size=${dimension}x${dimension}&data=${encodeURIComponent(payload)}`;
};
