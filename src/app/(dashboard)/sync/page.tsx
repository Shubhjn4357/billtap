"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Cloud, Clock3, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import {
    syncDiagnosticsAdminService,
    type SyncDiagnosticsRow,
    type SyncDiagnosticsSummary,
} from "@/services/syncDiagnosticsAdminService";
import { type LiveSnapshot } from "@/services/notificationService";

type SyncDiagnosticsTableRow = SyncDiagnosticsRow & { id: string };

const EMPTY_SUMMARY: SyncDiagnosticsSummary = {
    totalBusinesses: 0,
    syncAllowedBusinesses: 0,
    syncRestrictedBusinesses: 0,
    graceBusinesses: 0,
    expiredBusinesses: 0,
    queuedDeliveries: 0,
};

export default function SyncPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState<SyncDiagnosticsSummary>(EMPTY_SUMMARY);
    const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null);
    const [rows, setRows] = useState<SyncDiagnosticsRow[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const loadData = async () => {
        setIsLoading(true);
        try {
            const response = await syncDiagnosticsAdminService.getOverview();
            setSummary(response.summary ?? EMPTY_SUMMARY);
            setLiveSnapshot(response.liveSnapshot ?? null);
            setRows(response.rows ?? []);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load sync diagnostics."),
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

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((entry) => (
            entry.businessName.toLowerCase().includes(query)
            || (entry.businessCode?.toLowerCase().includes(query) ?? false)
            || entry.subscriptionTier.toLowerCase().includes(query)
            || entry.subscriptionStatus.toLowerCase().includes(query)
            || (entry.restrictionReason?.toLowerCase().includes(query) ?? false)
        ));
    }, [rows, searchQuery]);

    const tableRows = useMemo<SyncDiagnosticsTableRow[]>(
        () => filteredRows.map((row) => ({ ...row, id: row.businessId })),
        [filteredRows]
    );

    const columns = [
        {
            header: "Business",
            accessorKey: "businessName",
            cell: (row: SyncDiagnosticsRow) => (
                <div className="space-y-1">
                    <div className="font-semibold">{row.businessName}</div>
                    <div className="text-xs text-muted-foreground">{row.businessCode ?? "No business code"}</div>
                </div>
            ),
        },
        {
            header: "Subscription",
            accessorKey: "subscriptionTier",
            cell: (row: SyncDiagnosticsRow) => (
                <div className="space-y-1">
                    <div className="font-semibold">{row.subscriptionTier}</div>
                    <div className="text-xs text-muted-foreground">{row.subscriptionStatus}</div>
                </div>
            ),
        },
        {
            header: "Sync",
            accessorKey: "cloudSyncAllowed",
            cell: (row: SyncDiagnosticsRow) => (
                <div className="space-y-1">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${!row.restrictionReason ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>
                        {!row.restrictionReason ? "Allowed" : "Blocked"}
                    </span>
                    <div className="text-xs text-muted-foreground">
                        Flag: {row.hasCloudSyncFlag ? "CLOUD_SYNC on" : "CLOUD_SYNC off"}
                    </div>
                </div>
            ),
        },
        {
            header: "Restriction",
            accessorKey: "restrictionReason",
            cell: (row: SyncDiagnosticsRow) => row.restrictionReason ?? "No restriction",
        },
        {
            header: "Updated",
            accessorKey: "updatedAt",
            cell: (row: SyncDiagnosticsRow) => new Date(row.updatedAt).toLocaleString(),
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sync Diagnostics</h1>
                    <p className="text-muted-foreground">Cloud-sync readiness, grace/expiry issues, and queue pressure at business level.</p>
                </div>
                <div className="flex gap-2">
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search businesses, status, or restriction..."
                        className="w-full md:w-80"
                    />
                    <Button variant="outline" onClick={() => { void loadData(); }}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">
                <SummaryCard title="Businesses" value={String(summary.totalBusinesses)} icon={Cloud} meta="Businesses evaluated for sync" />
                <SummaryCard title="Sync Allowed" value={String(summary.syncAllowedBusinesses)} icon={Zap} meta="Businesses with cloud sync ready" />
                <SummaryCard title="Restricted" value={String(summary.syncRestrictedBusinesses)} icon={ShieldAlert} meta="Businesses blocked by status or flags" />
                <SummaryCard title="Grace" value={String(summary.graceBusinesses)} icon={Clock3} meta="Businesses in grace window" />
                <SummaryCard title="Expired" value={String(summary.expiredBusinesses)} icon={AlertTriangle} meta="Businesses with expired subscription" />
                <SummaryCard title="Queued Alerts" value={String(summary.queuedDeliveries)} icon={RefreshCw} meta="Queued or failed notification deliveries" />
            </div>

            {liveSnapshot ? (
                <Card className="border-none bg-muted/20 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Live Platform Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                        <SnapshotMetric label="Signups 24h" value={String(liveSnapshot.signupsLast24h)} />
                        <SnapshotMetric label="Billing Events" value={String(liveSnapshot.billingEventsLast24h)} />
                        <SnapshotMetric label="Error Spikes" value={String(liveSnapshot.errorSpikesLast24h)} />
                        <SnapshotMetric label="Upgrades" value={String(liveSnapshot.upgradesLast24h)} />
                        <SnapshotMetric label="Downgrades" value={String(liveSnapshot.downgradesLast24h)} />
                        <SnapshotMetric label="Queue Spikes" value={String(liveSnapshot.queueSpikes)} />
                    </CardContent>
                </Card>
            ) : null}

            <Card className="border-none bg-transparent shadow-none">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={tableRows}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>
        </div>
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

function SnapshotMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
    );
}
