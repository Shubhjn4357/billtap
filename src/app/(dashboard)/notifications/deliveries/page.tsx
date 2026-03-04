"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { type NotificationDelivery, notificationService } from "@/services/notificationService";
import { Modal } from "@/components/ui/Modal";

export default function NotificationDeliveriesPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
    const [selected, setSelected] = useState<NotificationDelivery | null>(null);

    const load = async () => {
        setIsLoading(true);
        try {
            const rows = await notificationService.getDeliveries(500);
            setDeliveries(rows);
        } catch (error) {
            toast({
                title: "Load failed",
                description: getErrorMessage(error, "Unable to load deliveries."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return deliveries;
        return deliveries.filter((entry) =>
            [
                entry.id,
                entry.channel,
                entry.status,
                entry.campaignId ?? "",
                entry.businessId ?? "",
                entry.userId ?? "",
                entry.errorMessage ?? "",
                JSON.stringify(entry.metadata),
            ].join(" ").toLowerCase().includes(q)
        );
    }, [deliveries, search]);

    const columns = [
        { header: "ID", accessorKey: "id" },
        { header: "Channel", accessorKey: "channel" },
        { header: "Status", accessorKey: "status" },
        {
            header: "Campaign",
            accessorKey: "campaignId",
            cell: (row: NotificationDelivery) => row.campaignId ?? "-",
        },
        {
            header: "Sent At",
            accessorKey: "sentAt",
            cell: (row: NotificationDelivery) => row.sentAt ? new Date(row.sentAt).toLocaleString() : "-",
        },
        {
            header: "Created",
            accessorKey: "createdAt",
            cell: (row: NotificationDelivery) => new Date(row.createdAt).toLocaleString(),
        },
        {
            header: "Details",
            accessorKey: "metadata",
            className: "text-right",
            cell: (row: NotificationDelivery) => (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                        event.stopPropagation();
                        setSelected(row);
                    }}
                >
                    View
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notification Deliveries</h1>
                    <p className="text-muted-foreground">Monitor queued, sent, and failed notification records.</p>
                </div>
                <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellRing className="h-5 w-5 text-primary" />
                        Delivery Stream
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={filtered}
                        isLoading={isLoading}
                        searchPlaceholder="Search by ID, channel, status, metadata..."
                        searchValue={search}
                        onSearchChange={setSearch}
                    />
                </CardContent>
            </Card>

            <Modal
                isOpen={Boolean(selected)}
                onClose={() => setSelected(null)}
                title={`Delivery ${selected?.id ?? ""}`}
                className="max-w-3xl"
            >
                <div className="space-y-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                        <div><span className="font-semibold">Channel:</span> {selected?.channel}</div>
                        <div><span className="font-semibold">Status:</span> {selected?.status}</div>
                        <div><span className="font-semibold">Campaign:</span> {selected?.campaignId ?? "-"}</div>
                        <div><span className="font-semibold">Business:</span> {selected?.businessId ?? "-"}</div>
                    </div>
                    {selected?.errorMessage ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                            <span className="font-semibold">Error:</span> {selected.errorMessage}
                        </div>
                    ) : null}
                    <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                        {JSON.stringify(selected?.metadata ?? {}, null, 2)}
                    </pre>
                </div>
            </Modal>
        </div>
    );
}
