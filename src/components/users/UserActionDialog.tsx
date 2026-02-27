"use client";

import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User } from "@/types";
import { useUpdateUserRole, useManualSubscription } from "@/hooks/useUsers";
import { usePlans } from "@/hooks/usePlans";
import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

interface UserActionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User;
}

export function UserActionDialog({ isOpen, onClose, user }: UserActionDialogProps) {
    const updateUserRole = useUpdateUserRole();
    const manualSubscription = useManualSubscription();
    const { data: plans } = usePlans(true);
    const { toast } = useToast();

    const { register, handleSubmit, reset } = useForm({
        defaultValues: {
            role: "owner",
            planId: "",
            status: "active",
            durationDays: 30,
        },
    });

    useEffect(() => {
        if (user) {
            reset({
                role: user.role,
                planId: user.subscriptionPlanId || "",
                status: user.subscriptionStatus,
                durationDays: 30,
            });
        }
    }, [user, reset]);

    const onSubmit = async (data: { role: string; planId: string; status: string; durationDays: number | string }) => {
        if (!user) return;

        try {
            // Update Role
            if (data.role !== user.role) {
                await updateUserRole.mutateAsync({ uid: user.uid, role: data.role });
            }

            // Update Subscription if plan selected
            if (data.planId && data.planId !== user.subscriptionPlanId) {
                await manualSubscription.mutateAsync({
                    uid: user.uid,
                    planId: data.planId,
                    status: data.status,
                    durationDays: Number(data.durationDays),
                });
            } else if (data.status !== user.subscriptionStatus) {
                // Even if plan didn't change, status might (e.g. deactivate)
                // But logic requires planId. If we just want to change status, we need to send current planId too.
                // For simplicity, we only trigger subscription update if we explicitly want to change something meaningful.
                // If user just changes status, we might need to support that.
                if (user.subscriptionPlanId) {
                    await manualSubscription.mutateAsync({
                        uid: user.uid,
                        planId: user.subscriptionPlanId,
                        status: data.status,
                        durationDays: Number(data.durationDays) // Reset duration or keep? Logic might verify
                    });
                }
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update user.",
                type: "error",
            });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Manage User: ${user?.displayName || user?.email}`}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                <div className="space-y-2 border-b pb-4">
                    <h3 className="text-sm font-semibold">Role Management</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {['owner', 'staff', 'admin'].map((role) => (
                            <label key={role} className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-muted">
                                <input type="radio" value={role} {...register("role")} />
                                <span className="capitalize">{role}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Subscription Management</h3>

                    <div>
                        <label className="text-xs font-medium">Assign Plan</label>
                        <select
                            {...register("planId")}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">-- No Plan --</option>
                            {plans?.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.name} ({plan.currency} {plan.monthlyPrice})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium">Status</label>
                            <select
                                {...register("status")}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="canceled">Canceled</option>
                                <option value="past_due">Past Due</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium">Duration (Days)</label>
                            <Input type="number" {...register("durationDays")} />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Note: Updating subscription will reset the start/end dates based on duration.
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={updateUserRole.isPending || manualSubscription.isPending}>
                        Save Changes
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
