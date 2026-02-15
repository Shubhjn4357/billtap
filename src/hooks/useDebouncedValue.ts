import { useEffect, useState } from 'react';

export const useDebouncedValue = <T>(value: T, delayMs = 250): T => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedValue(value), delayMs);
        return () => clearTimeout(handle);
    }, [value, delayMs]);

    return debouncedValue;
};
