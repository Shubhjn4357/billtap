/**
 * useSettingsSection - settings schema + section data hook with offline fallback.
 *
 * Combines the schema query and section data query. Serves cached data
 * when offline, and exposes `isOffline` so the UI can show a banner.
 */

import { useEffect, useMemo, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/endpoints';
import type { SettingsSection } from '../constants/enums';

export function useSettingsSection(section: SettingsSection | string) {
  const qc = useQueryClient();
  const [isOffline, setIsOffline] = useState(false);

  // NetInfo-based offline detection
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOffline(!(Boolean(state.isConnected) && state.isInternetReachable !== false));
    });

    return () => {
      unsub();
    };
  }, []);

  // Schema query - long stale time, offline returns cached
  const schemaQuery = useQuery({
    queryKey: ['settings-schema'],
    queryFn: () => settingsApi.getSchema(),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  // Section data query
  const sectionQuery = useQuery({
    queryKey: ['settings-section', section],
    queryFn: () => settingsApi.getSection(section as SettingsSection),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    enabled: Boolean(section),
  });

  const isLoading = schemaQuery.isLoading || sectionQuery.isLoading;
  const isRefreshing = schemaQuery.isRefetching || sectionQuery.isRefetching;

  const schema = useMemo(() => schemaQuery.data?.schema ?? {}, [schemaQuery.data]);
  const sectionFields = useMemo(() => (schema[section] ?? []) as unknown[], [schema, section]);
  const sectionData = useMemo(
    () => (sectionQuery.data?.data ?? {}) as Record<string, unknown>,
    [sectionQuery.data]
  );

  const refetch = async () => {
    await Promise.all([schemaQuery.refetch(), sectionQuery.refetch()]);
  };

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['settings-section', section] });
  };

  return {
    isLoading,
    isRefreshing,
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
