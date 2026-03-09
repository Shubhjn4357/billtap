import { api, isCloudWriteBlockedError, toApiError } from '../api/client';
import { isOfflineLikeError, offlineSyncService } from '../services/offlineSyncService';
import { getRuntimeBusinessId, getRuntimeUserId } from '../services/runtimeSession';
import { isOnline } from '../utils/network';
import type { ApiOkResponse, ApiResponse } from '../types/api';
import type { StaffInvite, StaffMember } from '../types/domain';

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

const shouldKeepLocalWriteOnError = (error: unknown) =>
    isOfflineLikeError(error) || isCloudWriteBlockedError(error);

const generateLocalInviteCode = () =>
    Math.random().toString(36).slice(2, 10).toUpperCase();

const sortStaffInvites = (invites: StaffInvite[]) =>
    [...invites].sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));

const buildLocalStaffInvite = (payload: { phoneNumber: string; role?: string }): StaffInvite => {
    const businessId = getRuntimeBusinessId() ?? 'offline';
    const userId = getRuntimeUserId() ?? 'offline-user';
    return {
        id: offlineSyncService.createLocalId('staff-invite'),
        ownerId: userId,
        organizationId: businessId,
        phoneNumber: payload.phoneNumber,
        role: 'staff',
        status: 'pending',
        code: generateLocalInviteCode(),
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
        createdAt: nowIso(),
    };
};

const queueHasMutation = async (predicate: (entry: { type?: string; payload?: Record<string, unknown> }) => boolean) => {
    const queue = await offlineSyncService.getQueue();
    return queue.some((entry) => predicate(entry as { type?: string; payload?: Record<string, unknown> }));
};

const hasPendingStaffInviteCreate = async (id: string) =>
    queueHasMutation((entry) => entry.type === 'create_staff_invite' && entry.payload?.id === id);

