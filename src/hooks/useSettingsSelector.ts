/**
 * useSettingsSelector
 *
 * Derives a computed value from a settings section in the React Query cache.
 * 
 * Key design: the selector function is stabilized with useRef so
 * inline arrow functions passed from parent components do NOT cause
 * unnecessary re-renders. The selected value only updates when the
 * underlying settings data actually changes.
 */
import { useMemo, useRef } from 'react';
import type { SettingsSection } from '../constants/enums';
import { asSettingsRecord, useSettingsSectionQuery } from './useSettingsSection';

export function useSettingsSelector<T>(
    section: SettingsSection,
    selector: (data: Record<string, unknown>) => T
) {
    const query = useSettingsSectionQuery(section);

    // Stabilize the selector reference to avoid re-compute on every render
    // when the parent passes an inline arrow function
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const sectionData = useMemo(
        () => asSettingsRecord(query.data?.data),
        [query.data?.data]
    );

    const selected = useMemo(
        () => selectorRef.current(sectionData),
        [sectionData]
    );

    return {
        ...query,
        sectionData,
        selected,
    };
}
