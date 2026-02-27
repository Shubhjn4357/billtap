"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Clock, Filter, ShieldCheck, Users, XCircle } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { staffService, type StaffDirectoryRow, type StaffOverviewStats } from "@/services/staffService";

const EMPTY_STATS: StaffOverviewStats = {
    totalPersonnel: 0,
    verifiedAdmins: 0,
    pendingInvites: 0,
    revokedAccess: 0,
};

export default function StaffPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState<StaffOverviewStats>(EMPTY_STATS);
    const [staff, setStaff] = useState<StaffDirectoryRow[]>([]);
    const { toast } = useToast();

    const loadOverview = async () => {
        setIsLoading(true);
        try {
            const response = await staffService.getOverview(300);
            setStats(response.stats ?? EMPTY_STATS);
            setStaff(response.staff ?? []);
        } catch (error) {
            console.error("Failed to load staff overview", error);
            toast({
                title: "Error",
                description: "Failed to load staff data",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredStaff = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return staff;
        return staff.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.contact.toLowerCase().includes(query)
            || entry.role.toLowerCase().includes(query)
            || entry.organizationName.toLowerCase().includes(query)
            || entry.status.toLowerCase().includes(query)
        ));
    }, [searchQuery, staff]);

    const columns = [
        { header: "Name", accessorKey: "name" },
        { header: "Email / Phone", accessorKey: "contact" },
        { header: "Role", accessorKey: "role" },
        { header: "Organization", accessorKey: "organizationName" },
        { header: "Status", accessorKey: "status" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Staff & Roles</h1>
                    <p className="text-muted-foreground text-lg">Manage personnel and access control across the ecosystem.</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => { void loadOverview(); }}>
                    <Filter className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total Personnel</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalPersonnel.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">System-wide</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Verified Admins</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.verifiedAdmins.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Pending Invites</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingInvites.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting acceptance</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Revoked Access</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.revokedAccess.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Membership disabled</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold">Personnel Directory</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredStaff}
                        isLoading={isLoading}
                        searchPlaceholder="Filter by name, contact, role, or organization..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
