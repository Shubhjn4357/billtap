"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Clock, Receipt, RefreshCw, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { adminService, PayrollStats, type PayrollBatchRow } from "@/services/adminService";

const EMPTY_STATS: PayrollStats = {
    totalDisbursed: 0,
    totalStaff: 0,
    avgSalary: 0,
    activeBatches: 0,
};

export default function PayrollPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState<PayrollStats>(EMPTY_STATS);
    const [batches, setBatches] = useState<PayrollBatchRow[]>([]);
    const { toast } = useToast();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const response = await adminService.getPayrollStats();
            setStats(response.stats ?? EMPTY_STATS);
            setBatches(response.latestBatches ?? []);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to load payroll data.",
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

    const filteredBatches = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return batches;
        return batches.filter((entry) => (
            (entry.ownerBusinessName ?? "").toLowerCase().includes(query)
            || entry.userId.toLowerCase().includes(query)
            || entry.status.toLowerCase().includes(query)
            || entry.id.toLowerCase().includes(query)
        ));
    }, [batches, searchQuery]);

    const columns = [
        {
            header: "Business",
            accessorKey: "ownerBusinessName",
            cell: (entry: PayrollBatchRow) => entry.ownerBusinessName ?? entry.userId,
        },
        { header: "Batch ID", accessorKey: "id" },
        { header: "Staff", accessorKey: "staffCount" },
        {
            header: "Total Net",
            accessorKey: "totalNet",
            cell: (entry: PayrollBatchRow) => `INR ${Math.round(entry.totalNet).toLocaleString()}`,
        },
        { header: "Status", accessorKey: "status" },
        {
            header: "Period",
            accessorKey: "periodStart",
            cell: (entry: PayrollBatchRow) => {
                const start = new Date(entry.periodStart).toLocaleDateString();
                const end = new Date(entry.periodEnd).toLocaleDateString();
                return `${start} to ${end}`;
            },
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
                    <p className="text-muted-foreground text-lg">Database-backed salary runs and disbursement metrics.</p>
                </div>
                <Button variant="outline" onClick={() => { void loadData(); }} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total Disbursement</CardTitle>
                        <Receipt className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {Math.round(stats.totalDisbursed).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Staff Members</CardTitle>
                        <Users className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(stats.totalStaff).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Average Compensation</CardTitle>
                        <Clock className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {Math.round(stats.avgSalary).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Salary Runs</CardTitle>
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(stats.activeBatches).toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Payroll Batches
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredBatches}
                        isLoading={isLoading}
                        searchPlaceholder="Search by business, batch, status..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
