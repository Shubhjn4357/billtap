import type { QueryClient } from '@tanstack/react-query';
import { api, isCloudWriteBlockedError, toApiError } from '../api/client';
import { isOfflineLikeError, offlineSyncService } from '../services/offlineSyncService';
import { queryClient } from '../state/queryClient';
import { settingsSchemaQueryKey, settingsSectionQueryKey } from '../state/settingsQueryKeys';
import type { ApiOkResponse, ApiResponse, SettingsFieldDefinition } from '../types/api';
import type { BusinessSettingsMap } from '../types/domain';
import { isOnline } from '../utils/network';
import { auditRepository } from './auditRepository';

type SettingsSchemaResponse = {
    ok: boolean;
    sections: string[];
    schema: Record<string, SettingsFieldDefinition[]>;
};

export const asSettingsRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const queueAndAttemptSync = async (
    mutation: Parameters<typeof offlineSyncService.enqueueMutation>[0],
    successMessage: string
) => {
    await offlineSyncService.enqueueMutation(mutation);
    void offlineSyncService.flushQueue();
    return {
        ok: true,
        message: successMessage,
        syncQueued: true,
    };
};

const shouldKeepLocalWriteOnError = (error: unknown) =>
    isOfflineLikeError(error) || isCloudWriteBlockedError(error);

const writeSettingsSectionQueryCache = (
    section: string,
    data: Record<string, unknown>
) => {
    const normalizedSection = section.toUpperCase();
    const payload = { ok: true, data };
    queryClient.setQueryData(settingsSectionQueryKey(normalizedSection), payload);
    if (section !== normalizedSection) {
        queryClient.setQueryData(settingsSectionQueryKey(section), payload);
    }
};

const cacheSettingsSections = async (all: BusinessSettingsMap) => {
    for (const [section, sectionData] of Object.entries(all)) {
        const normalizedSection = section.toUpperCase();
        const data = asSettingsRecord(sectionData);
        await offlineSyncService.setCachedSettingsSection(normalizedSection, data);
        writeSettingsSectionQueryCache(normalizedSection, data);
    }
};

export const settingsRepository = {
    getSchema: async (): Promise<SettingsSchemaResponse> => {
        try {
            const response = await api.get<SettingsSchemaResponse>('/api/settings/schema');
            queryClient.setQueryData(settingsSchemaQueryKey, response);
            return response;
        } catch (error) {
            const cached = queryClient.getQueryData<SettingsSchemaResponse>(settingsSchemaQueryKey);
            if (cached) {
                return cached;
            }
            throw error;
        }
    },

    getAll: async (): Promise<ApiResponse<BusinessSettingsMap>> => {
        try {
            const response = await api.get<ApiResponse<BusinessSettingsMap>>('/api/settings');
            const all = response.data ?? {};
            await cacheSettingsSections(all);
            return response;
        } catch {
            const cached = await offlineSyncService.getAllCachedSettings();
            await cacheSettingsSections(cached);
            return { ok: true, data: cached };
        }
    },

    get: async (section: string): Promise<ApiResponse<Record<string, unknown>>> => {
        const normalizedSection = section.toUpperCase();
        try {
            const response = await api.get<ApiResponse<Record<string, unknown>>>(`/api/settings/${normalizedSection}`);
            const sectionData = asSettingsRecord(response.data);
            await offlineSyncService.setCachedSettingsSection(normalizedSection, sectionData);
            writeSettingsSectionQueryCache(normalizedSection, sectionData);
            return {
                ...response,
                data: sectionData,
            };
        } catch {
            const cached = await offlineSyncService.getCachedSettingsSection(normalizedSection);
            writeSettingsSectionQueryCache(normalizedSection, cached);
            return { ok: true, data: cached };
        }
    },

    getSection: async (section: string) => settingsRepository.get(section),

    update: async (
        section: string,
        body: { data: Record<string, unknown> }
    ): Promise<ApiResponse<Record<string, unknown>>> => {
        const normalizedSection = section.toUpperCase();
        const cached = await offlineSyncService.getCachedSettingsSection(normalizedSection);
        const previousData = asSettingsRecord(cached);
        const mergedData = {
            ...previousData,
            ...asSettingsRecord(body.data),
        };
        let syncMessage = 'Settings saved locally. Sync pending.';

        await offlineSyncService.setCachedSettingsSection(normalizedSection, mergedData);
        writeSettingsSectionQueryCache(normalizedSection, mergedData);

        // Dispatched audit trace without blocking the main thread execution
        void auditRepository.logSettingChange(normalizedSection, mergedData).catch(() => null);

        if (await isOnline()) {
            try {
                const response = await api.put<ApiResponse<Record<string, unknown>>>(
                    `/api/settings/${normalizedSection}`,
                    { data: mergedData }
                );
                const savedData = asSettingsRecord(response.data);
                await offlineSyncService.setCachedSettingsSection(normalizedSection, savedData);
                writeSettingsSectionQueryCache(normalizedSection, savedData);
                return {
                    ...response,
                    data: savedData,
                };
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[settings] online save failed', {
                        section: normalizedSection,
                        payload: mergedData,
                        error: toApiError(error),
                    });
                    await offlineSyncService.setCachedSettingsSection(normalizedSection, previousData);
                    writeSettingsSectionQueryCache(normalizedSection, previousData);
                    throw error;
                }

                console.warn('[settings] keeping local settings write after cloud rejection', {
                    section: normalizedSection,
                    payload: mergedData,
                    error: toApiError(error),
                });
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Settings saved locally. Cloud sync blocked by subscription.';
                }
            }
        }

        await queueAndAttemptSync(
            {
                type: 'update_settings_section',
                payload: { section: normalizedSection, data: mergedData },
            },
            syncMessage
        );

        return {
            ok: true,
            data: mergedData,
            message: syncMessage,
        };
    },

    updateSection: async (section: string, data: Record<string, unknown>) =>
        settingsRepository.update(section, { data }),

    resetSection: async (section: string): Promise<ApiOkResponse> => {
        const normalizedSection = section.toUpperCase();
        const previousData = await offlineSyncService.getCachedSettingsSection(normalizedSection);
        await offlineSyncService.setCachedSettingsSection(normalizedSection, {});
        writeSettingsSectionQueryCache(normalizedSection, {});

        if (await isOnline()) {
            try {
                const response = await api.delete<ApiOkResponse>(`/api/settings/${normalizedSection}`);
                return response;
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    await offlineSyncService.setCachedSettingsSection(normalizedSection, previousData);
                    writeSettingsSectionQueryCache(normalizedSection, previousData);
                    throw error;
                }
            }
        }

        const syncMessage = 'Settings reset locally. Sync pending.';
        await queueAndAttemptSync(
            {
                type: 'update_settings_section',
                payload: { section: normalizedSection, data: {} },
            },
            syncMessage
        );

        return {
            ok: true,
            message: syncMessage,
        };
    },
};

export const saveSettingsSection = async (
    section: string,
    data: Record<string, unknown>,
    scopedQueryClient?: QueryClient
) => {
    const response = await settingsRepository.update(section, { data });
    const normalizedSection = section.toUpperCase();
    scopedQueryClient?.setQueryData(settingsSectionQueryKey(normalizedSection), {
        ok: true,
        data: asSettingsRecord(response.data),
    });
    return response;
};
