/**
 * useSettingsSectionMutation
 *
 * Provides instant local-first settings mutation with:
 *  1. Synchronous optimistic cache update (zero-lag toggle)
 *  2. Background network write — never blocks the UI
 *  3. Error rollback to previous cache state
 *  4. No post-settle refetch that could stomp optimistic data
 *
 * Offline behaviour: writes are held in the offline queue by
 * settingsRepository.update() and flushed automatically when the
 * device reconnects (handled by backgroundSyncService / NetInfo listener).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isCloudWriteBlockedError } from '../api/client';
import { saveSettingsSection } from '../repositories/settingsRepository';
import { settingsSectionQueryKey } from '../state/settingsQueryKeys';

type SettingsMutationInput =
    | Record<string, unknown>
    | {
        data: Record<string, unknown>;
        silent?: boolean;
    };

type SettingsMutationMeta = {
    data: Record<string, unknown>;
    silent: boolean;
};

type SettingsMutationOptions = {
    onSuccess?: (
        response: Awaited<ReturnType<typeof saveSettingsSection>>,
        meta: SettingsMutationMeta
    ) => void | Promise<void>;
    onError?: (error: unknown, meta: SettingsMutationMeta) => void | Promise<void>;
};

const normalizeMutationInput = (input: SettingsMutationInput): SettingsMutationMeta => {
    const wrapped = input as { data?: unknown; silent?: boolean };
    const keys = Object.keys(input);
    const looksWrapped =
        keys.includes('data')
        && (keys.includes('silent') || keys.length <= 2)
        && wrapped.data
        && typeof wrapped.data === 'object'
        && !Array.isArray(wrapped.data);

    if (looksWrapped) {
        return {
            data: wrapped.data as Record<string, unknown>,
            silent: Boolean(wrapped.silent),
        };
    }

    return {
        data: input as Record<string, unknown>,
        silent: false,
    };
};

export function useSettingsSectionMutation(section: string, options?: SettingsMutationOptions) {
    const queryClient = useQueryClient();
    const queryKey = settingsSectionQueryKey(section.toUpperCase());

    return useMutation({
        mutationFn: async (input: SettingsMutationInput) => {
            const meta = normalizeMutationInput(input);
            try {
                // saveSettingsSection calls settingsRepository.update() which:
                // 1. Writes merged data to the offline cache synchronously
                // 2. Sets the React-Query cache via writeSettingsSectionQueryCache()
                // 3. If online → PUT to server; if offline → enqueues mutation
                return await saveSettingsSection(section, meta.data, queryClient);
            } catch (error) {
                if (isCloudWriteBlockedError(error)) {
                    // Subscription plan blocks cloud writes, but local write already committed
                    return {
                        ok: true,
                        data: meta.data,
                        message: 'Settings saved locally. Cloud sync blocked by subscription.',
                    };
                }
                throw error;
            }
        },

        onMutate: async (input) => {
            const meta = normalizeMutationInput(input);

            // Cancel any outgoing refetches so they don't overwrite optimistic update
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value for rollback
            const previousData = queryClient.getQueryData(queryKey);

            if (!meta.silent) {
                // Apply optimistic update synchronously — this is what the toggle sees instantly
                queryClient.setQueryData(queryKey, (old: unknown) => {
                    const prev = old as { ok?: boolean; data?: Record<string, unknown> } | undefined;
                    return {
                        ok: true,
                        data: {
                            ...(prev?.data ?? {}),
                            ...meta.data,
                        },
                    };
                });
            }

            return { previousData };
        },

        onSuccess: async (response, input) => {
            // Reconcile cache with the real server response data (only if server returned data)
            const responseData = (response as { data?: Record<string, unknown> }).data;
            if (responseData && typeof responseData === 'object') {
                queryClient.setQueryData(queryKey, { ok: true, data: responseData });
            }
            await options?.onSuccess?.(response, normalizeMutationInput(input));
        },

        onError: async (error, input, context) => {
            // Roll back to previous state on genuine failure
            if (context?.previousData !== undefined) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            await options?.onError?.(error, normalizeMutationInput(input));
        },

        // NOTE: we intentionally do NOT invalidate/refetch onSettled.
        // The cache is already correct after onMutate (optimistic) and
        // reconciled by onSuccess. A refetch here would re-introduce the lag
        // the user reported (stale server data overwriting the optimistic value).
    });
}
