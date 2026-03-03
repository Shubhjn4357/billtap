"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import {
    type BillingCycle,
    type Discount,
    type DiscountPayload,
    type DiscountScope,
    type DiscountType,
    type SubscriptionTier,
    discountService,
} from "@/services/discountService";

const TIER_OPTIONS: SubscriptionTier[] = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];
const CYCLE_OPTIONS: BillingCycle[] = ["MONTHLY", "YEARLY", "THREE_YEAR"];

const EMPTY_FORM: DiscountPayload = {
    code: "",
    type: "PERCENTAGE",
    scope: "GLOBAL",
    value: 0,
    maxRedemptions: null,
    perUserLimit: null,
    validFrom: null,
    validTo: null,
    applicableTiers: [],
    applicableBillingCycles: [],
    isActive: true,
};

export default function DiscountsPage() {
    const { toast } = useToast();
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [loading, setLoading] = useState(true);
    const [includeInactive, setIncludeInactive] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<Discount | null>(null);
    const [form, setForm] = useState<DiscountPayload>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const loadDiscounts = async () => {
        setLoading(true);
        try {
            const rows = await discountService.getAll(includeInactive);
            setDiscounts(rows);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to load discounts.",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadDiscounts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [includeInactive]);

    const filtered = useMemo(() => {
        if (!search.trim()) return discounts;
        const query = search.trim().toLowerCase();
        return discounts.filter((entry) =>
            entry.code.toLowerCase().includes(query)
            || entry.scope.toLowerCase().includes(query)
            || entry.type.toLowerCase().includes(query)
        );
    }, [discounts, search]);

    const openCreate = () => {
        setSelected(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    const openEdit = (discount: Discount) => {
        setSelected(discount);
        setForm({
            code: discount.code,
            type: discount.type,
            scope: discount.scope,
            value: discount.value,
            maxRedemptions: discount.maxRedemptions,
            perUserLimit: discount.perUserLimit,
            validFrom: discount.validFrom,
            validTo: discount.validTo,
            applicableTiers: discount.applicableTiers,
            applicableBillingCycles: discount.applicableBillingCycles,
            isActive: discount.isActive,
        });
        setModalOpen(true);
    };

    const saveDiscount = async () => {
        setSaving(true);
        try {
            if (selected) {
                await discountService.update(selected.id, form);
            } else {
                await discountService.create(form);
            }
            setModalOpen(false);
            await loadDiscounts();
            toast({
                title: "Success",
                description: selected ? "Discount updated." : "Discount created.",
                type: "success",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to save discount.",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const deactivate = async (discount: Discount) => {
        try {
            await discountService.deactivate(discount.id);
            await loadDiscounts();
            toast({ title: "Success", description: "Discount deactivated.", type: "success" });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to deactivate discount.",
                type: "error",
            });
        }
    };

    const columns = [
        {
            header: "Code",
            accessorKey: "code",
            cell: (entry: Discount) => (
                <div className="flex items-center gap-2">
                    <BadgePercent className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{entry.code}</span>
                </div>
            ),
        },
        {
            header: "Type",
            accessorKey: "type",
            cell: (entry: Discount) => (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entry.type}</span>
            ),
        },
        {
            header: "Scope",
            accessorKey: "scope",
            cell: (entry: Discount) => (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entry.scope}</span>
            ),
        },
        {
            header: "Value",
            accessorKey: "value",
            cell: (entry: Discount) => (
                <span className="font-medium">{entry.type === "PERCENTAGE" ? `${entry.value}%` : `INR ${entry.value.toLocaleString()}`}</span>
            ),
        },
        {
            header: "Redemptions",
            accessorKey: "redemptionCount",
            cell: (entry: Discount) => (
                <span className="text-sm">
                    {entry.redemptionCount}
                    {entry.maxRedemptions ? ` / ${entry.maxRedemptions}` : ""}
                </span>
            ),
        },
        {
            header: "Active",
            accessorKey: "isActive",
            cell: (entry: Discount) => (
                <Switch checked={entry.isActive} onCheckedChange={() => {
                    if (entry.isActive) {
                        void deactivate(entry);
                    } else {
                        void discountService.update(entry.id, { isActive: true }).then(loadDiscounts);
                    }
                }} />
            ),
        },
        {
            header: "Actions",
            accessorKey: "actions",
            className: "text-right",
            cell: (entry: Discount) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        openEdit(entry);
                    }}
                >
                    Edit
                </Button>
            ),
        },
    ];

    const toggleTier = (tier: SubscriptionTier) => {
        const current = form.applicableTiers ?? [];
        const next = current.includes(tier) ? current.filter((entry) => entry !== tier) : [...current, tier];
        setForm((prev) => ({ ...prev, applicableTiers: next }));
    };

    const toggleCycle = (cycle: BillingCycle) => {
        const current = form.applicableBillingCycles ?? [];
        const next = current.includes(cycle) ? current.filter((entry) => entry !== cycle) : [...current, cycle];
        setForm((prev) => ({ ...prev, applicableBillingCycles: next }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Discounts</h1>
                    <p className="text-muted-foreground">Create and control promotional discount codes.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => void loadDiscounts()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Discount
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filtered}
                        isLoading={loading}
                        onRowClick={openEdit}
                        searchPlaceholder="Search by code/type/scope..."
                        searchValue={search}
                        onSearchChange={setSearch}
                        emptyMessage="No discounts available."
                    />
                    <div className="mt-3 flex items-center gap-2 px-1">
                        <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
                        <span className="text-sm text-muted-foreground">Include inactive discounts</span>
                    </div>
                </CardContent>
            </Card>

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={selected ? `Edit ${selected.code}` : "Create Discount"}
                className="max-w-2xl"
            >
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Code</label>
                            <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Value</label>
                            <Input type="number" value={String(form.value ?? 0)} onChange={(event) => setForm((prev) => ({ ...prev, value: Number(event.target.value || 0) }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Type</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={form.type}
                                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as DiscountType }))}
                            >
                                <option value="PERCENTAGE">PERCENTAGE</option>
                                <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Scope</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={form.scope}
                                onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value as DiscountScope }))}
                            >
                                <option value="GLOBAL">GLOBAL</option>
                                <option value="TIER">TIER</option>
                                <option value="PLAN">PLAN</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Max Redemptions</label>
                            <Input type="number" value={form.maxRedemptions ?? ""} onChange={(event) => setForm((prev) => ({
                                ...prev,
                                maxRedemptions: event.target.value ? Number(event.target.value) : null,
                            }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Per User Limit</label>
                            <Input type="number" value={form.perUserLimit ?? ""} onChange={(event) => setForm((prev) => ({
                                ...prev,
                                perUserLimit: event.target.value ? Number(event.target.value) : null,
                            }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Valid From</label>
                            <Input type="datetime-local" value={form.validFrom ? form.validFrom.slice(0, 16) : ""} onChange={(event) => setForm((prev) => ({ ...prev, validFrom: event.target.value || null }))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Valid To</label>
                            <Input type="datetime-local" value={form.validTo ? form.validTo.slice(0, 16) : ""} onChange={(event) => setForm((prev) => ({ ...prev, validTo: event.target.value || null }))} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Applicable Tiers</p>
                        <div className="flex flex-wrap gap-2">
                            {TIER_OPTIONS.map((tier) => {
                                const selectedTier = (form.applicableTiers ?? []).includes(tier);
                                return (
                                    <Button key={tier} variant={selectedTier ? "default" : "outline"} size="sm" onClick={() => toggleTier(tier)}>
                                        {tier}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Applicable Billing Cycles</p>
                        <div className="flex flex-wrap gap-2">
                            {CYCLE_OPTIONS.map((cycle) => {
                                const selectedCycle = (form.applicableBillingCycles ?? []).includes(cycle);
                                return (
                                    <Button key={cycle} variant={selectedCycle ? "default" : "outline"} size="sm" onClick={() => toggleCycle(cycle)}>
                                        {cycle}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm font-medium">Active</span>
                        <Switch checked={Boolean(form.isActive)} onCheckedChange={(next) => setForm((prev) => ({ ...prev, isActive: next }))} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={() => void saveDiscount()} isLoading={saving}>Save</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
