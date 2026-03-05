import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import { saveThemePreference, type ThemePreference } from '../constants/theme';

const LOCAL_PREFERENCES_KEY = 'vahi_local_preferences_v1';

export type LocalPreferences = {
    themeMode: ThemePreference;
    richMotionEnabled: boolean;
    hapticsEnabled: boolean;
};

export const DEFAULT_LOCAL_PREFERENCES: LocalPreferences = {
    themeMode: 'system',
    richMotionEnabled: true,
    hapticsEnabled: true,
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

const normalizeTheme = (value: unknown): ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system' ? value : 'system';

const normalizePreferences = (value: unknown): LocalPreferences => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_LOCAL_PREFERENCES;
    const source = value as Record<string, unknown>;
    return {
        themeMode: normalizeTheme(source.themeMode),
        richMotionEnabled: normalizeBoolean(source.richMotionEnabled, DEFAULT_LOCAL_PREFERENCES.richMotionEnabled),
        hapticsEnabled: normalizeBoolean(source.hapticsEnabled, DEFAULT_LOCAL_PREFERENCES.hapticsEnabled),
    };
};

export const getLocalPreferences = async (): Promise<LocalPreferences> => {
    const raw = await offlineKeyValueStore.getItem(LOCAL_PREFERENCES_KEY);
    if (!raw) return DEFAULT_LOCAL_PREFERENCES;
    try {
        return normalizePreferences(JSON.parse(raw));
    } catch {
        return DEFAULT_LOCAL_PREFERENCES;
    }
};

export const setLocalPreferences = async (prefs: LocalPreferences): Promise<LocalPreferences> => {
    const normalized = normalizePreferences(prefs);
    await offlineKeyValueStore.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(normalized));
    await saveThemePreference(normalized.themeMode);
    return normalized;
};

export const patchLocalPreferences = async (patch: Partial<LocalPreferences>): Promise<LocalPreferences> => {
    const current = await getLocalPreferences();
    const next = normalizePreferences({
        ...current,
        ...patch,
    });
    return setLocalPreferences(next);
};
