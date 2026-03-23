"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileBarChart2, FileSpreadsheet, Printer, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import {
    reportingGovernanceService,
    type ReportingGovernanceRow,
    type ReportingGovernanceSummary,
} from "@/services/reportingGovernanceService";

type ReportingGovernanceTableRow = ReportingGovernanceRow & { id: string };

const EMPTY_SUMMARY: ReportingGovernanceSummary = {
    totalBusinesses: 0,
    gstReadyBusinesses: 0,
    pdfExportBusinesses: 0,
    thermalReadyBusinesses: 0,
    businessCardBusinesses: 0,
};

export default function ReportingPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState<ReportingGovernanceSummary>(EMPTY_SUMMARY);
    const [rows, setRows] = useState<ReportingGovernanceRow[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const loadData = async () => {
        setIsLoading(true);
        try {
            const response = await reportingGovernanceService.getOverview();
            setSummary(response.summary ?? EMPTY_SUMMARY);
            setRows(response.rows ?? []);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load reporting governance."),
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
        ));
    }, [rows, searchQuery]);

    const tableRows = useMemo<ReportingGovernanceTableRow[]>(
        () => filteredRows.map((row) => ({ ...row, id: row.businessId })),
        [filteredRows]
    );

    const columns = [
        {
            header: "Business",
            accessorKey: "businessName",
            cell: (row: ReportingGovernanceRow) => (
                <div className="space-y-1">
                    <div className="font-semibold">{row.businessName}</div>
                    <div className="text-xs text-muted-foreground">{row.businessCode ?? "No business code"}</div>
                </div>
            ),
        },
        {
            header: "Subscription",
            accessorKey: "subscriptionTier",
            cell: (row: ReportingGovernanceRow) => (
                <div className="space-y-1">
                    <div className="font-semibold">{row.subscriptionTier}</div>
                    <div className="text-xs text-muted-foreground">{row.subscriptionStatus}</div>
                </div>
            ),
        },
        {
            header: "Readiness",
            accessorKey: "gstEnabled",
            cell: (row: ReportingGovernanceRow) => (
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                    <Badge label="GST" active={row.gstEnabled} />
                    <Badge label="PDF" active={row.exportPdfEnabled} />
                    <Badge label="Thermal" active={row.thermalReady} />
                    <Badge label="Card" active={row.businessCardReady} />
                </div>
            ),
        },
        {
            header: "Templates",
            accessorKey: "invoiceTemplateCount",
            cell: (row: ReportingGovernanceRow) => (
                <div className="space-y-1">
                    <div>{row.invoiceTemplateCount} invoice</div>
                    <div className="text-xs text-muted-foreground">{row.cardTemplateCount} card</div>
                </div>
            ),
        },
        {
            header: "Updated",
            accessorKey: "updatedAt",
            cell: (row: ReportingGovernanceRow) => new Date(row.updatedAt).toLocaleString(),
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reporting Governance</h1>
                    <p className="text-muted-foreground">Dedicated report/export coverage for GST, PDF, thermal print, and business-card readiness across businesses.</p>
                </div>
                <div className="flex gap-2">
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search businesses, tier, or status..."
                        className="w-full md:w-80"
                    />
                    <Button variant="outline" onClick={() => { void loadData(); }}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard title="Businesses" value={String(summary.totalBusinesses)} icon={ShieldCheck} meta="Tracked in reporting governance" />
                <SummaryCard title="GST Ready" value={String(summary.gstReadyBusinesses)} icon={FileBarChart2} meta="Businesses with GST enabled" />
                <SummaryCard title="PDF Export" value={String(summary.pdfExportBusinesses)} icon={FileSpreadsheet} meta="Cloud/export-ready document support" />
                <SummaryCard title="Thermal Ready" value={String(summary.thermalReadyBusinesses)} icon={Printer} meta="Businesses with thermal profile readiness" />
                <SummaryCard title="Card Ready" value={String(summary.businessCardBusinesses)} icon={WalletCards} meta="Businesses with card templates in place" />
            </div>

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

function Badge({
    label,
    active,
}: {
    label: string;
    active: boolean;
}) {
    return (
        <span className={`rounded-full px-2 py-1 ${active ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-700"}`}>
            {label}
        </span>
    );
}
