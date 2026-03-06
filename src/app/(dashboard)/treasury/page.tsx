"use client";

import { useEffect, useMemo, useState } from "react";
import { type LucideIcon, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, RefreshCw, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { transactionService, type Transaction } from "@/services/transactionService";
import { organizationService, type Organization } from "@/services/organizationService";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";

export default function TreasuryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [rows, setRows] = useState<Transaction[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [businessFilter, setBusinessFilter] = useState<string>("ALL");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PARTIAL" | "PENDING">("ALL");

    const load = async () => {
        setIsLoading(true);
        try {
            const [txRows, orgRows] = await Promise.all([
                transactionService.getAll({
                    limit: 500,
                    businessId: businessFilter === "ALL" ? undefined : businessFilter,
                    paymentStatus: statusFilter === "ALL" ? undefined : statusFilter,
                    includeDeleted: false,
                }),
                organizationService.getAll(),
            ]);
            setRows(txRows);
            setOrganizations(orgRows);
        } catch (error) {
            toast({
                title: "Load failed",
                description: getErrorMessage(error, "Unable to load treasury transactions."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessFilter, statusFilter]);

    const totals = useMemo(() => {
        return rows.reduce(
            (acc, entry) => {
                const amount = Number(entry.totalAmount ?? 0);
                if (entry.type === "PURCHASE" || entry.type === "RETURN_INWARD") acc.outflow += amount;
                else acc.inflow += amount;
                if (entry.paymentStatus === "PENDING" || entry.paymentStatus === "PARTIAL") {
                    const due = Math.max(amount - Number(entry.paidAmount ?? 0), 0);
                    acc.outstanding += due;
                }
                return acc;
            },
            { inflow: 0, outflow: 0, outstanding: 0 },
        );
    }, [rows]);

    const runMutation = async (work: () => Promise<void>, successMessage: string) => {
        setIsMutating(true);
        try {
            await work();
            toast({ title: "Success", description: successMessage, type: "success" });
            await load();
        } catch (error) {
            toast({
                title: "Action failed",
                description: getErrorMessage(error, "Unable to update treasury status."),
                type: "error",
            });
        } finally {
            setIsMutating(false);
        }
    };

    const columns = [
        { header: "Date", accessorKey: "createdAt", cell: (row: Transaction) => new Date(row.createdAt).toLocaleString() },
        {
            header: "Reference",
            accessorKey: "invoiceNumber",
            cell: (row: Transaction) => row.invoiceNumber || row.id,
        },
        { header: "Type", accessorKey: "type" },
        { header: "Organization", accessorKey: "organizationName" },
        {
            header: "Amount",
            accessorKey: "totalAmount",
            className: "text-right",
            cell: (row: Transaction) => (
                <div className="text-right">
                    <div className="font-semibold">
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(row.totalAmount ?? 0))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Paid: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(row.paidAmount ?? 0))}
                    </div>
                </div>
            ),
        },
        { header: "Payment", accessorKey: "paymentStatus" },
        {
            header: "Actions",
            accessorKey: "id",
            cell: (row: Transaction) => (
                <div className="flex gap-2">
                    {row.paymentStatus !== "PAID" && (
                        <Button variant="outline" size="sm" onClick={() => { void runMutation(async () => { await transactionService.markPaid(row.id); }, "Marked paid."); }} disabled={isMutating}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Paid
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => {
                        const next = row.paymentStatus === "PENDING" ? "PARTIAL" : row.paymentStatus === "PARTIAL" ? "PAID" : "PENDING";
                        void runMutation(async () => {
                            await transactionService.update(row.id, { paymentStatus: next });
                        }, `Payment status set to ${next}.`);
                    }} disabled={isMutating}>
                        <Clock className="h-3 w-3 mr-1" />
                        Cycle Status
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Treasury and Banking</h1>
                    <p className="text-muted-foreground">Cashflow, outflow, and outstanding exposure from global transaction stream.</p>
                </div>
                <div className="flex gap-2">
                    <Select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}>
                        <option value="ALL">All businesses</option>
                        {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                    </Select>
                    <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | "PAID" | "PARTIAL" | "PENDING")}>
                        <option value="ALL">All statuses</option>
                        <option value="PAID">Paid</option>
                        <option value="PARTIAL">Partial</option>
                        <option value="PENDING">Pending</option>
                    </Select>
                    <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
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
