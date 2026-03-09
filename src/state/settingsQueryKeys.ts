import type { SettingsSection } from '../constants/enums';

export const settingsSchemaQueryKey = ['settings-schema'] as const;

export const settingsSectionQueryKey = (section: SettingsSection | string) =>
    ['settings-section', String(section).toUpperCase()] as const;
