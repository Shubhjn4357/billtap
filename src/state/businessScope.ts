export const resolveBusinessQueryScope = (
    businessId?: string | null,
): string =>
    typeof businessId === 'string' && businessId.trim()
        ? businessId.trim()
        : 'default';
