import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { organizationService, type BusinessQuotas } from "@/services/organizationService";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";

const EMPTY_QUOTAS: BusinessQuotas = {
    maxInvoicesTotal: null,
    maxStaffUsers: null,
    storageLimitMb: null,
};

export function QuotasTab({ organizationId }: { organizationId: string }) {
    const [quotas, setQuotas] = useState<BusinessQuotas>(EMPTY_QUOTAS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!organizationId) return;
        const fetchQuotas = async () => {
            setIsLoading(true);
            try {
                const data = await organizationService.getQuotas(organizationId);
                setQuotas({
                    maxInvoicesTotal: data.maxInvoicesTotal ?? null,
                    maxStaffUsers: data.maxStaffUsers ?? null,
                    storageLimitMb: data.storageLimitMb ?? null,
                });
            } catch (error) {
                toast({ title: "Error", description: getErrorMessage(error, "Failed to load quotas"), type: "error" });
            } finally {
                setIsLoading(false);
            }
        };
        void fetchQuotas();
    }, [organizationId, toast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await organizationService.updateQuotas(organizationId, {
                maxInvoicesTotal: quotas.maxInvoicesTotal,
                maxStaffUsers: quotas.maxStaffUsers,
                storageLimitMb: quotas.storageLimitMb,
            });
            toast({ title: "Saved", description: "Business quotas updated.", type: "success" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to update quotas"), type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading quotas...</div>;

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Max Invoices Total</label>
                    <Input
                        type="number"
                        placeholder="Unlimited (Leave empty)"
                        value={quotas.maxInvoicesTotal ?? ""}
                        onChange={(e) => setQuotas({ ...quotas, maxInvoicesTotal: e.target.value ? Number(e.target.value) : null })}
                    />
                    <p className="text-xs text-muted-foreground">Absolute limit on total invoices that can be created.</p>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Max Staff Users</label>
                    <Input
                        type="number"
                        placeholder="Unlimited (Leave empty)"
                        value={quotas.maxStaffUsers ?? ""}
                        onChange={(e) => setQuotas({ ...quotas, maxStaffUsers: e.target.value ? Number(e.target.value) : null })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Storage Limit (MB)</label>
                    <Input
                        type="number"
                        placeholder="Unlimited (Leave empty)"
                        value={quotas.storageLimitMb ?? ""}
                        onChange={(e) => setQuotas({ ...quotas, storageLimitMb: e.target.value ? Number(e.target.value) : null })}
                    />
                </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? "Saving..." : "Update Quotas"}
            </Button>
        </div>
    );
}
