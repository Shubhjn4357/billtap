import { useEffect, useMemo, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SettingsSection } from '../constants/enums';
import { settingsRepository } from '../repositories/settingsRepository';
import { settingsSchemaQueryKey, settingsSectionQueryKey } from '../state/settingsQueryKeys';

export const asSettingsRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const useIsOffline = () => {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setIsOffline(!(Boolean(state.isConnected) && state.isInternetReachable !== false));
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
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        enabled: normalizedSection.length > 0,
    });
}

export function useSettingsSection(section: SettingsSection | string) {
    const normalizedSection = String(section ?? '').toUpperCase();
    const queryClient = useQueryClient();
    const isOffline = useIsOffline();
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
