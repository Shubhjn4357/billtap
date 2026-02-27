"use client";

import { useForm, useFieldArray, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plan } from "@/types";
import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

const planSchema = z.object({
    id: z.string().min(1, "ID is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    monthlyPrice: z.coerce.number().min(0),
    currency: z.string().length(3),
    isActive: z.boolean(),
    displayOrder: z.coerce.number().int(),
    features: z.array(z.object({ value: z.string().min(1, "Feature cannot be empty") })),
});

type PlanFormData = z.infer<typeof planSchema>;

interface PlanDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<Plan, "createdAt" | "updatedAt">) => Promise<void>;
    initialData?: Plan;
    isSubmitting?: boolean;
}

export function PlanDialog({ isOpen, onClose, onSubmit, initialData, isSubmitting }: PlanDialogProps) {
    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<PlanFormData>({
        resolver: zodResolver(planSchema) as Resolver<PlanFormData>,
        defaultValues: {
            id: "",
            name: "",
            description: "",
            monthlyPrice: 0,
            currency: "INR",
            isActive: true,
            displayOrder: 0,
            features: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "features",
    });

    const handleFormSubmit = (data: PlanFormData) => {
        const payload = {
            ...data,
            features: data.features.map(f => f.value),
        };

        return onSubmit(payload);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset({
                    ...initialData,
                    features: initialData.features.map(f => ({ value: f })),
                });
            } else {
                reset({
                    id: "",
                    name: "",
                    description: "",
                    monthlyPrice: 0,
                    currency: "INR",
                    isActive: true,
                    displayOrder: 0,
                    features: [],
                });
            }
        }
    }, [isOpen, initialData, reset]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Edit Plan" : "Create New Plan"}
        >
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                {!initialData && (
                    <div>
                        <label className="text-sm font-medium">Plan ID (Unique)</label>
                        <Input {...register("id")} placeholder="e.g. basic-monthly" />
                        {errors.id && <p className="text-xs text-destructive">{errors.id.message}</p>}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input {...register("name")} placeholder="Gold Plan" />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium">Currency</label>
                        <Input {...register("currency")} placeholder="INR" maxLength={3} />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input {...register("description")} placeholder="Best for growing teams" />
                    {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Monthly Price</label>
                        <Input type="number" {...register("monthlyPrice")} />
                        {errors.monthlyPrice && <p className="text-xs text-destructive">{errors.monthlyPrice.message}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium">Display Order</label>
                        <Input type="number" {...register("displayOrder")} />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium flex justify-between items-center mb-2">
                        Features
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })}>
                            <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex gap-2">
                                <Input
                                    {...register(`features.${index}.value` as const)}
                                    placeholder="Feature name"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        {fields.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No features added.</p>}
                    </div>
                    {errors.features && <p className="text-xs text-destructive">{errors.features.message}</p>}
                </div>

                <div className="flex items-center gap-2">
                    <input type="checkbox" {...register("isActive")} id="isActive" className="w-4 h-4" />
                    <label htmlFor="isActive" className="text-sm font-medium">Active (Visible to users)</label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={isSubmitting}>Save Plan</Button>
                </div>
            </form>
        </Modal>
    );
}
