"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AlertTriangle, History, Package, TrendingUp } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { inventoryService, type InventoryOverviewItem, type InventoryOverviewStats } from "@/services/inventoryService";

const EMPTY_STATS: InventoryOverviewStats = {
    totalSkus: 0,
    lowStockAlerts: 0,
    stockValue: 0,
    recentMovements: 0,
};

export default function InventoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState<InventoryOverviewStats>(EMPTY_STATS);
    const [items, setItems] = useState<InventoryOverviewItem[]>([]);
    const { toast } = useToast();

    const loadOverview = async () => {
        setIsLoading(true);
        try {
            const response = await inventoryService.getOverview(300);
            setStats(response.stats ?? EMPTY_STATS);
            setItems(response.items ?? []);
        } catch (error) {
            console.error("Failed to load inventory overview", error);
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load inventory data."),
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

    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return items;
        return items.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.category.toLowerCase().includes(query)
            || entry.organizationName.toLowerCase().includes(query)
        ));
    }, [items, searchQuery]);

    const columns = [
        { header: "Item Name", accessorKey: "name" },
        { header: "Category", accessorKey: "category" },
        { header: "Total Stock", accessorKey: "stock" },
        {
            header: "Avg Price",
            accessorKey: "price",
            cell: (entry: InventoryOverviewItem) => `INR ${entry.price.toLocaleString()}`,
        },
        { header: "Organization", accessorKey: "organizationName" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Global Inventory</h1>
                    <p className="text-muted-foreground text-lg">System-wide monitoring of stock levels and item data.</p>
                </div>
                <Button variant="outline" onClick={() => { void loadOverview(); }}>
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total SKUs</CardTitle>
                        <Package className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSkus.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Live across network</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.lowStockAlerts.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Stock Value</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">INR {Math.round(stats.stockValue).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Estimated</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Recent Movements</CardTitle>
                        <History className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.recentMovements.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Past 24 hours</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-card/50 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-bold">Item Distribution</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredItems}
                        isLoading={isLoading}
                        searchPlaceholder="Filter items by name, category, or organization..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
