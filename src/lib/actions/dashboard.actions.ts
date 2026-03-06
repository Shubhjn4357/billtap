"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type DashboardStats = {
    totalUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    recentUsers: Array<{
        uid: string;
        email: string | null;
        displayName: string | null;
        createdAt: string;
    }>;
};

type SystemMetrics = {
    totalUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    systemHealth: number;
    userGrowth: number;
    revenueGrowth: number;
};

const resolveBaseUrl = () => {
    const internal = process.env.ADMIN_INTERNAL_API_URL?.trim();
    if (internal) return internal.replace(/\/$/, "");
    const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
    if (nextAuthUrl) return `${nextAuthUrl.replace(/\/$/, "")}/api/backend`;
    return "http://localhost:3000/api/backend";
};

async function serverFetch<T>(endpoint: string): Promise<T> {
    const session = await getServerSession(authOptions) as { backendJwt?: string } | null;
    if (!session?.backendJwt) {
        throw new Error("Unauthorized");
    }

    const url = `${resolveBaseUrl()}${endpoint}`;
    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.backendJwt}`,
        },
        cache: "no-store", // Ensure real-time dashboard stats
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${res.statusText}`);
    }

    return res.json() as Promise<T>;
}

export async function getDashboardStats() {
    return serverFetch<{ ok: boolean; stats: DashboardStats }>("/admin/stats");
}

export async function getDashboardAnalytics() {
    return serverFetch<{ ok: boolean; metrics: SystemMetrics }>("/admin/analytics/extended");
}
