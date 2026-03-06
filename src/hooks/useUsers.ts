import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User, ApiResponse } from "@/types";

export function useUsers(limit = 100) {
    return useQuery({
        queryKey: ["users", limit],
        queryFn: async () => {
            const { data } = await api.get<ApiResponse<User[]>>(`/admin/users?limit=${limit}`);
            return data.users || [];
        },
    });
}

export function useUser(uid: string) {
    return useQuery({
        queryKey: ["users", uid],
        queryFn: async () => {
            const { data } = await api.get<ApiResponse<User>>(`/admin/users/${uid}`);
            return data.user;
        },
        enabled: !!uid,
    });
}

export function useUpdateUserRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ uid, role }: { uid: string; role: string }) => {
            const { data } = await api.patch<ApiResponse<null>>(`/admin/users/${uid}/role`, { role });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
}

export function useManualSubscription() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            uid,
            planId,
            status,
            durationDays,
            businessId,
        }: {
            uid: string;
            planId: string;
            status: string;
            durationDays: number;
            businessId?: string;
        }) => {
            const { data } = await api.post<ApiResponse<null>>(`/admin/users/${uid}/subscription`, {
                planId,
                status,
                durationDays,
                ...(businessId ? { businessId } : {}),
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (uid: string) => {
            const { data } = await api.delete<ApiResponse<null>>(`/admin/users/${uid}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
}
