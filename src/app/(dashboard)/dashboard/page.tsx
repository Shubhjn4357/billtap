"use client";

import { useAnalytics } from "@/hooks/useAnalytics";
import { Users, CreditCard, DollarSign, TrendingUp, Warehouse, BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"; 
import Link from "next/link";

export default function DashboardPage() {
    const { data: stats, isLoading } = useAnalytics();

    if (isLoading) return <div className="p-8">Loading dashboard...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">Overview of your application performance.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            Registered users across all platforms
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            Paying customers currently active
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {stats?.monthlyRevenue?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            Projected MRR based on active plans
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Signups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.recentUsers.map((user) => (
                                <div key={user.uid} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-4">
                                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                                            <span className="text-xs font-medium">{user.displayName?.[0] || "U"}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.displayName || "Unknown User"}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <Link href="/users" className="text-sm text-primary hover:underline">
                                View all users
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Link href="/plans" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                <span className="font-medium text-sm">Manage Plans</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Update pricing or features</p>
                        </Link>
                        <Link href="/users" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span className="font-medium text-sm">Manage Users</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Check subscriptions & roles</p>
                        </Link>
                        <Link href="/inventory" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                                <Warehouse className="h-4 w-4" />
                                <span className="font-medium text-sm">Inventory Review</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Track stock alerts and value changes</p>
                        </Link>
                        <Link href="/notifications/campaigns" className="block p-3 border rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                                <BellRing className="h-4 w-4" />
                                <span className="font-medium text-sm">Run Campaigns</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Launch announcements and reminders</p>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

