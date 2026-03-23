/**
 * useSettingsSection
 *
 * Provides real-time settings queries with:
 *  - staleTime: 0 — always reflects latest cache write (instant cross-module reactivity)
 *  - gcTime: 10min — data stays alive in cache for dormant screens
 *  - NetInfo reconnect listener: when device goes online, flushes the offline queue
 *    so any settings changes made offline are uploaded automatically
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SettingsSection } from '../constants/enums';
import { settingsRepository } from '../repositories/settingsRepository';
import { settingsSchemaQueryKey, settingsSectionQueryKey } from '../state/settingsQueryKeys';
import { offlineSyncService } from '../services/offlineSyncService';

export const asSettingsRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

/** Tracks online/offline state and auto-flushes offline queue on reconnect */
const useNetworkSync = () => {
    const [isOffline, setIsOffline] = useState(false);
    const wasOfflineRef = useRef(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const offline = !(Boolean(state.isConnected) && state.isInternetReachable !== false);
            setIsOffline(offline);

            // Transition: offline → online → trigger immediate sync flush
            if (wasOfflineRef.current && !offline) {
                void offlineSyncService.flushQueue().catch(() => null);
            }
            wasOfflineRef.current = offline;
        });
        return unsubscribe;
    }, []);

    return isOffline;
};

export function useSettingsSchemaQuery() {
    return useQuery({
        queryKey: settingsSchemaQueryKey,
        queryFn: () => settingsRepository.getSchema(),
        staleTime: 30 * 60_000,
        gcTime: 60 * 60_000,
    });
}

export function useSettingsSectionQuery(section: SettingsSection | string) {
    const normalizedSection = String(section ?? '').toUpperCase();

    return useQuery({
        queryKey: settingsSectionQueryKey(normalizedSection),
        queryFn: () => settingsRepository.getSection(normalizedSection as SettingsSection),
        // staleTime: 0 means any setQueryData() call (from mutations, reconnect, etc.)
        // will immediately be seen by all subscribers — zero lag cross-module reactivity
        staleTime: 0,
        gcTime: 10 * 60_000,
        // Only refetch on window focus when online; offline reads come from cache
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        enabled: normalizedSection.length > 0,
    });
}

export function useSettingsSection(section: SettingsSection | string) {
    const normalizedSection = String(section ?? '').toUpperCase();
    const queryClient = useQueryClient();
    const isOffline = useNetworkSync();
    const schemaQuery = useSettingsSchemaQuery();
    const sectionQuery = useSettingsSectionQuery(normalizedSection);

    const schema = useMemo(() => schemaQuery.data?.schema ?? {}, [schemaQuery.data]);
    const sectionFields = useMemo(
        () => (schema[normalizedSection] ?? []) as unknown[],
        [normalizedSection, schema]
    );
    const sectionData = useMemo(
        () => asSettingsRecord(sectionQuery.data?.data),
        [sectionQuery.data?.data]
    );

    const refetch = async () => {
        await Promise.all([schemaQuery.refetch(), sectionQuery.refetch()]);
    };

    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey: settingsSectionQueryKey(normalizedSection) });
    };

    return {
        isLoading: schemaQuery.isLoading || sectionQuery.isLoading,
        isRefreshing: schemaQuery.isRefetching || sectionQuery.isRefetching,
        isOffline,
        schema,
        sectionFields,
        sectionData,
        schemaResponse: schemaQuery.data,
        sectionResponse: sectionQuery.data,
        refetch,
        invalidate,
    };
}
