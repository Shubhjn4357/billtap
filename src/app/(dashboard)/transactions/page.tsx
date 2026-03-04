"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Store, Receipt, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Transaction, transactionService } from "@/services/transactionService";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api-error";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const data = await transactionService.getAll();
            setTransactions(data);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to fetch transactions."),
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredTransactions = transactions.filter(t =>
        t.organizationName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const columns = [
        {
            header: "Transaction ID",
            accessorKey: "id",
            cell: (t: Transaction) => (
                <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs">{t.id}</span>
                </div>
            )
        },
        {
            header: "Organization",
            accessorKey: "organizationName",
            cell: (t: Transaction) => (
                <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary/60" />
                    <span className="font-medium">{t.organizationName || "Unknown Org"}</span>
                </div>
            )
        },
        {
            header: "Type",
            accessorKey: "type",
            cell: (t: Transaction) => (
                <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    t.type === 'SALE'
                        ? "bg-green-100 text-green-700"
                        : t.type === 'PURCHASE'
                            ? "bg-blue-100 text-blue-700"
                            : t.type === 'RETURN_INWARD'
                                ? "bg-orange-100 text-orange-700"
                                : t.type === 'RETURN_OUTWARD'
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-muted text-foreground"
                )}>
                    {t.type}
                </span>
            )
        },
        {
            header: "Amount",
            accessorKey: "totalAmount",
            cell: (t: Transaction) => (
                <span className="font-bold text-foreground">INR {t.totalAmount.toLocaleString()}
                </span>
            )
        },
        {
            header: "Payment",
            accessorKey: "paymentStatus",
            cell: (t: Transaction) => (
                <div className={cn(
                    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                    {
                        "text-green-600": t.paymentStatus === 'PAID',
                        "text-yellow-600": t.paymentStatus === 'PARTIAL',
                        "text-red-600": t.paymentStatus === 'PENDING'
                    }
                )}>
                    {t.paymentStatus === 'PAID' && <CheckCircle2 className="h-3 w-3" />}
                    {t.paymentStatus === 'PARTIAL' && <Clock className="h-3 w-3" />}
                    {t.paymentStatus === 'PENDING' && <AlertCircle className="h-3 w-3" />}
                    {t.paymentStatus}
                </div>
            )
        },
        {
            header: "Date",
            accessorKey: "createdAt",
            cell: (t: Transaction) => (
                <span className="text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                </span>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
                    <p className="text-muted-foreground">Global audit of all bills and financial activity.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchTransactions}>
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
                        searchPlaceholder="Filter by organization or ID..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

