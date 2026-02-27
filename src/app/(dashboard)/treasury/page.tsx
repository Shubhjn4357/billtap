"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Building2, DollarSign, RefreshCw, Wallet } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { adminService, TreasuryStats, type TreasuryAccountRow } from "@/services/adminService";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const EMPTY_STATS: TreasuryStats = {
    totalLiquidity: 0,
    settlementsPending: 0,
    institutionalReserve: 0,
    netCashFlow: 0,
};

export default function TreasuryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState<TreasuryStats>(EMPTY_STATS);
    const [accounts, setAccounts] = useState<TreasuryAccountRow[]>([]);
    const { toast } = useToast();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const response = await adminService.getTreasuryStats();
            setStats(response.stats ?? EMPTY_STATS);
            setAccounts(response.accounts ?? []);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to load treasury data.",
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

    const filteredAccounts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return accounts;
        return accounts.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.bankName.toLowerCase().includes(query)
            || (entry.ownerBusinessName ?? "").toLowerCase().includes(query)
        ));
    }, [accounts, searchQuery]);

    const columns = [
        { header: "Account Name", accessorKey: "name" },
        { header: "Bank", accessorKey: "bankName" },
        {
            header: "Balance",
            accessorKey: "currentBalance",
            cell: (entry: TreasuryAccountRow) => `INR ${entry.currentBalance.toLocaleString()}`,
        },
        {
            header: "Business",
            accessorKey: "ownerBusinessName",
            cell: (entry: TreasuryAccountRow) => entry.ownerBusinessName ?? "Unassigned",
        },
        {
            header: "Updated",
            accessorKey: "updatedAt",
            cell: (entry: TreasuryAccountRow) => new Date(entry.updatedAt).toLocaleString(),
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Treasury</h1>
                    <p className="text-muted-foreground">Database-backed liquidity and account management.</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => { void loadData(); }} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total Liquidity</CardTitle>
                        <Wallet className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {Math.round(stats.totalLiquidity).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Institutional Reserve</CardTitle>
                        <Building2 className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {Math.round(stats.institutionalReserve).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Pending Settlements</CardTitle>
                        <DollarSign className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(stats.settlementsPending).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Net Cash Flow</CardTitle>
                        <DollarSign className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {Math.round(stats.netCashFlow).toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold">Account Balances</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredAccounts}
                        isLoading={isLoading}
                        searchPlaceholder="Filter by account, bank, or business..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
