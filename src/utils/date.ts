export const toDateSafe = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' || typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
        return (value as { toDate: () => Date }).toDate();
    }
    return null;
};

export const addMonths = (date: Date, months: number): Date => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
};

