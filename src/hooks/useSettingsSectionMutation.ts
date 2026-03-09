import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isCloudWriteBlockedError } from '../api/client';
import { saveSettingsSection } from '../repositories/settingsRepository';

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
        data: input,
        silent: false,
    };
};

export function useSettingsSectionMutation(section: string, options?: SettingsMutationOptions) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: SettingsMutationInput) => {
            const meta = normalizeMutationInput(input);
            try {
                return await saveSettingsSection(section, meta.data, queryClient);
            } catch (error) {
                if (isCloudWriteBlockedError(error)) {
                    return {
                        ok: true,
                        data: meta.data,
                        message: 'Settings saved locally. Cloud sync blocked by subscription.',
                    };
                }
                throw error;
            }
        },
        onSuccess: async (response, input) => {
            await options?.onSuccess?.(response, normalizeMutationInput(input));
        },
        onError: async (error, input) => {
            await options?.onError?.(error, normalizeMutationInput(input));
        },
    });
}
