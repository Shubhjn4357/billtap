"use client";

import React, { useMemo, useState } from "react";
import {
    CreditCard,
    Database,
    Edit,
    FileText,
    Layers3,
    Plus,
    Sparkles,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useTemplates } from "@/hooks/useTemplates";
import { Template } from "@/types";
import { TemplateDrawer } from "@/components/templates/TemplateDrawer";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { getStructuredTemplateDraft } from "@/components/templates/templateConfig";
import { getErrorMessage } from "@/lib/api-error";

const PREMADE_TEMPLATES = [
    {
        name: "Standard GST Invoice",
        type: "invoice" as const,
        content: {
            layoutPreset: "classic",
            accentTone: "slate",
            headline: "Tax Invoice",
            subheadline: "Standard GST-ready format",
            footerNote: "Thank you for your business.",
            showLogo: true,
            showGst: true,
            showSignature: false,
        },
        isDefault: true,
        isActive: true,
    },
    {
        name: "Thermal Counter Bill",
        type: "invoice" as const,
        content: {
            layoutPreset: "thermal",
            accentTone: "amber",
            headline: "Counter Bill",
            subheadline: "Fast thermal billing profile",
            footerNote: "Visit again soon.",
            showLogo: false,
            showGst: false,
            showSignature: false,
        },
        isDefault: false,
        isActive: true,
    },
    {
        name: "Executive Business Card",
        type: "card" as const,
        content: {
            layoutPreset: "banking",
            accentTone: "slate",
            headline: "Business Card",
            subheadline: "Ready for sharing and QR action",
            footerNote: "Counter billing • GST • UPI",
            showLogo: true,
            showQr: true,
        },
        isDefault: true,
        isActive: true,
    },
];

export default function TemplatesPage() {
    const { data: templates, isLoading, createTemplate, updateTemplate, deleteTemplate, refetch } = useTemplates();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | undefined>(undefined);
    const [seeding, setSeeding] = useState(false);
    const { toast } = useToast();

    const templateRows = useMemo(() => templates ?? [], [templates]);
    const invoiceTemplates = useMemo(
        () => templateRows.filter((entry) => entry.type === "invoice"),
        [templateRows]
    );
    const cardTemplates = useMemo(
        () => templateRows.filter((entry) => entry.type === "card"),
        [templateRows]
    );
    const emailTemplates = useMemo(
        () => templateRows.filter((entry) => entry.type === "email"),
        [templateRows]
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

    const handleSeed = async () => {
        setSeeding(true);
        try {
            for (const template of PREMADE_TEMPLATES) {
                await createTemplate.mutateAsync(template);
            }
            toast({
                title: "Templates Seeded",
                description: "Preview-ready default templates were added successfully.",
                type: "success",
            });
            await refetch();
        } catch (error) {
            toast({
                title: "Seed Failed",
                description: getErrorMessage(error, "Failed to inject templates."),
                type: "error",
            });
        } finally {
            setSeeding(false);
        }
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
                    payload,
                });
                toast({
                    title: "Saved",
                    description: "Template updated successfully.",
                    type: "success",
                });
            } else {
                await createTemplate.mutateAsync(payload);
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

    if (isLoading) return <div className="p-8">Loading templates...</div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
                    <p className="text-muted-foreground">Preview-first invoice, business card, and email template management for Vahi.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                        <Database className="mr-2 h-4 w-4" />
                        {seeding ? "Injecting..." : "Seed Preview Defaults"}
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="All Templates" value={String(templateRows.length)} icon={Layers3} meta="Active and draft presets combined" />
                <SummaryCard title="Invoice Templates" value={String(invoiceTemplates.length)} icon={FileText} meta="GST, PDF, and thermal designs" />
                <SummaryCard title="Business Cards" value={String(cardTemplates.length)} icon={CreditCard} meta="Share-ready identity layouts" />
                <SummaryCard title="Preview Ready" value={String(templateRows.filter((entry) => entry.isActive).length)} icon={Sparkles} meta="Currently active and usable" />
            </div>

            <TemplateSection
                title="Invoices"
                icon={<FileText className="h-5 w-5" />}
                templates={invoiceTemplates}
                onEdit={openEdit}
                onDelete={handleDelete}
            />
            <TemplateSection
                title="Business Cards"
                icon={<CreditCard className="h-5 w-5" />}
                templates={cardTemplates}
                onEdit={openEdit}
                onDelete={handleDelete}
            />
            <TemplateSection
                title="Email Templates"
                icon={<Sparkles className="h-5 w-5" />}
                templates={emailTemplates}
                onEdit={openEdit}
                onDelete={handleDelete}
            />

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

function TemplateSection({
    title,
    icon,
    templates,
    onEdit,
    onDelete,
}: {
    title: string;
    icon: React.ReactNode;
    templates: Template[];
    onEdit: (template: Template) => void;
    onDelete: (template: Template) => Promise<void>;
}) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            {templates.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">
                    No templates found in this category.
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                    {templates.map((template) => {
                        const previewMeta = getStructuredTemplateDraft(template.type, template.content);
                        return (
                            <Card key={template.id} className="overflow-hidden">
                                <CardHeader className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-lg">{template.name}</CardTitle>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {previewMeta.layoutPreset} • {previewMeta.accentTone}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                                            {template.isDefault ? (
                                                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-700">Default</span>
                                            ) : null}
                                            <span className={`rounded-full px-2 py-1 ${template.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-700"}`}>
                                                {template.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <TemplatePreview type={template.type} name={template.name} content={template.content} compact />
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => { void onDelete(template); }}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function SummaryCard({
    title,
    value,
    meta,
    icon: Icon,
}: {
    title: string;
    value: string;
    meta: string;
    icon: React.ElementType;
}) {
    return (
        <Card className="border-none bg-muted/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
            </CardContent>
        </Card>
    );
}
