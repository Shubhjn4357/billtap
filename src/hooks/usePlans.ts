import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plan, ApiResponse } from "@/types";

export function usePlans(includeInactive = true) {
    return useQuery({
        queryKey: ["plans", includeInactive],
        queryFn: async () => {
            const { data } = await api.get<ApiResponse<Plan[]>>(`/admin/plans?includeInactive=${includeInactive}`);
            return data.plans || [];
        },
    });
}

export function usePlan(id: string) {
    return useQuery({
        queryKey: ["plans", id],
        queryFn: async () => {
            const { data } = await api.get<ApiResponse<Plan>>(`/admin/plans/${id}`);
            return data.plan;
        },
        enabled: !!id,
    });
}

export function useCreatePlan() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (plan: Partial<Plan>) => {
            const { data } = await api.post<ApiResponse<string>>("/admin/plans", plan);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["plans"] });
        },
    });
}

export function useUpdatePlan() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...plan }: Partial<Plan> & { id: string }) => {
            const { data } = await api.patch<ApiResponse<null>>(`/admin/plans/${id}`, plan);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["plans"] });
        },
    });
}

export function useDeletePlan() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.delete<ApiResponse<null>>(`/admin/plans/${id}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["plans"] });
        },
    });
}
