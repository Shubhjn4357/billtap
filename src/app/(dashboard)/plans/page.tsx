"use client";

import React, { useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Package, CheckCircle2, XCircle, Database, Trash2 } from "lucide-react";
import { usePlans } from "@/hooks/usePlans";
import { Plan } from "@/services/planService";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { api } from "@/lib/api";
import { planService } from "@/services/planService";
import { PlanDrawer } from "@/components/subscriptions/PlanDrawer";

export default function PlansPage() {
    const { data: plans, isLoading, refetch } = usePlans(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [seeding, setSeeding] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | undefined>(undefined);
    const { toast } = useToast();

    const filteredPlans = (plans || []).filter(plan =>
        plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSeed = async () => {
        setSeeding(true);
        try {
            await api.post("/admin/seed/default-plans");
            toast({
                title: "Success",
                description: "Default subscription plans seeded successfully.",
                type: "success",
            });
            await refetch();
        } catch (error) {
            toast({
                title: "Seed Failed",
                description: getErrorMessage(error, "Could not seed plans."),
                type: "error",
            });
        } finally {
            setSeeding(false);
        }
    };

    const handleCreate = () => {
        setSelectedPlan(undefined);
        setIsDrawerOpen(true);
    };

    const handleEdit = (plan: Plan) => {
        setSelectedPlan(plan);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (plan: Plan) => {
        if (!window.confirm(`Delete plan "${plan.displayName || plan.name}"?`)) return;
        try {
            await planService.delete(plan.id);
            toast({
                title: "Deleted",
                description: "Plan deleted successfully.",
                type: "success",
            });
            await refetch();
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Could not delete plan."),
                type: "error",
            });
        }
    };

    const columns = [
        {
            header: "Plan Tier",
            accessorKey: "name",
            cell: (p: Plan) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Package className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-semibold">{p.displayName || p.name}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{p.tier} - {p.billingCycle}</p>
                    </div>
                </div>
            )
        },
        {
            header: "Pricing",
            accessorKey: "monthlyPrice",
            cell: (p: Plan) => (
                <div className="font-semibold text-sm space-x-1">
                    <span>{p.currency} {p.monthlyPrice}</span>
                    <span className="text-xs font-normal text-muted-foreground">/ mon</span>
                </div>
            )
        },
        {
            header: "Quotas",
            accessorKey: "maxStaffUsers",
            cell: (p: Plan) => (
                <div className="text-xs space-y-1">
                    <p>Staff: {p.maxStaffUsers || "Unlimited"}</p>
                    <p className="text-muted-foreground">Biz: {p.maxBusinesses || "Unlimited"}</p>
                </div>
            )
        },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (p: Plan) => (
                <div className={p.isActive ? "text-green-600 flex items-center gap-1.5" : "text-muted-foreground flex items-center gap-1.5"}>
                    {p.isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-xs font-semibold uppercase tracking-wider">{p.isActive ? "Active" : "Archived"}</span>
                </div>
            )
        },
        {
            header: "Actions",
            accessorKey: "actions",
            className: "text-right",
            cell: (p: Plan) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(p);
                        }}
                    >
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(p);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscription Plans</h1>
                    <p className="text-muted-foreground">Manage billing tiers, access limits, and feature flags globally.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSeed} disabled={seeding} className="h-11 shadow-sm">
                        <Database className="mr-2 h-4 w-4" />
                        {seeding ? "Seeding..." : "Seed Default Plans"}
                    </Button>
                    <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={handleCreate}>
                        <Plus className="mr-2 h-5 w-5" />
                        Create Tier
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredPlans}
                        isLoading={isLoading}
                        searchPlaceholder="Filter by plan name..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        onRowClick={handleEdit}
                    />
                </CardContent>
            </Card>

            <PlanDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                plan={selectedPlan}
                onSuccess={async () => {
                    await refetch();
                }}
            />
        </div>
    );
}
