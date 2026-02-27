"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Zap, CheckCircle2, XCircle } from "lucide-react";
import { Plan, planService } from "@/services/planService";
import { useToast } from "@/components/ui/Toast";
import { PlanDrawer } from "@/components/subscriptions/PlanDrawer";

export default function SubscriptionsPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | undefined>(undefined);
    const { toast } = useToast();

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const data = await planService.getAll();
            setPlans(data);
        } catch {
            toast({
                title: "Error",
                description: "Failed to fetch plans",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEdit = (plan: Plan) => {
        setSelectedPlan(plan);
        setIsDrawerOpen(true);
    };

    const handleCreate = () => {
        setSelectedPlan(undefined);
        setIsDrawerOpen(true);
    };

    const columns = [
        {
            header: "Plan Name",
            accessorKey: "name",
            cell: (plan: Plan) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.id}</p>
                    </div>
                </div>
            )
        },
        {
            header: "Price",
            accessorKey: "monthlyPrice",
            cell: (plan: Plan) => (
                <div className="font-medium">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: plan.currency }).format(plan.monthlyPrice)}
                    <span className="text-xs text-muted-foreground ml-1">/mo</span>
                </div>
            )
        },
        {
            header: "Features",
            accessorKey: "features",
            cell: (plan: Plan) => (
                <div className="flex -space-x-2">
                    {plan.features.slice(0, 3).map((f, i) => (
                        <div key={i} className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold" title={f}>
                            {f.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {plan.features.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary">
                            +{plan.features.length - 3}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (plan: Plan) => (
                <div className={plan.isActive ? "text-green-600 flex items-center gap-1.5" : "text-red-500 flex items-center gap-1.5"}>
                    {plan.isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-xs font-semibold uppercase tracking-wider">{plan.isActive ? "Active" : "Inactive"}</span>
                </div>
            )
        },
        {
            header: "Actions",
            accessorKey: "actions",
            className: "text-right",
            cell: (plan: Plan) => (
                <Button variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(plan);
                }}>
                    Edit
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Subscriptions & Plans</h1>
                    <p className="text-muted-foreground">Define business tiers and control module access.</p>
                </div>
                <Button onClick={handleCreate} className="h-11 px-6 shadow-lg shadow-primary/20">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Plan
                </Button>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={plans}
                        isLoading={isLoading}
                        onRowClick={handleEdit}
                        emptyMessage="No plans configured."
                    />
                </CardContent>
            </Card>

            <PlanDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                plan={selectedPlan}
                onSuccess={fetchPlans}
            />
        </div>
    );
}
