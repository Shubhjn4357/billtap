"use client";

import { useEffect, useMemo, useState } from "react";
import { type LucideIcon, ArrowDownCircle, ArrowUpCircle, RefreshCw, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type TransactionEntry = {
    id: string;
    type: string;
    totalAmount: number;
    paymentStatus: string;
    paymentMode: string;
    organizationName: string;
    createdAt: string;
    updatedAt: string;
};

export default function TreasuryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [rows, setRows] = useState<TransactionEntry[]>([]);

    const load = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get<{ ok: boolean; transactions: TransactionEntry[] }>("/admin/transactions", {
                params: { limit: 500 },
            });
            setRows(data.transactions);
        } catch (error) {
            toast({
                title: "Load failed",
                description: error instanceof Error ? error.message : "Unable to load treasury transactions.",
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

    const totals = useMemo(() => {
        return rows.reduce(
            (acc, entry) => {
                const amount = Number(entry.totalAmount ?? 0);
                if (entry.type === "PURCHASE" || entry.type === "RETURN_INWARD") acc.outflow += amount;
                else acc.inflow += amount;
                if (entry.paymentStatus === "PENDING" || entry.paymentStatus === "PARTIAL") acc.outstanding += amount;
                return acc;
            },
            { inflow: 0, outflow: 0, outstanding: 0 }
        );
    }, [rows]);

    const columns = [
        { header: "Date", accessorKey: "createdAt", cell: (row: TransactionEntry) => new Date(row.createdAt).toLocaleString() },
        { header: "Type", accessorKey: "type" },
        { header: "Organization", accessorKey: "organizationName" },
        {
            header: "Amount",
            accessorKey: "totalAmount",
            className: "text-right",
            cell: (row: TransactionEntry) => (
                <span className="font-semibold">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(row.totalAmount ?? 0))}
                </span>
            ),
        },
        { header: "Payment", accessorKey: "paymentStatus" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Treasury and Banking</h1>
                    <p className="text-muted-foreground">Cashflow, outflow, and outstanding exposure from global transaction stream.</p>
                </div>
                <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard title="Inflow" value={totals.inflow} icon={ArrowDownCircle} tone="text-green-600" />
                <MetricCard title="Outflow" value={totals.outflow} icon={ArrowUpCircle} tone="text-red-600" />
                <MetricCard title="Outstanding" value={totals.outstanding} icon={Wallet} tone="text-amber-600" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Treasury Feed</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={rows} isLoading={isLoading} searchPlaceholder="Search transactions..." />
                </CardContent>
            </Card>
        </div>
    );
}

function MetricCard({
    title,
    value,
    icon: Icon,
    tone,
}: {
    title: string;
    value: number;
    icon: LucideIcon;
    tone: string;
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    {title}
                    <Icon className={`h-4 w-4 ${tone}`} />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-bold">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)}
                </p>
            </CardContent>
        </Card>
    );
}
