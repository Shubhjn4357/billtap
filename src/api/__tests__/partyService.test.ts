/**
 * @file partyService.test.ts
 * @description Strict unit tests for partyService — CRUD, search, offline fallback, queue enqueuing.
 */
import { partyService } from '../partyService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Party } from '../../types';

// ─── Hoisted mock references ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
    isOnline: vi.fn().mockResolvedValue(true),
    isNetworkLikeError: vi.fn().mockReturnValue(false),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
    flushQueue: vi.fn().mockResolvedValue(undefined),
    getCachedParties: vi.fn().mockResolvedValue([]),
    setCachedParties: vi.fn().mockResolvedValue(undefined),
    upsertCachedParty: vi.fn().mockResolvedValue(undefined),
    archiveCachedParty: vi.fn().mockResolvedValue(undefined),
    enqueueMutation: vi.fn().mockResolvedValue(undefined),
    createLocalId: vi.fn((prefix: string) => `${prefix}_local_001`),
}));

vi.mock('../../utils/network', () => ({ isOnline: mocks.isOnline }));
vi.mock('../../utils/errorGuards', () => ({ isNetworkLikeError: mocks.isNetworkLikeError }));
vi.mock('../httpClient', () => ({
    apiClient: {
        get: mocks.apiGet,
        post: mocks.apiPost,
        patch: mocks.apiPatch,
        delete: mocks.apiDelete,
    },
}));
vi.mock('../syncService', () => ({
    offlineSyncService: {
        flushQueue: mocks.flushQueue,
        getCachedParties: mocks.getCachedParties,
        setCachedParties: mocks.setCachedParties,
        upsertCachedParty: mocks.upsertCachedParty,
        archiveCachedParty: mocks.archiveCachedParty,
        enqueueMutation: mocks.enqueueMutation,
        createLocalId: mocks.createLocalId,
    },
}));


// ─── Test Data ──────────────────────────────────────────────────────────────────

const makeParty = (overrides: Partial<Party> = {}): Party => ({
    id: 'party_001',
    userId: 'user_abc',
    name: 'Test Customer',
    type: 'customer',
    phone: '9876543210',
    email: 'test@example.com',
    address: '123 Main St',
    gstNumber: undefined,
    isActive: true,
    createdAt: new Date('2026-01-01').toISOString(),
    updatedAt: new Date('2026-01-01').toISOString(),
    ...overrides,
});

