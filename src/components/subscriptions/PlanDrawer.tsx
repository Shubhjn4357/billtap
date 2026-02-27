"use client";

import React, { useState, useEffect } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plan, planService } from "@/services/planService";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import { ShieldCheck, Box, Receipt, Wallet, Megaphone, BarChart3 } from "lucide-react";

interface PlanDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    plan?: Plan;
    onSuccess: () => void;
}

const MODULE_FEATURES = [
    { id: "feature_inventory", label: "Inventory Management", icon: Box, description: "Stock tracking, HSN codes, and low stock alerts." },
    { id: "feature_payroll", label: "Staff & Payroll", icon: Receipt, description: "Attendance, salary runs, and payslip generation." },
    { id: "feature_treasury", label: "Treasury & Banking", icon: Wallet, description: "Bank ledgers and voucher management." },
    { id: "feature_marketing", label: "Banners & Marketing", icon: Megaphone, description: "Control system-wide promotional banners." },
    { id: "feature_analytics", label: "Advanced Analytics", icon: BarChart3, description: "Deep-dive reports and trend analysis." },
];

export function PlanDrawer({ isOpen, onClose, plan, onSuccess }: PlanDrawerProps) {
    const [formData, setFormData] = useState<Partial<Plan>>({
        id: "",
        name: "",
        description: "",
        monthlyPrice: 0,
        currency: "INR",
        isActive: true,
        displayOrder: 0,
        features: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (plan) {
            setFormData(plan);
        } else {
            setFormData({
                id: `plan_${Date.now()}`,
                name: "",
                description: "",
                monthlyPrice: 0,
                currency: "INR",
                isActive: true,
                displayOrder: 0,
                features: [],
            });
        }
    }, [plan, isOpen]);

    const handleFeatureToggle = (featureId: string) => {
        const currentFeatures = formData.features || [];
        if (currentFeatures.includes(featureId)) {
            setFormData({ ...formData, features: currentFeatures.filter(f => f !== featureId) });
        } else {
            setFormData({ ...formData, features: [...currentFeatures, featureId] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (plan) {
                await planService.upsert(plan.id, formData);
                toast({
                    title: "Success",
                    description: "Plan updated successfully",
                    type: "success"
                });
            } else {
                await planService.create(formData);
                toast({
                    title: "Success",
                    description: "Plan created successfully",
                    type: "success"
                });
            }
            onSuccess();
            onClose();
        } catch {
            toast({
                title: "Error",
                description: "Failed to save plan",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={plan ? "Edit Plan" : "Create New Plan"}
            description={plan ? `Updating ${plan.name} configuration` : "Define a new subscription tier."}
            footer={
                <div className="flex gap-3 justify-end w-full">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} isLoading={isLoading}>
                        {plan ? "Save Plan" : "Create Plan"}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">General Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                            <label className="text-sm font-medium">Plan Name</label>
                            <Input
                                placeholder="e.g. Growth Plan"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Monthly Price</label>
                            <Input
                                type="number"
                                placeholder="499"
                                value={formData.monthlyPrice}
                                onChange={(e) => setFormData({ ...formData, monthlyPrice: Number(e.target.value) })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Currency</label>
                            <Input
                                placeholder="INR"
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Input
                            placeholder="Briefly describe what's included..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Module Access Control
                        </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">Select which modules companies on this plan can access.</p>

                    <div className="space-y-3">
                        {MODULE_FEATURES.map((feature) => {
                            const Icon = feature.icon;
                            const isEnabled = formData.features?.includes(feature.id);
                            return (
                                <div
                                    key={feature.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isEnabled ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${isEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            }`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-semibold">{feature.label}</p>
                                            <p className="text-[11px] text-muted-foreground leading-tight max-w-[200px]">{feature.description}</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isEnabled ?? false}
                                        onCheckedChange={() => handleFeatureToggle(feature.id)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold">Public Visibility</p>
                        <p className="text-xs text-muted-foreground">Whether this plan is visible to businesses.</p>
                    </div>
                    <Switch
                        checked={!!formData.isActive}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                </div>
            </form>
        </Sheet>
    );
}
