"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { CreditCard, Edit, FileText, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTemplates } from "@/hooks/useTemplates";
import { Template } from "@/types";
import { TemplateDrawer } from "@/components/templates/TemplateDrawer";
import { getErrorMessage } from "@/lib/api-error";

export default function TemplatesPage() {
    const { data: templates, isLoading, createTemplate, updateTemplate, deleteTemplate, refetch } = useTemplates();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | undefined>(undefined);
    const { toast } = useToast();

    const billTemplates = useMemo(
        () => (templates ?? []).filter((entry) => entry.type === "invoice"),
        [templates]
    );
    const cardTemplates = useMemo(
        () => (templates ?? []).filter((entry) => entry.type === "card"),
        [templates]
    );

    const saving = createTemplate.isPending || updateTemplate.isPending;

    const openCreate = () => {
        setSelectedTemplate(undefined);
        setIsDrawerOpen(true);
    };

    const openEdit = (template: Template) => {
        setSelectedTemplate(template);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (template: Template) => {
        try {
            await deleteTemplate.mutateAsync(template.id);
            toast({
                title: "Deleted",
                description: `${template.name} removed successfully.`,
                type: "success",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to delete template."),
                type: "error",
            });
        }
    };

    const handleSave = async (payload: {
        id?: string;
        name: string;
        type: "invoice" | "card" | "email";
        thumbnailUrl?: string;
        isDefault: boolean;
        isActive: boolean;
        content: Record<string, unknown>;
    }) => {
        try {
            if (payload.id) {
                await updateTemplate.mutateAsync({
                    id: payload.id,
                    payload: {
                        name: payload.name,
                        type: payload.type,
                        thumbnailUrl: payload.thumbnailUrl,
                        isDefault: payload.isDefault,
                        isActive: payload.isActive,
                        content: payload.content,
                    },
                });
                toast({
                    title: "Saved",
                    description: "Template updated successfully.",
                    type: "success",
                });
            } else {
                await createTemplate.mutateAsync({
                    name: payload.name,
                    type: payload.type,
                    thumbnailUrl: payload.thumbnailUrl,
                    isDefault: payload.isDefault,
                    isActive: payload.isActive,
                    content: payload.content,
                });
                toast({
                    title: "Created",
                    description: "Template created successfully.",
                    type: "success",
                });
            }
            setIsDrawerOpen(false);
            setSelectedTemplate(undefined);
            await refetch();
        } catch (error) {
            throw new Error(getErrorMessage(error, "Failed to save template."));
        }
    };

    const renderTemplateSection = (title: string, icon: React.ReactNode, entries: Template[]) => (
        <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                {icon}
                {title}
            </h3>
            {entries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    No templates found in this category.
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
                    {entries.map((template) => (
                        <div key={template.id} className="group relative border rounded-lg overflow-hidden bg-card shadow-sm">
                            <div className="aspect-[4/3] bg-muted relative">
                                {template.thumbnailUrl ? (
                                    <Image
                                        unoptimized
                                        src={template.thumbnailUrl}
                                        alt={template.name}
                                        className="w-full h-full object-cover"
                                        fill
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                                        No thumbnail
                                    </div>
                                )}
                                {template.isDefault ? (
                                    <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center shadow-sm">
                                        <Star className="w-3 h-3 mr-1 fill-current" />
                                        Default
                                    </div>
                                ) : null}
                            </div>
                            <div className="p-3 border-t space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-medium truncate">{template.name}</h4>
                                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${template.isActive ? "text-green-600" : "text-muted-foreground"}`}>
                                        {template.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(template)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { void handleDelete(template); }}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    if (isLoading) return <div className="p-8">Loading templates...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
                    <p className="text-muted-foreground">Manage invoice designs and business cards.</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New
                </Button>
            </div>

            {renderTemplateSection("Invoices", <FileText className="w-5 h-5" />, billTemplates)}
            {renderTemplateSection("Business Cards", <CreditCard className="w-5 h-5" />, cardTemplates)}

            <TemplateDrawer
                isOpen={isDrawerOpen}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setSelectedTemplate(undefined);
                }}
                template={selectedTemplate}
                isSaving={saving}
                onSave={handleSave}
            />
        </div>
    );
}
