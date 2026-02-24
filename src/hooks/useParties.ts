import { useState, useCallback, useEffect } from 'react';
import { Party } from '../types';
import { partyRepository } from '../repositories/partyRepository';
import { useAuth } from './useAuth';
import { useOrganizationStore } from '../store';

export const useParties = () => {
    const { user } = useAuth();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationId = selectedOrganizationId ?? user?.uid ?? null;
    const [parties, setParties] = useState<Party[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchParties = useCallback(async () => {
        if (!organizationId) return;
        setLoading(true);
        try {
            const data = await partyRepository.getAll(organizationId);
            setParties(data as unknown as Party[]);
        } catch (e) {
            console.error('Failed to load parties:', e);
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        fetchParties();
    }, [fetchParties]);

    return { parties, loading, fetchParties };
};
