import type { Party } from '../types';
import { isOnline } from '../utils/network';
import { isNetworkLikeError } from '../utils/errorGuards';
import { apiClient } from './httpClient';
import { offlineSyncService } from './offlineSyncService';

type PartyCreatePayload = Omit<Party, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    userId?: string;
};

const normalizeParty = (party: Party): Party => ({
    ...party,
    isActive: party.isActive !== false,
    updatedAt: party.updatedAt ?? new Date().toISOString(),
});

const mergeParty = (existing: Party | undefined, id: string, payload: Partial<Party>): Party => {
    const now = new Date().toISOString();
    return normalizeParty({
        id,
        userId: payload.userId ?? existing?.userId ?? '',
        name: payload.name ?? existing?.name ?? '',
        type: payload.type ?? existing?.type ?? 'customer',
        phone: payload.phone ?? existing?.phone,
        email: payload.email ?? existing?.email,
        address: payload.address ?? existing?.address,
        gstNumber: payload.gstNumber ?? existing?.gstNumber,
        isActive: payload.isActive ?? existing?.isActive ?? true,
        createdAt: payload.createdAt ?? existing?.createdAt ?? now,
        updatedAt: payload.updatedAt ?? now,
    });
};

export const partyService = {
    async getParties(queryText?: string): Promise<Party[]> {
        const query = queryText?.trim()
            ? `?q=${encodeURIComponent(queryText.trim())}`
            : '';

        if (await isOnline()) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.get<{
                    ok: boolean;
                    parties?: Party[];
                    message?: string;
                }>(`/parties${query}`);

                if (!response.ok) {
                    throw new Error(response.message || 'Failed to fetch parties.');
                }

                const normalized = (response.parties ?? []).map(normalizeParty);
                await offlineSyncService.setCachedParties(normalized);
                return normalized;
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        const cached = await offlineSyncService.getCachedParties();
        if (!queryText?.trim()) return cached;
        const needle = queryText.trim().toLowerCase();
        return cached.filter((entry) =>
            entry.name.toLowerCase().includes(needle)
            || (entry.phone?.includes(needle) ?? false)
        );
    },

    async getParty(id: string): Promise<Party | null> {
        const cached = await offlineSyncService.getCachedParties();
        const local = cached.find((entry) => entry.id === id);
        if (local) return local;
        const parties = await this.getParties();
        return parties.find((entry) => entry.id === id) ?? null;
    },

    async createParty(payload: PartyCreatePayload): Promise<string> {
        const localId = payload.id ?? offlineSyncService.createLocalId('party');
        const normalizedPayload: PartyCreatePayload = {
            ...payload,
            id: localId,
            isActive: payload.isActive ?? true,
        };

        if (await isOnline()) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
                    '/parties',
                    normalizedPayload
                );
                if (!response.ok || !response.id) {
                    throw new Error(response.message || 'Failed to create party.');
                }

                const nextParty = mergeParty(undefined, response.id, {
                    ...normalizedPayload,
                    id: response.id,
                    userId: normalizedPayload.userId ?? '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                await offlineSyncService.upsertCachedParty(nextParty);
                return response.id;
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        const nextParty = mergeParty(undefined, localId, {
            ...normalizedPayload,
            userId: normalizedPayload.userId ?? '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        await offlineSyncService.upsertCachedParty(nextParty);
        await offlineSyncService.enqueueMutation({
            type: 'upsert_party',
            payload: {
                id: localId,
                userId: nextParty.userId,
                name: nextParty.name,
                type: nextParty.type,
                phone: nextParty.phone,
                email: nextParty.email,
                address: nextParty.address,
                gstNumber: nextParty.gstNumber,
                isActive: nextParty.isActive,
            },
        });
        return localId;
    },

    async updateParty(id: string, payload: Partial<Party>): Promise<void> {
        const cached = await offlineSyncService.getCachedParties();
        const existing = cached.find((entry) => entry.id === id);
        const merged = mergeParty(existing, id, payload);
        await offlineSyncService.upsertCachedParty(merged);

        if (await isOnline()) {
            try {
                const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/parties/${id}`, payload);
                if (!response.ok) {
                    throw new Error(response.message || 'Failed to update party.');
                }
                return;
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        await offlineSyncService.enqueueMutation({
            type: 'upsert_party',
            payload: {
                id: merged.id,
                userId: merged.userId,
                name: merged.name,
                type: merged.type,
                phone: merged.phone,
                email: merged.email,
                address: merged.address,
                gstNumber: merged.gstNumber,
                isActive: merged.isActive,
            },
        });
    },

    async archiveParty(id: string): Promise<void> {
        await offlineSyncService.archiveCachedParty(id);

        if (await isOnline()) {
            try {
                const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/parties/${id}`, { isActive: false });
                if (!response.ok) {
                    throw new Error(response.message || 'Failed to archive party.');
                }
                return;
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        await offlineSyncService.enqueueMutation({
            type: 'archive_party',
            payload: { id },
        });
    },
};
