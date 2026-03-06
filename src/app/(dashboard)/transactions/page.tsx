"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Edit3, Receipt, RefreshCw, RotateCcw, Store, Trash2 } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Transaction, transactionService } from "@/services/transactionService";
import { organizationService, type Organization } from "@/services/organizationService";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api-error";

const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PARTIAL" | "PENDING">("ALL");
    const [businessFilter, setBusinessFilter] = useState<string>("ALL");
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [editForm, setEditForm] = useState({
        paymentStatus: "PENDING" as "PAID" | "PARTIAL" | "PENDING",
        paidAmount: "0",
        dueDate: "",
        notes: "",
    });
    const [isEditOpen, setIsEditOpen] = useState(false);
    const { toast } = useToast();

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const [txRows, orgRows] = await Promise.all([
                transactionService.getAll({
                    limit: 500,
                    businessId: businessFilter === "ALL" ? undefined : businessFilter,
                    paymentStatus: statusFilter === "ALL" ? undefined : statusFilter,
                    includeDeleted,
                }),
                organizationService.getAll(),
            ]);
            setTransactions(txRows ?? []);
            setOrganizations(orgRows ?? []);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to fetch transactions."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void fetchTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, businessFilter, includeDeleted]);

    const filteredTransactions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return transactions;
        return transactions.filter((entry) => (
            entry.id.toLowerCase().includes(query)
            || (entry.invoiceNumber?.toLowerCase().includes(query) ?? false)
            || (entry.organizationName?.toLowerCase().includes(query) ?? false)
            || (entry.notes?.toLowerCase().includes(query) ?? false)
        ));
    }, [searchQuery, transactions]);

    const runMutation = async (work: () => Promise<void>, successMessage: string) => {
        setIsMutating(true);
        try {
            await work();
            toast({ title: "Success", description: successMessage, type: "success" });
            await fetchTransactions();
        } catch (error) {
            toast({
                title: "Action failed",
                description: getErrorMessage(error, "Could not update transaction."),
                type: "error",
            });
        } finally {
            setIsMutating(false);
        }
    };

    const openEdit = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setEditForm({
            paymentStatus: transaction.paymentStatus,
            paidAmount: String(transaction.paidAmount ?? 0),
            dueDate: toDateInputValue(transaction.dueDate ?? null),
            notes: transaction.notes ?? "",
        });
        setIsEditOpen(true);
    };

    const saveEdit = async () => {
        if (!selectedTransaction) return;
        await runMutation(async () => {
            await transactionService.update(selectedTransaction.id, {
                paymentStatus: editForm.paymentStatus,
                paidAmount: Number(editForm.paidAmount || 0),
                dueDate: editForm.dueDate ? editForm.dueDate : null,
                notes: editForm.notes.trim() ? editForm.notes : null,
            });
            setIsEditOpen(false);
            setSelectedTransaction(null);
        }, "Transaction updated.");
    };

    const markPaid = async (transaction: Transaction) => {
        await runMutation(async () => {
            await transactionService.markPaid(transaction.id);
        }, "Transaction marked paid.");
    };

    const softDelete = async (transaction: Transaction) => {
        if (!window.confirm(`Soft delete transaction ${transaction.id}?`)) return;
        await runMutation(async () => {
            await transactionService.remove(transaction.id);
        }, "Transaction deleted.");
    };

    const restore = async (transaction: Transaction) => {
        await runMutation(async () => {
            await transactionService.restore(transaction.id);
        }, "Transaction restored.");
    };

    const columns = [
        {
            header: "Transaction ID",
            accessorKey: "id",
            cell: (t: Transaction) => (
                <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span className="font-mono text-xs">{t.id}</span>
                        {t.invoiceNumber ? <span className="text-[10px] text-muted-foreground">{t.invoiceNumber}</span> : null}
                    </div>
                </div>
            ),
        },
        {
            header: "Organization",
            accessorKey: "organizationName",
            cell: (t: Transaction) => (
                <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary/60" />
                    <span className="font-medium">{t.organizationName || "Unknown Org"}</span>
                </div>
            ),
        },
        {
            header: "Type",
            accessorKey: "type",
            cell: (t: Transaction) => (
                <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    t.type === "SALE"
                        ? "bg-green-100 text-green-700"
                        : t.type === "PURCHASE"
                            ? "bg-blue-100 text-blue-700"
                            : t.type === "RETURN_INWARD"
                                ? "bg-orange-100 text-orange-700"
                                : t.type === "RETURN_OUTWARD"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-muted text-foreground",
                )}>
                    {t.type}
                </span>
            ),
        },
        {
            header: "Amount",
            accessorKey: "totalAmount",
            cell: (t: Transaction) => (
                <div className="flex flex-col">
                    <span className="font-bold text-foreground">INR {t.totalAmount.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">Paid: INR {Number(t.paidAmount ?? 0).toLocaleString()}</span>
                </div>
            ),
        },
        {
            header: "Payment",
            accessorKey: "paymentStatus",
            cell: (t: Transaction) => (
                <div className={cn(
                    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                    {
                        "text-green-600": t.paymentStatus === "PAID",
                        "text-yellow-600": t.paymentStatus === "PARTIAL",
                        "text-red-600": t.paymentStatus === "PENDING",
                    },
                )}>
                    {t.paymentStatus === "PAID" && <CheckCircle2 className="h-3 w-3" />}
                    {t.paymentStatus === "PARTIAL" && <Clock className="h-3 w-3" />}
                    {t.paymentStatus === "PENDING" && <AlertCircle className="h-3 w-3" />}
                    {t.paymentStatus}
                </div>
            ),
        },
        {
            header: "Date",
            accessorKey: "createdAt",
            cell: (t: Transaction) => (
                <div className="flex flex-col">
                    <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                    {t.dueDate ? <span className="text-[10px] text-muted-foreground">Due: {new Date(t.dueDate).toLocaleDateString()}</span> : null}
                </div>
            ),
        },
        {
            header: "Actions",
            accessorKey: "id",
            cell: (t: Transaction) => (
                <div className="flex flex-wrap gap-2">
                    {t.paymentStatus !== "PAID" ? (
                        <Button variant="outline" size="sm" onClick={() => { void markPaid(t); }} disabled={isMutating || !!t.isDeleted}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Paid
                        </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)} disabled={isMutating || !!t.isDeleted}>
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                    </Button>
                    {t.isDeleted ? (
                        <Button variant="outline" size="sm" onClick={() => { void restore(t); }} disabled={isMutating}>
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => { void softDelete(t); }} disabled={isMutating}>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
                    <p className="text-muted-foreground">Global audit of all bills and financial activity.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}>
                        <option value="ALL">All businesses</option>
                        {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                    </Select>
                    <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | "PAID" | "PARTIAL" | "PENDING")}>
                        <option value="ALL">All payment states</option>
                        <option value="PAID">Paid</option>
                        <option value="PARTIAL">Partial</option>
                        <option value="PENDING">Pending</option>
                    </Select>
                    <Button variant={includeDeleted ? "default" : "outline"} onClick={() => setIncludeDeleted((prev) => !prev)}>
                        {includeDeleted ? "Showing deleted" : "Hide deleted"}
                    </Button>
                    <Button variant="outline" onClick={() => { void fetchTransactions(); }}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredTransactions}
                        isLoading={isLoading}
                        searchPlaceholder="Filter by organization, invoice no, notes, or ID..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>

            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title={selectedTransaction ? `Edit Transaction: ${selectedTransaction.invoiceNumber || selectedTransaction.id}` : "Edit Transaction"}
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium">Payment Status</label>
                        <Select
                            value={editForm.paymentStatus}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, paymentStatus: event.target.value as "PAID" | "PARTIAL" | "PENDING" }))}
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="PARTIAL">PARTIAL</option>
                            <option value="PAID">PAID</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-medium">Paid Amount</label>
                        <Input
                            type="number"
                            value={editForm.paidAmount}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, paidAmount: event.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Due Date</label>
                        <Input
                            type="date"
                            value={editForm.dueDate}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Notes</label>
                        <Input
                            value={editForm.notes}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                    <Button onClick={() => { void saveEdit(); }} isLoading={isMutating}>Save</Button>
                </div>
            </Modal>
        </div>
    );
}
