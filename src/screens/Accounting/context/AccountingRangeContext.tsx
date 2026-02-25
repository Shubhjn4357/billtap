import React, { createContext, useContext, useMemo, useState } from 'react';

interface AccountingRangeContextValue {
    startDate?: Date;
    endDate?: Date;
    setStartDate: (value?: Date) => void;
    setEndDate: (value?: Date) => void;
    setRange: (start?: Date, end?: Date) => void;
    clearRange: () => void;
    startKey?: string;
    endKey?: string;
    rangeLabel: string;
}

const AccountingRangeContext = createContext<AccountingRangeContextValue | null>(null);

const toKey = (value?: Date): string | undefined => {
    if (!value) return undefined;
    return value.toISOString().slice(0, 10);
};

const toLabel = (value?: Date): string => {
    if (!value) return 'Any';
    return value.toLocaleDateString();
};

export const AccountingRangeProvider = ({ children }: { children: React.ReactNode }) => {
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    const value = useMemo<AccountingRangeContextValue>(() => ({
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        setRange: (start, end) => {
            setStartDate(start);
            setEndDate(end);
        },
        clearRange: () => {
            setStartDate(undefined);
            setEndDate(undefined);
        },
        startKey: toKey(startDate),
        endKey: toKey(endDate),
        rangeLabel: `${toLabel(startDate)} - ${toLabel(endDate)}`,
    }), [endDate, startDate]);

    return (
        <AccountingRangeContext.Provider value={value}>
            {children}
        </AccountingRangeContext.Provider>
    );
};

export const useAccountingRange = (): AccountingRangeContextValue => {
    const context = useContext(AccountingRangeContext);
    if (!context) {
        throw new Error('useAccountingRange must be used inside AccountingRangeProvider.');
    }
    return context;
};
