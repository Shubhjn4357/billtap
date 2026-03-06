"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Play, Square, CalendarClock, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { canManagePricingForRole, normalizeAdminRole } from "@/lib/rbac";
import { type NotificationCampaign, type NotificationChannel, type NotificationTemplate, notificationService } from "@/services/notificationService";

type CampaignFormState = {
    id: string | null;
    title: string;
    templateId: string;
    channel: NotificationChannel;
    audience: string;
    status: string;
    scheduledAt: string;
};

const DEFAULT_FORM: CampaignFormState = {
    id: null,
    title: "",
    templateId: "",
    channel: "SMS",
    audience: "all",
    status: "DRAFT",
    scheduledAt: "",
};

export default function NotificationCampaignsPage() {
    const { data: session } = useSession();
    const role = normalizeAdminRole(session as { adminRole?: string | null } | null);
    const canManage = canManagePricingForRole(role);
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState<CampaignFormState>(DEFAULT_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [runningScheduled, setRunningScheduled] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkAction, setBulkAction] = useState<"TRIGGER" | "CANCEL" | "DELETE">("TRIGGER");
    const [isBulkRunning, setIsBulkRunning] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [campaignRows, templateRows] = await Promise.all([
                notificationService.getCampaigns(),
                notificationService.getTemplates(true),
            ]);
            setCampaigns(campaignRows);
            setTemplates(templateRows);
        } catch (error) {
            toast({
                title: "Load failed",
                description: getErrorMessage(error, "Unable to load campaigns."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const templateById = useMemo(() => new Map(templates.map((entry) => [entry.id, entry])), [templates]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return campaigns;
        return campaigns.filter((entry) =>
            [entry.title, entry.channel, entry.audience, entry.status, templateById.get(entry.templateId ?? "")?.name ?? ""]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [campaigns, search, templateById]);

    const allFilteredIds = useMemo(() => filtered.map((entry) => entry.id), [filtered]);

    const resetForm = () => setForm(DEFAULT_FORM);

    const onRowClick = (row: NotificationCampaign) => {
        setForm({
            id: row.id,
            title: row.title,
            templateId: row.templateId ?? "",
            channel: row.channel,
            audience: row.audience,
            status: row.status,
            scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString().slice(0, 16) : "",
        });
    };

    const saveCampaign = async () => {
        if (!canManage) {
            toast({ title: "Read-only", description: "Only SUPER_ADMIN can modify campaigns.", type: "info" });
            return;
        }
        if (!form.title.trim()) {
            toast({ title: "Title required", description: "Campaign title is mandatory.", type: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                templateId: form.templateId.trim() || null,
                channel: form.channel,
                audience: form.audience.trim() || "all",
                status: form.status.trim() || "DRAFT",
                scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
            };

            if (form.id) {
                await notificationService.updateCampaign(form.id, payload);
                toast({ title: "Updated", description: "Campaign updated.", type: "success" });
            } else {
                await notificationService.createCampaign(payload);
                toast({ title: "Created", description: "Campaign created.", type: "success" });
            }

            await loadData();
            resetForm();
        } catch (error) {
            toast({
                title: "Save failed",
                description: getErrorMessage(error, "Unable to save campaign."),
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const triggerCampaign = async (id: string) => {
        if (!canManage) return;
        try {
            const res = await notificationService.triggerCampaign(id);
            toast({ title: "Triggered", description: `Queued ${res.deliveriesQueued} deliveries.`, type: "success" });
            await loadData();
        } catch (error) {
            toast({ title: "Trigger failed", description: getErrorMessage(error, "Unable to trigger."), type: "error" });
        }
    };

    const cancelCampaign = async (id: string) => {
        if (!canManage) return;
        try {
            await notificationService.cancelCampaign(id);
            toast({ title: "Cancelled", description: "Campaign cancelled.", type: "success" });
            await loadData();
        } catch (error) {
            toast({ title: "Cancel failed", description: getErrorMessage(error, "Unable to cancel."), type: "error" });
        }
    };

    const runScheduled = async () => {
        if (!canManage) return;
        setRunningScheduled(true);
        try {
            const res = await notificationService.runScheduledCampaigns();
            toast({
                title: "Scheduled executor",
                description: `Processed ${res.processed}, queued ${res.deliveriesQueued}.`,
                type: "success",
            });
            await loadData();
        } catch (error) {
            toast({
                title: "Executor failed",
                description: getErrorMessage(error, "Unable to run scheduled campaigns."),
                type: "error",
            });
        } finally {
            setRunningScheduled(false);
        }
    };

    const deleteCampaign = async (id: string) => {
        if (!canManage) return;
        if (!window.confirm("Delete this campaign and related deliveries?")) return;
        try {
            await notificationService.deleteCampaign(id);
            toast({ title: "Deleted", description: "Campaign deleted.", type: "success" });
            await loadData();
            if (form.id === id) resetForm();
        } catch (error) {
            toast({ title: "Delete failed", description: getErrorMessage(error, "Unable to delete."), type: "error" });
        }
    };

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
    };

    const runBulkAction = async () => {
        if (!canManage) return;
        if (selectedIds.length === 0) {
            toast({ title: "No selection", description: "Select at least one campaign.", type: "error" });
            return;
        }
        if (bulkAction === "DELETE" && !window.confirm(`Delete ${selectedIds.length} campaign(s)?`)) return;

        setIsBulkRunning(true);
        try {
            const result = await notificationService.bulkCampaignAction({
                ids: selectedIds,
                action: bulkAction,
            });
            toast({
                title: "Bulk action completed",
                description: `${bulkAction} applied to ${result.affected} campaign(s). Deliveries queued: ${result.deliveriesQueued}.`,
                type: "success",
            });
            setSelectedIds([]);
            await loadData();
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
            cell: (row: NotificationCampaign) => (
                <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelected(row.id)}
                    onClick={(event) => event.stopPropagation()}
                />
            ),
        },
        { header: "Title", accessorKey: "title" },
        {
            header: "Template",
            accessorKey: "templateId",
            cell: (row: NotificationCampaign) => templateById.get(row.templateId ?? "")?.name ?? "None",
        },
        { header: "Channel", accessorKey: "channel" },
        { header: "Status", accessorKey: "status" },
        {
            header: "Schedule",
            accessorKey: "scheduledAt",
            cell: (row: NotificationCampaign) => row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : "-",
        },
        {
            header: "Actions",
            accessorKey: "id",
            className: "text-right",
            cell: (row: NotificationCampaign) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                            event.stopPropagation();
                            void triggerCampaign(row.id);
                        }}
                        disabled={!canManage}
                    >
                        <Play className="h-4 w-4 mr-1" />
                        Trigger
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                            event.stopPropagation();
                            void cancelCampaign(row.id);
                        }}
                        disabled={!canManage}
                    >
                        <Square className="h-4 w-4 mr-1" />
                        Cancel
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(event) => {
                            event.stopPropagation();
                            void deleteCampaign(row.id);
                        }}
                        disabled={!canManage}
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notification Campaigns</h1>
                    <p className="text-muted-foreground">Create, schedule, trigger and cancel broadcast campaigns.</p>
                </div>
                <Button onClick={runScheduled} disabled={!canManage || runningScheduled}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {runningScheduled ? "Running..." : "Run Scheduled"}
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle>Campaign List</CardTitle>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedIds(allFilteredIds)}>
                                    Select Filtered
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                                    Clear
                                </Button>
                                <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "TRIGGER" | "CANCEL" | "DELETE")}>
                                    <option value="TRIGGER">Bulk Trigger</option>
                                    <option value="CANCEL">Bulk Cancel</option>
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
                            searchPlaceholder="Search campaigns..."
                            searchValue={search}
                            onSearchChange={setSearch}
                        />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>{form.id ? "Edit Campaign" : "New Campaign"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            placeholder="Campaign title"
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        />
                        <Select
                            value={form.templateId}
                            onChange={(e) => setForm((prev) => ({ ...prev, templateId: e.target.value }))}
                        >
                            <option value="">No template</option>
                            {templates.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                    {entry.name}
                                </option>
                            ))}
                        </Select>
                        <Select
                            value={form.channel}
                            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value as NotificationChannel }))}
                        >
                            {["IN_APP", "PUSH", "EMAIL", "SMS", "WHATSAPP"].map((entry) => (
                                <option key={entry} value={entry}>{entry}</option>
                            ))}
                        </Select>
                        <Select
                            value={form.audience}
                            onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
                        >
                            <option value="all">All</option>
                            <option value="owners">Owners</option>
                            <option value="staff">Staff</option>
                        </Select>
                        <Select
                            value={form.status}
                            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                        >
                            <option value="DRAFT">DRAFT</option>
                            <option value="SCHEDULED">SCHEDULED</option>
                            <option value="RUNNING">RUNNING</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                        </Select>
                        <label className="text-xs text-muted-foreground flex items-center gap-2">
                            <CalendarClock className="h-4 w-4" />
                            Scheduled At
                        </label>
                        <Input
                            type="datetime-local"
                            value={form.scheduledAt}
                            onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                        />

                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={saveCampaign} disabled={!canManage || isSaving}>
                                {isSaving ? "Saving..." : form.id ? "Update" : "Create"}
                            </Button>
                            <Button variant="outline" onClick={resetForm}>Reset</Button>
                        </div>
                        {!canManage ? (
                            <p className="text-xs text-muted-foreground">Campaign changes are restricted to SUPER_ADMIN.</p>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
