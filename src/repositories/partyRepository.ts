import { api } from '../api/client';
import { offlineSyncService } from '../services/offlineSyncService';
import type { PaginationParams } from '../types/api';
import type { Party } from '../types/domain';

type PartyListParams = { q?: string; type?: string; includeInactive?: boolean } & PaginationParams;
type PartyRecycleBinParams = PaginationParams;
type PartyCreateInput = Omit<Party, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'loyaltyPoints'>;
type PartyUpdateInput = Partial<Party>;

const nowIso = () => new Date().toISOString();

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

const mapRemoteParty = (raw: Record<string, unknown>, fallbackId?: string, forceInactive = false): Party => ({
    id: String(raw.id ?? fallbackId ?? ''),
    businessId: String(raw.businessId ?? 'unknown'),
    type:
        String(raw.type).toUpperCase() === 'SUPPLIER' || String(raw.type).toLowerCase() === 'supplier'
            ? 'SUPPLIER'
            : 'CUSTOMER',
    name: String(raw.name ?? ''),
    phone: raw.phone ? String(raw.phone) : null,
    email: raw.email ? String(raw.email) : null,
    billingAddress: raw.address ? String(raw.address) : null,
    shippingAddress: raw.shippingAddress ? String(raw.shippingAddress) : null,
    gstin: raw.gstNumber ? String(raw.gstNumber) : raw.gstin ? String(raw.gstin) : null,
    openingBalance: Number(raw.openingBalance ?? 0),
    creditLimit: Number(raw.creditLimit ?? 0),
    loyaltyPoints: Number(raw.loyaltyPoints ?? 0),
    isActive: forceInactive ? false : Boolean(raw.isActive ?? true),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
});

const toPartySyncPayload = (party: Party): Record<string, unknown> & { id: string } => ({
    id: party.id,
    type: party.type === 'SUPPLIER' ? 'supplier' : 'customer',
    name: party.name,
    phone: party.phone ?? undefined,
    email: party.email ?? undefined,
    address: party.billingAddress ?? undefined,
    gstNumber: party.gstin ?? undefined,
    isActive: party.isActive,
});

const buildLocalParty = (params: {
    id: string;
    input: Partial<Party> & { name: string; type: Party['type'] };
    base?: Party;
}): Party => {
    const { id, input, base } = params;
    const now = nowIso();
    return {
        id,
        businessId: base?.businessId ?? 'offline',
        type: input.type,
        name: input.name,
        phone: input.phone ?? base?.phone ?? null,
        email: input.email ?? base?.email ?? null,
        billingAddress: input.billingAddress ?? base?.billingAddress ?? null,
        shippingAddress: input.shippingAddress ?? base?.shippingAddress ?? null,
        gstin: input.gstin ?? base?.gstin ?? null,
        openingBalance: Number(input.openingBalance ?? base?.openingBalance ?? 0),
        creditLimit: Number(input.creditLimit ?? base?.creditLimit ?? 0),
        loyaltyPoints: Number(input.loyaltyPoints ?? base?.loyaltyPoints ?? 0),
        isActive: Boolean(input.isActive ?? base?.isActive ?? true),
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
    };
};

const mergeCachedParties = async (parties: Party[]) => {
    const current = await offlineSyncService.getCachedParties();
    const merged = new Map(current.map((party) => [party.id, party]));
    parties.forEach((party) => {
        merged.set(party.id, party);
    });
    await offlineSyncService.setCachedParties(Array.from(merged.values()));
};

const filterCachedParties = (
    parties: Party[],
    params?: PartyListParams,
    mode: 'active' | 'recycle-bin' = 'active'
) => {
    const needle = String(params?.q ?? '').trim().toLowerCase();
    const requestedType = String(params?.type ?? '').trim().toUpperCase();
    const includeInactive = Boolean(params?.includeInactive);
    const limit = typeof params?.limit === 'number' ? params.limit : undefined;

    let filtered = parties.filter((party) => {
        if (mode === 'recycle-bin') {
            return party.isActive === false;
        }
        if (!includeInactive && party.isActive === false) {
            return false;
        }
        return true;
    });

    if (requestedType) {
        filtered = filtered.filter((party) => String(party.type ?? '').toUpperCase() === requestedType);
    }

    if (needle) {
        filtered = filtered.filter((party) =>
            [party.name, party.phone, party.email, party.gstin]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle))
        );
    }

    filtered = [...filtered].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
};

