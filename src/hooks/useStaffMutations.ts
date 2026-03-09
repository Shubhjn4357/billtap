import { useMutation, useQueryClient } from '@tanstack/react-query';
import { staffRepository } from '../repositories/staffRepository';
import { invalidateStaffQueries } from './useStaffDirectory';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export function useStaffMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const inviteMutation = useMutation({
        mutationFn: (payload: { phoneNumber: string; role?: string }) => staffRepository.invite(payload),
        onSuccess: async () => {
            await invalidateStaffQueries(queryClient, businessId);
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: (uid: string) => staffRepository.delete(uid),
        onSuccess: async () => {
            await invalidateStaffQueries(queryClient, businessId);
        },
    });

    const removeInviteMutation = useMutation({
        mutationFn: (id: string) => staffRepository.deleteInvite(id),
        onSuccess: async () => {
            await invalidateStaffQueries(queryClient, businessId);
        },
    });

    return {
        inviteStaff: inviteMutation.mutateAsync,
        removeStaff: removeMemberMutation.mutateAsync,
        removeInvite: removeInviteMutation.mutateAsync,
        isInviting: inviteMutation.isPending,
        isRemovingStaff: removeMemberMutation.isPending,
        isRemovingInvite: removeInviteMutation.isPending,
    };
}
