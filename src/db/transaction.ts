const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        const value = (error as { message?: unknown }).message;
        if (typeof value === 'string') return value;
    }
    return '';
};

const isUnsupportedTransactionError = (error: unknown): boolean => {
    const message = extractErrorMessage(error).toLowerCase();
    return (
        message.includes('no transaction support') ||
        message.includes('transaction support in neon http driver') ||
        message.includes('transactions are not supported')
    );
};

type TransactionCapable<TDb> = TDb & {
    transaction?: <TResult>(callback: (tx: unknown) => Promise<TResult>) => Promise<TResult>;
};

export const withTransaction = async <TDb, TResult>(
    db: TDb,
    callback: (tx: TDb) => Promise<TResult>
): Promise<TResult> => {
    const candidate = db as TransactionCapable<TDb>;

    if (typeof candidate.transaction !== 'function') {
        return callback(db);
    }

    try {
        return await candidate.transaction((tx) => callback(tx as TDb));
    } catch (error) {
        if (isUnsupportedTransactionError(error)) {
            return callback(db);
        }
        throw error;
    }
};

