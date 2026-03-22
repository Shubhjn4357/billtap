import { api, getStoredBusinessId } from '../api/client';
import {
    mapLegacyOrganizationToBusiness,
} from '../mappers/authMappers';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import { getRuntimeSessionSnapshot } from '../services/runtimeSession';
import { organizationQueryKeys } from '../state/domainQueryKeys';
import { queryClient } from '../state/queryClient';
import type {
    ApiListResponse,
    ApiOkResponse,
    ApiResponse,
} from '../types/api';
import type {
    Business,
    Plan,
} from '../types/domain';
import { subscriptionRepository } from './subscriptionRepository';

const BUSINESS_CACHE_KEYS = {
    list: 'vahi_businesses_cache_v1',
    current: (businessId: string) => `vahi_current_business_v1::${businessId}`,
};

const readCachedJson = async <T>(key: string): Promise<T | null> => {
    const raw = await offlineKeyValueStore.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const writeCachedJson = async (key: string, value: unknown) => {
    await offlineKeyValueStore.setItem(key, JSON.stringify(value));
};

const requireOrganizationPayload = (
    response: { ok: boolean; organization?: Record<string, unknown>; message?: string },
    fallbackMessage: string
) => {
    if (!response.ok || !response.organization) {
        throw new Error(response.message ?? fallbackMessage);
    }
    return response.organization;
};

export const businessRepository = {
    list: async (): Promise<ApiListResponse<Business>> => {
        try {
            const response = await api.get<{
                ok: boolean;
                organizations?: Record<string, unknown>[];
                message?: string;
            }>('/api/organizations/mine', {
                skipOrganizationHeader: true,
            });
            if (!response.ok) {
                throw new Error(response.message ?? 'Failed to load businesses.');
            }
            const data = (response.organizations ?? []).map((organization) =>
                mapLegacyOrganizationToBusiness(organization, 'unknown')
            );
            await writeCachedJson(BUSINESS_CACHE_KEYS.list, data);
            queryClient.setQueryData(organizationQueryKeys.mine(), { ok: true, data, message: response.message });
            return {
                ok: true,
                data,
                message: response.message,
            };
        } catch (error) {
            const cached = await readCachedJson<Business[]>(BUSINESS_CACHE_KEYS.list);
            if (cached?.length) {
                return {
                    ok: true,
                    data: cached,
                    message: 'Loaded businesses from offline cache.',
                };
            }
            const currentBusiness = getRuntimeSessionSnapshot().business;
            if (currentBusiness) {
                return {
                    ok: true,
                    data: [currentBusiness],
                    message: 'Loaded business from local session snapshot.',
                };
            }
            throw error;
        }
    },

    get: async (_id: string): Promise<ApiResponse<Business>> => {
        const currentBusinessId = (await getStoredBusinessId()) ?? _id ?? 'current';
        try {
            const response = await api.get<{
                ok: boolean;
                organization?: Record<string, unknown>;
                context?: {
                    settings?: Record<string, unknown>;
                };
                message?: string;
            }>('/api/organizations/current');
            const organization = requireOrganizationPayload(response, 'Failed to load current business.');
            const data = mapLegacyOrganizationToBusiness({
                ...organization,
                settings: response.context?.settings ?? organization.settings,
            }, 'unknown');
            await writeCachedJson(BUSINESS_CACHE_KEYS.current(currentBusinessId), data);
            return {
                ok: true,
                data,
                message: response.message,
            };
        } catch (error) {
            const authBusiness = getRuntimeSessionSnapshot().business;
            if (authBusiness) {
                return {
                    ok: true,
                    data: authBusiness,
                    message: 'Loaded business from local session snapshot.',
                };
            }
            const cachedCurrent = await readCachedJson<Business>(BUSINESS_CACHE_KEYS.current(currentBusinessId));
            if (cachedCurrent) {
                return {
                    ok: true,
                    data: cachedCurrent,
                    message: 'Loaded business from offline cache.',
                };
            }
            const cachedList = await readCachedJson<Business[]>(BUSINESS_CACHE_KEYS.list);
            const matched = cachedList?.find((entry) => entry.id === currentBusinessId);
            if (matched) {
                return {
                    ok: true,
                    data: matched,
                    message: 'Loaded business from offline cache.',
                };
            }
            throw error;
        }
    },

    create: async (data: Partial<Business>): Promise<ApiResponse<{ id: string }>> => {
        const response = await api.post<{ ok: boolean; id?: string; message?: string }>(
            '/api/organizations',
            {
                name: data.name,
                code: data.code,
                currency: data.currency,
                phoneNumber: data.phone ?? undefined,
                email: data.email ?? undefined,
                gstNumber: data.gstin ?? undefined,
                address: data.address ?? undefined,
                legalName: data.legalName ?? undefined,
                state: data.state ?? undefined,
                city: data.city ?? undefined,
                pincode: data.pincode ?? undefined,
                booksStartDate: data.booksStartDate ?? undefined,
                openingCashInHand: typeof data.openingCashInHand === 'number' ? data.openingCashInHand : undefined,
                openingCashInBank: typeof data.openingCashInBank === 'number' ? data.openingCashInBank : undefined,
            },
            {
                skipOrganizationHeader: true,
            }
        );
        if (!response.ok || !response.id) {
            throw new Error(response.message ?? 'Failed to create business.');
        }
        return {
            ok: true,
            data: { id: response.id },
            message: response.message,
        };
    },

    remove: async (id: string): Promise<ApiOkResponse> => {
        const response = await api.delete<{ ok: boolean; message?: string }>(`/api/organizations/${id}`, {
            skipOrganizationHeader: true,
        });
        if (!response.ok) {
            throw new Error(response.message ?? 'Failed to delete business.');
        }
        return {
            ok: true,
            message: response.message,
        };
    },

    update: async (id: string, data: Partial<Business>): Promise<ApiResponse<Business>> => {
        const response = await api.patch<{ ok: boolean; message?: string }>(`/api/organizations/${id}`, {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.code !== undefined ? { code: data.code } : {}),
            ...(data.currency !== undefined ? { currency: data.currency } : {}),
            ...(data.phone !== undefined ? { phoneNumber: data.phone } : {}),
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.gstin !== undefined ? { gstNumber: data.gstin } : {}),
            ...(data.address !== undefined ? { address: data.address } : {}),
            ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
            ...(data.state !== undefined ? { state: data.state } : {}),
            ...(data.city !== undefined ? { city: data.city } : {}),
            ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
            ...(data.booksStartDate !== undefined ? { booksStartDate: data.booksStartDate } : {}),
            ...(data.openingCashInHand !== undefined ? { openingCashInHand: data.openingCashInHand } : {}),
            ...(data.openingCashInBank !== undefined ? { openingCashInBank: data.openingCashInBank } : {}),
            ...(data.pan !== undefined ? { pan: data.pan } : {}),
            ...(data.category !== undefined ? { category: data.category } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        });
        if (!response.ok) {
            throw new Error(response.message ?? 'Failed to update business.');
        }
        return businessRepository.get(id);
    },

    getSubscription: async () => subscriptionRepository.get(),

    getPlans: async (): Promise<ApiListResponse<Plan>> => subscriptionRepository.getPlans(),
};
