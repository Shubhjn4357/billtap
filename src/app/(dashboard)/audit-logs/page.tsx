"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { History, RefreshCw } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface AuditLog {
    id: string;
    time: string;
    actor: string;
    action: string;
    entity: string;
    status: string;
}

export default function AuditLogsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const res = await api.get<{ ok: boolean, logs: AuditLog[] }>("/admin/audit-logs");
            setLogs(res.data.logs);
        } catch (error) {
            console.error("Failed to load logs", error);
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        { header: "Timestamp", accessorKey: "time" },
        { header: "Actor", accessorKey: "actor" },
        { header: "Action", accessorKey: "action" },
        { header: "Entity", accessorKey: "entity" },
        { header: "Status", accessorKey: "status" },
    ];

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">Traceability and security logs for across all system modules.</p>
            </div>

            <Card className="border-none shadow-sm bg-card/60">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Recent Activity
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={loadLogs} disabled={isLoading}>
                                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={logs}
                        isLoading={isLoading}
                        searchPlaceholder="Search logs by actor or action..."
                    />
                </CardContent>
            </Card>
        </div>
    );
}
