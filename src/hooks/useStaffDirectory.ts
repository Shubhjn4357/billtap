import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { staffRepository } from '../repositories/staffRepository';
import type { StaffInvite, StaffMember } from '../types/domain';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { staffQueryKeys } from '../state/domainQueryKeys';

export const invalidateStaffQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: staffQueryKeys.all(businessId) });
};

export function useStaffDirectory(options?: {
    search?: string;
    enabled?: boolean;
    staleTime?: number;
}) {
    const businessId = useBusinessQueryScope();
    const search = options?.search?.trim().toLowerCase() ?? '';
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 30_000;

    const query = useQuery({
        queryKey: staffQueryKeys.directory(businessId),
        queryFn: () => staffRepository.list(),
        enabled,
        staleTime,
    });

    const members = useMemo(
        () => ((query.data?.data?.staff ?? []) as StaffMember[]),
        [query.data?.data?.staff]
    );
    const invites = useMemo(
        () => ((query.data?.data?.invites ?? []) as StaffInvite[]),
        [query.data?.data?.invites]
    );
    const filteredMembers = useMemo(() => {
        if (!search) return members;
        return members.filter((member) =>
            `${member.displayName ?? ''} ${member.phoneNumber ?? ''} ${member.email ?? ''} ${member.role}`
                .toLowerCase()
                .includes(search)
        );
    }, [members, search]);
    const filteredInvites = useMemo(() => {
        if (!search) return invites;
        return invites.filter((invite) =>
            `${invite.phoneNumber} ${invite.code} ${invite.status}`.toLowerCase().includes(search)
        );
    }, [invites, search]);

    return {
        ...query,
        members,
        invites,
        filteredMembers,
        filteredInvites,
    };
}
