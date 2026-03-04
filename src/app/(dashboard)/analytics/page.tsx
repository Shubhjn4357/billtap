"use client";

import React, { useEffect, useState } from "react";
import { Activity, RefreshCw, TrendingUp, Users, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { adminService, SystemMetrics } from "@/services/adminService";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";

const EMPTY_METRICS: SystemMetrics = {
    totalUsers: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    systemHealth: 0,
    userGrowth: 0,
    revenueGrowth: 0,
};

export default function AnalyticsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [metrics, setMetrics] = useState<SystemMetrics>(EMPTY_METRICS);
    const { toast } = useToast();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const response = await adminService.getAnalyticsExtended();
            setMetrics(response.metrics ?? EMPTY_METRICS);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load analytics metrics."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const metricCards = [
        {
            title: "Total Users",
            value: metrics.totalUsers.toLocaleString(),
            change: `${metrics.userGrowth.toFixed(2)}%`,
            icon: Users,
        },
        {
            title: "Active Subscriptions",
            value: metrics.activeSubscriptions.toLocaleString(),
            change: metrics.totalUsers > 0
                ? `${((metrics.activeSubscriptions / metrics.totalUsers) * 100).toFixed(2)}% conversion`
                : "0.00% conversion",
            icon: TrendingUp,
        },
        {
            title: "Monthly Revenue",
            value: `INR ${Math.round(metrics.monthlyRevenue).toLocaleString()}`,
            change: `${metrics.revenueGrowth.toFixed(2)}%`,
            icon: Zap,
        },
        {
            title: "System Health",
            value: `${Math.round(metrics.systemHealth)}%`,
            change: "Derived from approval backlog",
            icon: Activity,
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">System Analytics</h1>
                    <p className="text-muted-foreground text-lg">Database-backed growth and health metrics.</p>
                </div>
                <Button variant="outline" onClick={() => { void loadData(); }} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {metricCards.map((entry) => (
                    <Card key={entry.title} className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-muted-foreground">{entry.title}</CardTitle>
                            <entry.icon className="h-5 w-5 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{entry.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">{entry.change}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm bg-card/60">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Metric Definitions</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>Total Users: total rows in the users table.</p>
                    <p>Active Subscriptions: users where subscription status is active.</p>
                    <p>Monthly Revenue: sum of active users&apos; monthly subscription amount.</p>
                    <p>System Health: computed from pending vs total approvals.</p>
                </CardContent>
            </Card>
        </div>
    );
}
