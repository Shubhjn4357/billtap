import { useMemo } from 'react';
import type { SettingsSection } from '../constants/enums';
import { asSettingsRecord, useSettingsSectionQuery } from './useSettingsSection';

export function useSettingsSelector<T>(
    section: SettingsSection,
    selector: (data: Record<string, unknown>) => T
) {
    const query = useSettingsSectionQuery(section);

    const sectionData = useMemo(
        () => asSettingsRecord(query.data?.data),
        [query.data?.data]
    );
    const selected = useMemo(
        () => selector(sectionData),
        [sectionData, selector]
    );

    return {
        ...query,
        sectionData,
        selected,
    };
}
