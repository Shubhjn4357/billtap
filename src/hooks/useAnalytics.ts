import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User } from "@/types";

export interface DashboardStats {
    totalUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    recentUsers: User[];
}

export function useAnalytics() {
    return useQuery({
        queryKey: ["admin-stats"],
        queryFn: async () => {
            const { data } = await api.get<{ ok: boolean; stats: DashboardStats }>("/admin/stats");
            return data.stats;
        },
    });
}