/** Satisfies PartyCreatePayload = Omit<Party, 'id'|'userId'|'createdAt'|'updatedAt'> */
const makeNewParty = (
    overrides: Partial<Omit<Party, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = {}
): Omit<Party, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
    name: 'New Party',
    type: 'customer' as const,
    isActive: true,
    ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('partyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isOnline.mockResolvedValue(true);
        mocks.isNetworkLikeError.mockReturnValue(false);
        mocks.getCachedParties.mockResolvedValue([]);
    });

    // ── GET PARTIES ─────────────────────────────────────────────────────────────

    describe('getParties — online', () => {
        it('returns normalized parties from API', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, parties: [makeParty({ name: 'Alice' })] });
            const parties = await partyService.getParties();
            expect(parties).toHaveLength(1);
            expect(parties[0].name).toBe('Alice');
            expect(parties[0].isActive).toBe(true);
        });

        it('calls GET /parties without query for empty search', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, parties: [] });
            await partyService.getParties();
            expect(mocks.apiGet).toHaveBeenCalledWith('/parties');
        });

        it('encodes query text in the URL', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, parties: [] });
            await partyService.getParties('राज');
            const url = mocks.apiGet.mock.calls[0][0] as string;
            expect(url).toContain('?q=');
        });

        it('caches parties locally after fetch', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, parties: [makeParty()] });
            await partyService.getParties();
            expect(mocks.setCachedParties).toHaveBeenCalledOnce();
        });

        it('throws when server ok is false', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
            await expect(partyService.getParties()).rejects.toThrow('Unauthorized');
        });
    });

    describe('getParties — offline', () => {
        beforeEach(() => { mocks.isOnline.mockResolvedValue(false); });

        it('returns cached parties when offline', async () => {
            mocks.getCachedParties.mockResolvedValueOnce([makeParty()]);
            const parties = await partyService.getParties();
            expect(parties).toHaveLength(1);
            expect(mocks.apiGet).not.toHaveBeenCalled();
        });

        it('filters cached parties by name when searching offline', async () => {
            mocks.getCachedParties.mockResolvedValueOnce([
                makeParty({ id: 'p1', name: 'Alice Kumar' }),
                makeParty({ id: 'p2', name: 'Bob Singh' }),
            ]);
            const parties = await partyService.getParties('alice');
            expect(parties).toHaveLength(1);
            expect(parties[0].name).toBe('Alice Kumar');
        });

        it('filters cached parties by phone when searching offline', async () => {
            mocks.getCachedParties.mockResolvedValueOnce([
                makeParty({ id: 'p1', phone: '9876543210' }),
                makeParty({ id: 'p2', phone: '1234567890' }),
            ]);
            const parties = await partyService.getParties('9876');
            expect(parties).toHaveLength(1);
            expect(parties[0].id).toBe('p1');
        });

        it('falls back to cache when API throws a network error', async () => {
            mocks.isOnline.mockResolvedValue(true);
            mocks.isNetworkLikeError.mockReturnValue(true);
            mocks.apiGet.mockRejectedValueOnce(new Error('Network error'));
            mocks.getCachedParties.mockResolvedValueOnce([makeParty()]);
            const parties = await partyService.getParties();
            expect(parties).toHaveLength(1);
        });
    });

    // ── GET PARTY ───────────────────────────────────────────────────────────────

    describe('getParty', () => {
        it('returns party from cache when present', async () => {
            mocks.getCachedParties.mockResolvedValueOnce([makeParty({ id: 'p_cached' })]);
            const party = await partyService.getParty('p_cached');
            expect(party?.id).toBe('p_cached');
        });

        it('fetches all parties when not in cache', async () => {
            mocks.getCachedParties.mockResolvedValue([]);
            mocks.apiGet.mockResolvedValueOnce({ ok: true, parties: [makeParty({ id: 'p_fresh' })] });
            const party = await partyService.getParty('p_fresh');
            expect(party?.id).toBe('p_fresh');
        });

        it('returns null for nonexistent party ID', async () => {
            mocks.getCachedParties.mockResolvedValue([]);
            mocks.apiGet.mockResolvedValueOnce({ ok: true, parties: [] });
            const party = await partyService.getParty('nonexistent');
            expect(party).toBeNull();
        });
    });

    // ── CREATE PARTY ────────────────────────────────────────────────────────────

    describe('createParty — online', () => {
        it('returns the server-issued party ID', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'party_server_001' });
            const id = await partyService.createParty(makeNewParty({ name: 'New Supplier', type: 'supplier' }));
            expect(id).toBe('party_server_001');
        });

        it('calls POST /parties', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'p_api' });
            await partyService.createParty(makeNewParty({ name: 'Customer', type: 'customer' }));
            expect(mocks.apiPost).toHaveBeenCalledWith('/parties', expect.objectContaining({ name: 'Customer' }));
        });

        it('upserts newly-created party to local cache', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'p_new' });
            await partyService.createParty(makeNewParty({ name: 'Bob', type: 'customer' }));
            expect(mocks.upsertCachedParty).toHaveBeenCalled();
            expect(mocks.upsertCachedParty.mock.calls[0][0].name).toBe('Bob');
        });

        it('defaults isActive to true when not specified', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: true, id: 'p_default' });
            await partyService.createParty(makeNewParty({ name: 'X', type: 'customer' }));
            const cached = mocks.upsertCachedParty.mock.calls[0][0];
            expect(cached.isActive).toBe(true);
        });

        it('throws when server returns ok: false with message', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: false, message: 'Party already exists' });
            await expect(partyService.createParty(makeNewParty({ name: 'Dup', type: 'customer' }))).rejects.toThrow(
                'Party already exists'
            );
        });
    });

    describe('createParty — offline', () => {
        beforeEach(() => { mocks.isOnline.mockResolvedValue(false); });

        it('returns a local ID when offline', async () => {
            const id = await partyService.createParty(makeNewParty({ name: 'Offline Party', type: 'customer' }));
            expect(id).toBe('party_local_001');
        });

        it('enqueues upsert_party mutation when offline', async () => {
            await partyService.createParty(makeNewParty({ name: 'Queued', type: 'customer' }));
            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
            expect(mocks.enqueueMutation.mock.calls[0][0].type).toBe('upsert_party');
        });

        it('does not call API when offline', async () => {
            await partyService.createParty(makeNewParty({ name: 'Offline', type: 'supplier' }));
            expect(mocks.apiPost).not.toHaveBeenCalled();
        });
    });

    // ── UPDATE PARTY ────────────────────────────────────────────────────────────

    describe('updateParty', () => {
        it('merges partial update with existing data, preserving untouched fields', async () => {
            mocks.getCachedParties.mockResolvedValue([
                makeParty({ id: 'p_merge', name: 'Original', phone: '111' }),
            ]);
            mocks.apiPatch.mockResolvedValueOnce({ ok: true });

            await partyService.updateParty('p_merge', { name: 'Modified' });

            expect(mocks.upsertCachedParty).toHaveBeenCalled();
            const upserted = mocks.upsertCachedParty.mock.calls[0][0];
            expect(upserted.name).toBe('Modified');
            expect(upserted.phone).toBe('111');
        });

        it('enqueues upsert_party mutation when offline', async () => {
            mocks.isOnline.mockResolvedValue(false);
            mocks.getCachedParties.mockResolvedValue([makeParty({ id: 'p_offline' })]);

            await partyService.updateParty('p_offline', { name: 'New' });

            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
            expect(mocks.enqueueMutation.mock.calls[0][0].type).toBe('upsert_party');
        });
    });

    // ── ARCHIVE PARTY ───────────────────────────────────────────────────────────

    describe('archiveParty', () => {
        it('calls archiveCachedParty locally first', async () => {
            mocks.apiPatch.mockResolvedValueOnce({ ok: true });
            await partyService.archiveParty('p_archive');
            expect(mocks.archiveCachedParty).toHaveBeenCalledWith('p_archive');
        });

        it('sends PATCH /parties/:id with isActive: false', async () => {
            mocks.apiPatch.mockResolvedValueOnce({ ok: true });
            await partyService.archiveParty('p_arc');
            expect(mocks.apiPatch).toHaveBeenCalledWith('/parties/p_arc', { isActive: false });
        });

        it('enqueues archive_party mutation when offline', async () => {
            mocks.isOnline.mockResolvedValue(false);
            await partyService.archiveParty('p_offline_arc');
            expect(mocks.enqueueMutation).toHaveBeenCalledOnce();
            const mutation = mocks.enqueueMutation.mock.calls[0][0];
            expect(mutation.type).toBe('archive_party');
            expect(mutation.payload.id).toBe('p_offline_arc');
        });
    });
});
