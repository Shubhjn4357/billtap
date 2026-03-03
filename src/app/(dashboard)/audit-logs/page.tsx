"use client";

import { useEffect, useMemo, useState } from "react";
import { History, RefreshCw, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";

type AuditLog = {
    id: string;
    time: string;
    actor: string;
    actorRole: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    entity: string;
    status: string;
    metadata: Record<string, unknown>;
};

type Filters = {
    q: string;
    actor: string;
    action: string;
    entityType: string;
    role: string;
    status: string;
    from: string;
    to: string;
};

const DEFAULT_FILTERS: Filters = {
    q: "",
    actor: "",
    action: "",
    entityType: "",
    role: "",
    status: "",
    from: "",
    to: "",
};

export default function AuditLogsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

    const loadLogs = async (nextFilters = filters) => {
        setIsLoading(true);
        try {
            const params: Record<string, string | number> = { limit: 800 };
            for (const [key, value] of Object.entries(nextFilters)) {
                if (value.trim()) params[key] = value.trim();
            }
            const res = await api.get<{ ok: boolean; logs: AuditLog[] }>("/admin/audit-logs", { params });
            setLogs(res.data.logs);
        } catch (error) {
            console.error("Failed to load logs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const columns = [
        { header: "Timestamp", accessorKey: "time", cell: (row: AuditLog) => new Date(row.time).toLocaleString() },
        { header: "Actor", accessorKey: "actor" },
        { header: "Role", accessorKey: "actorRole" },
        { header: "Action", accessorKey: "action" },
        { header: "Entity", accessorKey: "entity" },
        {
            header: "Status",
            accessorKey: "status",
            cell: (row: AuditLog) => (
                <span className={row.status === "SUCCESS" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                    {row.status}
                </span>
            ),
        },
        {
            header: "Details",
            accessorKey: "id",
            className: "text-right",
            cell: (row: AuditLog) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        setSelectedLog(row);
                    }}
                >
                    View
                </Button>
            ),
        },
    ];

    const summary = useMemo(() => {
        return logs.reduce(
            (acc, entry) => {
                acc.total += 1;
                if (entry.status === "SUCCESS") acc.success += 1;
                else acc.failed += 1;
                return acc;
            },
            { total: 0, success: 0, failed: 0 }
        );
    }, [logs]);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">Traceability and security logs across all system modules.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Metric label="Total" value={summary.total} />
                <Metric label="Success" value={summary.success} tone="text-green-600" />
                <Metric label="Failed" value={summary.failed} tone="text-red-600" />
            </div>

            <Card className="border-none shadow-sm bg-card/60">
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Audit Trail
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                                Reset
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void loadLogs()} disabled={isLoading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-xl border p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                            <Filter className="h-4 w-4" />
                            Filters
                        </div>
                        <div className="grid gap-2 md:grid-cols-4">
                            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Global search" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} />
                            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Actor email" value={filters.actor} onChange={(e) => setFilters((prev) => ({ ...prev, actor: e.target.value }))} />
                            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Action" value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))} />
                            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Entity type" value={filters.entityType} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))} />
                            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Role (SUPER_ADMIN...)" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))} />
                            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Status (SUCCESS/FAILED)" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} />
                            <input type="datetime-local" className="rounded-lg border px-3 py-2 text-sm" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
                            <input type="datetime-local" className="rounded-lg border px-3 py-2 text-sm" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
                        </div>
                        <div className="mt-3">
                            <Button size="sm" onClick={() => void loadLogs(filters)} disabled={isLoading}>
                                Apply Filters
                            </Button>
                        </div>
                    </div>

                    <DataTable
                        columns={columns}
                        data={logs}
                        isLoading={isLoading}
                        onRowClick={(row) => setSelectedLog(row)}
                        searchPlaceholder="Search loaded logs..."
                    />
                </CardContent>
            </Card>

            <Modal isOpen={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title={`Audit Entry ${selectedLog?.id ?? ""}`} className="max-w-3xl">
                <div className="space-y-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                        <div><span className="font-semibold">Time:</span> {selectedLog ? new Date(selectedLog.time).toLocaleString() : "-"}</div>
                        <div><span className="font-semibold">Actor:</span> {selectedLog?.actor}</div>
                        <div><span className="font-semibold">Role:</span> {selectedLog?.actorRole}</div>
                        <div><span className="font-semibold">Status:</span> {selectedLog?.status}</div>
                        <div><span className="font-semibold">Action:</span> {selectedLog?.action}</div>
                        <div><span className="font-semibold">Entity:</span> {selectedLog?.entity}</div>
                    </div>
                    <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                        {JSON.stringify(selectedLog?.metadata ?? {}, null, 2)}
                    </pre>
                </div>
            </Modal>
        </div>
    );
}

function Metric({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className={`text-3xl font-bold ${tone}`}>{value.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
}

