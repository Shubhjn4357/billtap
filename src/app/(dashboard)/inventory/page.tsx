"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AlertTriangle, Edit3, History, Package, RefreshCw, RotateCcw, Trash2, TrendingUp, Wrench } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { inventoryService, type InventoryItemRow, type InventoryOverviewStats } from "@/services/inventoryService";
import { organizationService, type Organization } from "@/services/organizationService";

const EMPTY_STATS: InventoryOverviewStats = {
    totalSkus: 0,
    lowStockAlerts: 0,
    stockValue: 0,
    recentMovements: 0,
};

export default function InventoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState<InventoryOverviewStats>(EMPTY_STATS);
    const [items, setItems] = useState<InventoryItemRow[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedBusinessId, setSelectedBusinessId] = useState<string>("ALL");
    const [includeInactive, setIncludeInactive] = useState<boolean>(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItemRow | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        category: "",
        unit: "",
        salePrice: "0",
        purchasePrice: "0",
        mrp: "0",
        reorderLevel: "0",
        stock: "0",
    });
    const [adjustForm, setAdjustForm] = useState({
        delta: "0",
        reason: "",
    });
    const { toast } = useToast();

    const loadOverview = async () => {
        setIsLoading(true);
        try {
            const filters = {
                businessId: selectedBusinessId === "ALL" ? undefined : selectedBusinessId,
                includeInactive,
                limit: 500,
            };
            const [overviewResponse, itemRows, organizationsRows] = await Promise.all([
                inventoryService.getOverview(300),
                inventoryService.getItems(filters),
                organizationService.getAll(),
            ]);
            setStats(overviewResponse.stats ?? EMPTY_STATS);
            setItems(itemRows ?? []);
            setOrganizations(organizationsRows ?? []);
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
    }, [selectedBusinessId, includeInactive]);

    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return items;
        return items.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.category.toLowerCase().includes(query)
            || entry.businessName.toLowerCase().includes(query)
            || (entry.sku?.toLowerCase().includes(query) ?? false)
            || (entry.barcode?.toLowerCase().includes(query) ?? false)
        ));
    }, [items, searchQuery]);

    const openEdit = (item: InventoryItemRow) => {
        setSelectedItem(item);
        setEditForm({
            name: item.name,
            category: item.category === "Uncategorized" ? "" : item.category,
            unit: item.unit ?? "",
            salePrice: String(item.salePrice ?? 0),
            purchasePrice: String(item.purchasePrice ?? 0),
            mrp: String(item.mrp ?? 0),
            reorderLevel: String(item.reorderLevel ?? 0),
            stock: String(item.stock ?? 0),
        });
        setIsEditOpen(true);
    };

    const openAdjust = (item: InventoryItemRow) => {
        setSelectedItem(item);
        setAdjustForm({ delta: "0", reason: "" });
        setIsAdjustOpen(true);
    };

    const runMutation = async (work: () => Promise<void>, successMessage: string) => {
        setIsMutating(true);
        try {
            await work();
            toast({ title: "Success", description: successMessage, type: "success" });
            await loadOverview();
        } catch (error) {
            toast({
                title: "Action failed",
                description: getErrorMessage(error, "Unable to complete inventory action."),
                type: "error",
            });
        } finally {
            setIsMutating(false);
        }
    };

    const saveEdit = async () => {
        if (!selectedItem) return;
        await runMutation(async () => {
            await inventoryService.updateItem(selectedItem.id, {
                name: editForm.name.trim(),
                category: editForm.category.trim() ? editForm.category.trim() : null,
                unit: editForm.unit.trim() ? editForm.unit.trim() : null,
                salePrice: Number(editForm.salePrice || 0),
                purchasePrice: Number(editForm.purchasePrice || 0),
                mrp: Number(editForm.mrp || 0),
                reorderLevel: Number(editForm.reorderLevel || 0),
                stock: Number(editForm.stock || 0),
            });
            setIsEditOpen(false);
            setSelectedItem(null);
        }, "Inventory item updated.");
    };

    const applyAdjust = async () => {
        if (!selectedItem) return;
        const delta = Number(adjustForm.delta || 0);
        if (delta === 0) {
            toast({ title: "Invalid delta", description: "Delta cannot be zero.", type: "error" });
            return;
        }
        await runMutation(async () => {
            await inventoryService.adjustStock(selectedItem.id, {
                delta,
                reason: adjustForm.reason.trim() || undefined,
            });
            setIsAdjustOpen(false);
            setSelectedItem(null);
        }, "Stock adjusted.");
    };

    const toggleActiveState = async (item: InventoryItemRow) => {
        if (item.isActive) {
            await runMutation(async () => {
                await inventoryService.deactivateItem(item.id);
            }, "Item deactivated.");
            return;
        }
        await runMutation(async () => {
            await inventoryService.restoreItem(item.id);
        }, "Item restored.");
    };

    const permanentDelete = async (item: InventoryItemRow) => {
        if (!window.confirm(`Permanently delete ${item.name}? This cannot be undone.`)) return;
        await runMutation(async () => {
            await inventoryService.deleteItemPermanent(item.id);
        }, "Item permanently deleted.");
    };

    const columns = [
        { header: "Item Name", accessorKey: "name" },
        { header: "Business", accessorKey: "businessName" },
        { header: "Category", accessorKey: "category" },
        { header: "Unit", accessorKey: "unit" },
        { header: "Total Stock", accessorKey: "stock" },
        {
            header: "Sale Price",
            accessorKey: "salePrice",
            cell: (entry: InventoryItemRow) => `INR ${entry.salePrice.toLocaleString()}`,
        },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (entry: InventoryItemRow) => (
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${entry.isActive ? "bg-green-500/15 text-green-700" : "bg-zinc-500/15 text-zinc-700"}`}>
                    {entry.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
            ),
        },
        {
            header: "Actions",
            accessorKey: "id",
            cell: (entry: InventoryItemRow) => (
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(entry)}>
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openAdjust(entry)}>
                        <Wrench className="h-3 w-3 mr-1" />
                        Adjust
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { void toggleActiveState(entry); }} disabled={isMutating}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {entry.isActive ? "Deactivate" : "Restore"}
                    </Button>
                    {!entry.isActive && (
                        <Button variant="outline" size="sm" onClick={() => { void permanentDelete(entry); }} disabled={isMutating}>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Global Inventory</h1>
                    <p className="text-muted-foreground text-lg">System-wide monitoring with full admin controls for stock and lifecycle.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(event.target.value)}>
                        <option value="ALL">All businesses</option>
                        {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                                {organization.name}
                            </option>
                        ))}
                    </Select>
                    <Button variant={includeInactive ? "default" : "outline"} onClick={() => setIncludeInactive((prev) => !prev)}>
                        {includeInactive ? "Including inactive" : "Active only"}
                    </Button>
                    <Button variant="outline" onClick={() => { void loadOverview(); }}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
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

            <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Item${selectedItem ? `: ${selectedItem.name}` : ""}`} className="max-w-3xl">
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="text-xs font-medium">Name</label>
                        <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Category</label>
                        <Input value={editForm.category} onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Unit</label>
                        <Input value={editForm.unit} onChange={(event) => setEditForm((prev) => ({ ...prev, unit: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Stock</label>
                        <Input type="number" value={editForm.stock} onChange={(event) => setEditForm((prev) => ({ ...prev, stock: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Sale Price</label>
                        <Input type="number" value={editForm.salePrice} onChange={(event) => setEditForm((prev) => ({ ...prev, salePrice: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Purchase Price</label>
                        <Input type="number" value={editForm.purchasePrice} onChange={(event) => setEditForm((prev) => ({ ...prev, purchasePrice: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">MRP</label>
                        <Input type="number" value={editForm.mrp} onChange={(event) => setEditForm((prev) => ({ ...prev, mrp: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Reorder Level</label>
                        <Input type="number" value={editForm.reorderLevel} onChange={(event) => setEditForm((prev) => ({ ...prev, reorderLevel: event.target.value }))} />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                    <Button onClick={() => { void saveEdit(); }} isLoading={isMutating}>Save</Button>
                </div>
            </Modal>

            <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title={`Adjust Stock${selectedItem ? `: ${selectedItem.name}` : ""}`}>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium">Delta (+/-)</label>
                        <Input type="number" value={adjustForm.delta} onChange={(event) => setAdjustForm((prev) => ({ ...prev, delta: event.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Reason</label>
                        <Input value={adjustForm.reason} onChange={(event) => setAdjustForm((prev) => ({ ...prev, reason: event.target.value }))} />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>Cancel</Button>
                    <Button onClick={() => { void applyAdjust(); }} isLoading={isMutating}>Apply</Button>
                </div>
            </Modal>
        </div>
    );
}