const listRemote = async (params?: PartyListParams) => {
    const mappedType =
        params?.type?.toLowerCase() === 'customer'
            ? 'customer'
            : params?.type?.toLowerCase() === 'supplier'
                ? 'supplier'
                : params?.type;
    const res = await api.get<{ ok: boolean; parties: Record<string, unknown>[] }>('/api/parties', {
        params: { ...params, type: mappedType },
    });
    return {
        ok: res.ok,
        data: (res.parties ?? []).map((raw) => mapRemoteParty(raw)),
    };
};

const recycleBinRemote = async (params?: PartyRecycleBinParams) => {
    const res = await api.get<{ ok: boolean; parties: Record<string, unknown>[] }>('/api/parties/recycle-bin', {
        params,
    });
    return {
        ok: res.ok,
        data: (res.parties ?? []).map((raw) => mapRemoteParty(raw, undefined, true)),
    };
};

const getRemote = async (id: string) => {
    const res = await api.get<{ ok: boolean; party: Record<string, unknown> }>(`/api/parties/${id}`);
    return {
        ok: res.ok,
        data: mapRemoteParty(res.party ?? {}, id),
    };
};

export const partyRepository = {
    listRemote,
    recycleBinRemote,
    getRemote,
    list: async (params?: PartyListParams) => {
        try {
            const response = await listRemote(params);
            await mergeCachedParties(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedParties();
            if (cached.length > 0) {
                return { ok: true, data: filterCachedParties(cached, params, 'active') };
            }
            throw error;
        }
    },
    recycleBin: async (params?: PartyRecycleBinParams) => {
        try {
            const response = await recycleBinRemote(params);
            await mergeCachedParties(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedParties();
            const archived = filterCachedParties(cached, params, 'recycle-bin');
            if (archived.length > 0) {
                return { ok: true, data: archived };
            }
            throw error;
        }
    },
    get: async (id: string) => {
        try {
            const response = await getRemote(id);
            if (response.data) {
                await offlineSyncService.upsertCachedParty(response.data);
            }
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedParties();
            const party = cached.find((entry) => entry.id === id);
            if (party) {
                return { ok: true, data: party };
            }
            throw error;
        }
    },
    create: async (data: PartyCreateInput) => {
        const localParty = buildLocalParty({
            id: offlineSyncService.createLocalId('party'),
            input: { ...data, type: data.type, name: data.name },
        });
        await offlineSyncService.upsertCachedParty(localParty);
        await queueAndAttemptSync(
            {
                type: 'upsert_party',
                payload: toPartySyncPayload(localParty),
            },
            'Party saved locally. Sync pending.'
        );
        return { ok: true, data: localParty, message: 'Party saved locally. Sync pending.' };
    },
    update: async (id: string, data: PartyUpdateInput) => {
        const cached = await offlineSyncService.getCachedParties();
        const base = cached.find((entry) => entry.id === id);
        const localParty = buildLocalParty({
            id,
            input: {
                ...(base ?? {}),
                ...data,
                type: data.type ?? base?.type ?? 'CUSTOMER',
                name: data.name ?? base?.name ?? 'Party',
            },
            base,
        });
        await offlineSyncService.upsertCachedParty(localParty);
        await queueAndAttemptSync(
            {
                type: 'upsert_party',
                payload: toPartySyncPayload(localParty),
            },
            'Party updated locally. Sync pending.'
        );
        return { ok: true, data: localParty, message: 'Party updated locally. Sync pending.' };
    },
    delete: async (id: string) => {
        await offlineSyncService.archiveCachedParty(id);
        return queueAndAttemptSync(
            {
                type: 'archive_party',
                payload: { id },
            },
            'Party archived locally. Sync pending.'
        );
    },
    restore: async (id: string) => {
        await offlineSyncService.restoreCachedParty(id);
        return queueAndAttemptSync(
            {
                type: 'restore_party',
                payload: { id },
            },
            'Party restored locally. Sync pending.'
        );
    },
    permanentDelete: async (id: string) => {
        await offlineSyncService.removeCachedParty(id);
        return queueAndAttemptSync(
            {
                type: 'permanent_delete_party',
                payload: { id },
            },
            'Party removed locally. Sync pending.'
        );
    },
};
