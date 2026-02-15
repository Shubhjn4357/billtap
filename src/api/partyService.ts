import type { Party } from '../types';
import { apiClient } from './httpClient';

export const partyService = {
    async getParties(queryText?: string): Promise<Party[]> {
        const query = queryText?.trim()
            ? `?q=${encodeURIComponent(queryText.trim())}`
            : '';
        const response = await apiClient.get<{
            ok: boolean;
            parties?: Party[];
            message?: string;
        }>(`/parties${query}`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch parties.');
        }
        return response.parties ?? [];
    },

    async getParty(id: string): Promise<Party | null> {
        const parties = await this.getParties();
        return parties.find((entry) => entry.id === id) ?? null;
    },

    async createParty(payload: Omit<Party, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
        const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/parties', payload);
        if (!response.ok || !response.id) {
            throw new Error(response.message || 'Failed to create party.');
        }
        return response.id;
    },

    async updateParty(id: string, payload: Partial<Party>): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/parties/${id}`, payload);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update party.');
        }
    },

    async archiveParty(id: string): Promise<void> {
        await this.updateParty(id, { isActive: false });
    },
};
