"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { BellRing, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { canManagePricingForRole, normalizeAdminRole } from "@/lib/rbac";
import { type NotificationChannel, type NotificationTemplate, notificationService } from "@/services/notificationService";

type TemplateFormState = {
    id: string | null;
    name: string;
    eventKey: string;
    channel: NotificationChannel;
    subject: string;
    body: string;
    variables: string;
    isActive: boolean;
};

const DEFAULT_FORM: TemplateFormState = {
    id: null,
    name: "",
    eventKey: "",
    channel: "IN_APP",
    subject: "",
    body: "",
    variables: "",
    isActive: true,
};

export default function NotificationTemplatesPage() {
    const { data: session } = useSession();
    const role = normalizeAdminRole(session as { adminRole?: string | null } | null);
    const canManage = canManagePricingForRole(role);
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState<TemplateFormState>(DEFAULT_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkAction, setBulkAction] = useState<"ACTIVATE" | "DEACTIVATE" | "DELETE">("ACTIVATE");
    const [isBulkRunning, setIsBulkRunning] = useState(false);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const rows = await notificationService.getTemplates(true);
            setTemplates(rows);
        } catch (error) {
            toast({
                title: "Load failed",
                description: getErrorMessage(error, "Unable to load templates."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return templates;
        return templates.filter((entry) =>
            [entry.name, entry.eventKey, entry.channel, entry.subject ?? "", entry.body]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [search, templates]);

    const allFilteredIds = useMemo(() => filtered.map((entry) => entry.id), [filtered]);

    const resetForm = () => setForm(DEFAULT_FORM);

    const onRowClick = (row: NotificationTemplate) => {
        setForm({
            id: row.id,
            name: row.name,
            eventKey: row.eventKey,
            channel: row.channel,
            subject: row.subject ?? "",
            body: row.body,
            variables: row.variables.join(", "),
            isActive: row.isActive,
        });
    };

    const saveTemplate = async () => {
        if (!canManage) {
            toast({ title: "Read-only", description: "Only SUPER_ADMIN can modify templates.", type: "info" });
            return;
        }
        if (!form.name.trim() || !form.eventKey.trim() || !form.body.trim()) {
            toast({ title: "Missing fields", description: "Name, event key, and body are required.", type: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                eventKey: form.eventKey.trim(),
                channel: form.channel,
                subject: form.subject.trim() || null,
                body: form.body.trim(),
                variables: form.variables.split(",").map((entry) => entry.trim()).filter(Boolean),
                isActive: form.isActive,
            };

            if (form.id) {
                await notificationService.updateTemplate(form.id, payload);
                toast({ title: "Updated", description: "Template updated successfully.", type: "success" });
            } else {
                await notificationService.createTemplate(payload);
                toast({ title: "Created", description: "Template created successfully.", type: "success" });
            }

            await loadTemplates();
            resetForm();
        } catch (error) {
            toast({
                title: "Save failed",
                description: getErrorMessage(error, "Unable to save template."),
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTemplate = async (id: string) => {
        if (!canManage) {
            toast({ title: "Read-only", description: "Only SUPER_ADMIN can delete templates.", type: "info" });
            return;
        }
        if (!window.confirm("Delete this template?")) return;
        try {
            await notificationService.deleteTemplate(id);
            toast({ title: "Deleted", description: "Template deleted successfully.", type: "success" });
            await loadTemplates();
            if (form.id === id) resetForm();
        } catch (error) {
            toast({
                title: "Delete failed",
                description: getErrorMessage(error, "Unable to delete template."),
                type: "error",
            });
        }
    };

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
    };

    const runBulkAction = async () => {
        if (!canManage) {
            toast({ title: "Read-only", description: "Only SUPER_ADMIN can run bulk actions.", type: "info" });
            return;
        }
        if (selectedIds.length === 0) {
            toast({ title: "No selection", description: "Select at least one template.", type: "error" });
            return;
        }
        if (bulkAction === "DELETE" && !window.confirm(`Delete ${selectedIds.length} template(s)?`)) return;

        setIsBulkRunning(true);
        try {
            const result = await notificationService.bulkTemplateAction({
                ids: selectedIds,
                action: bulkAction,
            });
            toast({
                title: "Bulk action completed",
                description: `${bulkAction} applied. ${result.affected} record(s) affected.`,
                type: "success",
            });
            setSelectedIds([]);
            await loadTemplates();
        } catch (error) {
            toast({
                title: "Bulk action failed",
                description: getErrorMessage(error, "Unable to apply bulk action."),
                type: "error",
            });
        } finally {
            setIsBulkRunning(false);
        }
    };

    const columns = [
        {
            header: "Select",
            accessorKey: "id",
            cell: (row: NotificationTemplate) => (
                <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelected(row.id)}
                    onClick={(event) => event.stopPropagation()}
                />
            ),
        },
        { header: "Name", accessorKey: "name" },
        { header: "Event Key", accessorKey: "eventKey" },
        { header: "Channel", accessorKey: "channel" },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (row: NotificationTemplate) => (
                <span className={row.isActive ? "text-green-600 font-semibold" : "text-muted-foreground font-semibold"}>
                    {row.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            header: "Updated",
            accessorKey: "updatedAt",
            cell: (row: NotificationTemplate) => new Date(row.updatedAt).toLocaleString(),
        },
        {
            header: "Actions",
            accessorKey: "id",
            className: "text-right",
            cell: (row: NotificationTemplate) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={!canManage}
                    onClick={(event) => {
                        event.stopPropagation();
                        void deleteTemplate(row.id);
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Notification Templates</h1>
                <p className="text-muted-foreground">Event templates for in-app, push, and email channels.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="flex items-center gap-2">
                                <BellRing className="h-5 w-5 text-primary" />
                                Template List
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedIds(allFilteredIds)}>
                                    Select Filtered
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                                    Clear
                                </Button>
                                <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "ACTIVATE" | "DEACTIVATE" | "DELETE")}>
                                    <option value="ACTIVATE">Bulk Activate</option>
                                    <option value="DEACTIVATE">Bulk Deactivate</option>
                                    <option value="DELETE">Bulk Delete</option>
                                </Select>
                                <Button onClick={() => { void runBulkAction(); }} disabled={!canManage || isBulkRunning || selectedIds.length === 0}>
                                    {isBulkRunning ? "Applying..." : `Apply (${selectedIds.length})`}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={columns}
                            data={filtered}
                            isLoading={isLoading}
                            onRowClick={onRowClick}
                            searchPlaceholder="Search templates..."
                            searchValue={search}
                            onSearchChange={setSearch}
                        />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>{form.id ? "Edit Template" : "New Template"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            placeholder="Template name"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                            placeholder="Event key (e.g. invoice.created)"
                            value={form.eventKey}
                            onChange={(e) => setForm((prev) => ({ ...prev, eventKey: e.target.value }))}
                        />
                        <Select
                            value={form.channel}
                            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value as NotificationChannel }))}
                        >
                            {["IN_APP", "PUSH", "EMAIL"].map((entry) => (
                                <option key={entry} value={entry}>{entry}</option>
                            ))}
                        </Select>
                        <Input
                            placeholder="Subject (optional)"
                            value={form.subject}
                            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                        />
                        <textarea
                            className="w-full rounded-xl border px-3 py-2 text-sm min-h-28"
                            placeholder="Body"
                            value={form.body}
                            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                        />
                        <Input
                            placeholder="Variables (comma separated)"
                            value={form.variables}
                            onChange={(e) => setForm((prev) => ({ ...prev, variables: e.target.value }))}
                        />
                        <label className="flex items-center gap-2 text-sm">
                            <Switch checked={form.isActive} onCheckedChange={(next) => setForm((prev) => ({ ...prev, isActive: next }))} />
                            Active
                        </label>

                        <div className="flex gap-2">
                            <Button onClick={saveTemplate} disabled={!canManage || isSaving} className="flex-1">
                                {form.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {isSaving ? "Saving..." : form.id ? "Update" : "Create"}
                            </Button>
                            <Button variant="outline" onClick={resetForm}>Reset</Button>
                        </div>
                        {!canManage ? (
                            <p className="text-xs text-muted-foreground">Template changes are restricted to SUPER_ADMIN.</p>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