export const staffRepository = {
    listRemote: async () => {
        const res = await api.get<{ ok: boolean; staff: StaffMember[]; invites: StaffInvite[] }>('/api/staff');
        return { ...res, data: { staff: res.staff ?? [], invites: res.invites ?? [] } } as ApiResponse<{ staff: StaffMember[]; invites: StaffInvite[] }>;
    },
    getRemote: async (uid: string) => {
        const res = await api.get<{ ok: boolean; staff: StaffMember }>(`/api/staff/${uid}`);
        return { ...res, data: { staff: res.staff } } as ApiResponse<{ staff: StaffMember }>;
    },
    inviteRemote: async (data: { phoneNumber: string; role?: string; id?: string; code?: string }) => {
        const res = await api.post<{ ok: boolean; inviteId: string; code: string }>('/api/staff', data);
        return { ...res, data: { inviteId: res.inviteId, code: res.code } } as ApiResponse<{ inviteId: string; code: string }>;
    },
    updateRemote: async (uid: string, data: { role?: 'owner' | 'staff'; ownerId?: string | null }) => {
        const res = await api.patch<{ ok: boolean; id: string }>(`/api/staff/${uid}`, data);
        return { ...res, data: { id: res.id } } as ApiResponse<{ id: string }>;
    },
    deleteRemote: (uid: string) => api.delete<ApiOkResponse>(`/api/staff/${uid}`),
    deleteInviteRemote: (id: string) => api.delete<ApiOkResponse>(`/api/staff/invite/${id}`),
    list: async () => {
        try {
            const response = await staffRepository.listRemote();
            const staff = (response.data?.staff ?? []) as StaffMember[];
            const invites = sortStaffInvites((response.data?.invites ?? []) as StaffInvite[]);
            await offlineSyncService.setCachedStaffMembers(staff);
            await offlineSyncService.setCachedStaffInvites(invites);
            return { ...response, data: { staff, invites } };
        } catch (error) {
            const staff = await offlineSyncService.getCachedStaffMembers();
            const invites = sortStaffInvites(await offlineSyncService.getCachedStaffInvites());
            if (staff.length > 0 || invites.length > 0) {
                return { ok: true, data: { staff, invites } } as ApiResponse<{ staff: StaffMember[]; invites: StaffInvite[] }>;
            }
            throw error;
        }
    },
    get: async (uid: string) => {
        try {
            const response = await staffRepository.getRemote(uid);
            const staff = response.data?.staff as StaffMember | undefined;
            if (staff) {
                await offlineSyncService.upsertCachedStaffMember(staff);
            }
            return response;
        } catch (error) {
            const staff = (await offlineSyncService.getCachedStaffMembers()).find((entry) => entry.uid === uid);
            if (staff) {
                return { ok: true, data: { staff } } as ApiResponse<{ staff: StaffMember }>;
            }
            throw error;
        }
    },
    invite: async (data: { phoneNumber: string; role?: string }) => {
        const previousInvites = await offlineSyncService.getCachedStaffInvites();
        const localInvite = buildLocalStaffInvite(data);
        await offlineSyncService.setCachedStaffInvites(
            sortStaffInvites([localInvite, ...previousInvites.filter((entry) => entry.id !== localInvite.id)])
        );
        let syncMessage = 'Staff invite saved locally. Sync pending.';

        if (await isOnline()) {
            try {
                const response = await staffRepository.inviteRemote({
                    ...data,
                    id: localInvite.id,
                    code: localInvite.code,
                });
                return {
                    ...response,
                    data: {
                        inviteId: response.data?.inviteId ?? localInvite.id,
                        code: response.data?.code ?? localInvite.code,
                    },
                };
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[staff] invite failed', { payload: data, error: toApiError(error) });
                    await offlineSyncService.setCachedStaffInvites(previousInvites);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Staff invite saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[staff] keeping local invite after cloud rejection', { payload: data, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            {
                type: 'create_staff_invite',
                payload: {
                    id: localInvite.id,
                    phoneNumber: localInvite.phoneNumber,
                    role: localInvite.role,
                    code: localInvite.code,
                },
            },
            syncMessage
        );
        return {
            ok: true,
            data: { inviteId: localInvite.id, code: localInvite.code },
            message: syncMessage,
        } as ApiResponse<{ inviteId: string; code: string }>;
    },
    update: async (uid: string, data: { role?: 'owner' | 'staff'; ownerId?: string | null }) => {
        const previousMembers = await offlineSyncService.getCachedStaffMembers();
        const existing = previousMembers.find((entry) => entry.uid === uid);
        if (existing) {
            await offlineSyncService.upsertCachedStaffMember({
                ...existing,
                role: data.role ?? existing.role,
                ownerId: data.ownerId === undefined ? existing.ownerId : data.ownerId,
            });
        }
        let syncMessage = 'Staff update saved locally. Sync pending.';

        if (await isOnline()) {
            try {
                return await staffRepository.updateRemote(uid, data);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[staff] update failed', { uid, payload: data, error: toApiError(error) });
                    await offlineSyncService.setCachedStaffMembers(previousMembers);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Staff update saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[staff] keeping local update after cloud rejection', { uid, payload: data, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            {
                type: 'update_staff_member',
                payload: {
                    uid,
                    ...(data.role !== undefined ? { role: data.role } : {}),
                    ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
                },
            },
            syncMessage
        );
        return {
            ok: true,
            data: { id: uid },
            message: syncMessage,
        } as ApiResponse<{ id: string }>;
    },
    delete: async (uid: string) => {
        const previousMembers = await offlineSyncService.getCachedStaffMembers();
        await offlineSyncService.removeCachedStaffMember(uid);
        let syncMessage = 'Staff removal saved locally. Sync pending.';

        if (await isOnline()) {
            try {
                return await staffRepository.deleteRemote(uid);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[staff] delete failed', { uid, error: toApiError(error) });
                    await offlineSyncService.setCachedStaffMembers(previousMembers);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Staff removal saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[staff] keeping local delete after cloud rejection', { uid, error: toApiError(error) });
            }
        }

        return queueAndAttemptSync(
            { type: 'delete_staff', payload: { uid } },
            syncMessage
        );
    },
    deleteInvite: async (id: string) => {
        const previousInvites = await offlineSyncService.getCachedStaffInvites();
        await offlineSyncService.removeCachedStaffInvite(id);
        let syncMessage = 'Invite deletion saved locally. Sync pending.';

        const shouldCallOnline = await isOnline() && !(await hasPendingStaffInviteCreate(id));
        if (shouldCallOnline) {
            try {
                return await staffRepository.deleteInviteRemote(id);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[staff] delete invite failed', { id, error: toApiError(error) });
                    await offlineSyncService.setCachedStaffInvites(previousInvites);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Invite deletion saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[staff] keeping local invite deletion after cloud rejection', { id, error: toApiError(error) });
            }
        }

        return queueAndAttemptSync(
            { type: 'delete_staff_invite', payload: { id } },
            syncMessage
        );
    },
};
