import { useMemo } from 'react';
import { APP_LANGUAGE_OPTIONS } from '../constants/appPreferences';
import { translateAppCopy } from '../constants/appCopy';
import { useAppRuntime } from '../components/providers/AppRuntimeProvider';

export function useI18n() {
    const { localPreferences } = useAppRuntime();
    const language = localPreferences.appLanguage;

    return useMemo(() => ({
        language,
        languages: APP_LANGUAGE_OPTIONS,
        t: (key: string, params?: Record<string, string | number>) =>
            translateAppCopy(language, key, params),
    }), [language]);
}
