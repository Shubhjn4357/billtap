"use client";

import React, { useEffect, useState } from "react";
import { Clock, CreditCard, Loader2, Store, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { adminService } from "@/services/adminService";

interface Stats {
    totalUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    recentUsers: Array<{
        displayName?: string;
        email?: string;
        createdAt: string;
        subscriptionStatus?: string;
    }>;
}

export default function OverviewPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [systemHealth, setSystemHealth] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [statsRes, analyticsRes] = await Promise.all([
                    api.get<{ ok: boolean; stats: Stats }>("/admin/stats"),
                    adminService.getAnalyticsExtended(),
                ]);
                setStats(statsRes.data.stats);
                setSystemHealth(analyticsRes.metrics?.systemHealth ?? 0);
            } catch (error) {
                console.error("Failed to fetch dashboard overview", error);
            } finally {
                setIsLoading(false);
            }
        };
        void fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const cards = [
        {
            title: "Total Businesses",
            value: stats?.totalUsers ?? 0,
            icon: Store,
            description: "Total registered users",
        },
        {
            title: "Active Subscriptions",
            value: stats?.activeSubscriptions ?? 0,
            icon: TrendingUp,
            description: "Users with active subscription",
        },
        {
            title: "Monthly Revenue",
            value: `INR ${(stats?.monthlyRevenue ?? 0).toLocaleString()}`,
            icon: CreditCard,
            description: "Sum of active subscription MRR",
        },
        {
            title: "System Health",
            value: `${Math.round(systemHealth)}%`,
            icon: Clock,
            description: "Derived from approval backlog",
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
                <p className="text-muted-foreground">Real-time metrics from production database records.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                    <Card key={card.title} className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-muted-foreground">{card.title}</CardTitle>
                            <card.icon className="h-5 w-5 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold tracking-tight">{card.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Recent Onboarding
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {(stats?.recentUsers ?? []).map((user, index) => (
                            <div key={`${user.email ?? "user"}-${index}`} className="flex items-center gap-4 p-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {(user.displayName || "U")[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{user.displayName || "New User"}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email || "No email"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {user.subscriptionStatus || "inactive"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
