"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ExpenseSummary {
    category: string;
    total: number;
    count: number;
}

interface OverviewStats {
    totalExpenses: number;
    thisMonth: number;
    avgPerDay: number;
    largestCategory: string;
    totalCount: number;
}

const PERIODS = [
    { label: "This Month", key: "this_month" as const },
    { label: "Last Month", key: "last_month" as const },
    { label: "This Year", key: "this_year" as const },
];

const BAR_COLOR_CLASSES = ["bg-primary", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500", "bg-lime-500"];

export default function ExpensesAnalyticsPage() {
    const [period, setPeriod] = useState<"this_month" | "last_month" | "this_year">("this_month");

    const { data, isLoading } = useQuery({
        queryKey: ["admin-expense-analytics", period],
        queryFn: async () => {
            const today = new Date();
            let from: string;
            let to: string;

            if (period === "this_month") {
                from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
                to = today.toISOString().slice(0, 10);
            } else if (period === "last_month") {
                const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                from = lm.toISOString().slice(0, 10);
                to = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
            } else {
                from = `${today.getFullYear()}-04-01`;
                to = today.toISOString().slice(0, 10);
            }

            const res = await api.get(`/admin/expenses/analytics?from=${from}&to=${to}`);
            return {
                summary: (res.data?.byCategoryArr ?? []) as ExpenseSummary[],
                overview: (res.data?.overview ?? null) as OverviewStats | null,
            };
        },
        staleTime: 60_000,
    });

    const summary = data?.summary ?? [];
    const overview = data?.overview;
    const total = summary.reduce((sum, item) => sum + item.total, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Expense Analytics</h1>
                <p className="text-muted-foreground">Category breakdown and spending trends.</p>
            </div>

            <div className="flex gap-2">
                {PERIODS.map((entry) => (
                    <button
                        key={entry.key}
                        onClick={() => setPeriod(entry.key)}
                        className={cn(
                            "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                            period === entry.key
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat title="Total Expenses" value={`INR ${(overview?.totalExpenses ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} loading={isLoading} />
                <Stat title="This Month" value={`INR ${(overview?.thisMonth ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} loading={isLoading} />
                <Stat title="Avg Per Day" value={`INR ${(overview?.avgPerDay ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} loading={isLoading} />
                <Stat title="# Transactions" value={String(overview?.totalCount ?? 0)} loading={isLoading} />
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle>By Category</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="py-8 text-center text-muted-foreground">Loading...</p>
                    ) : summary.length === 0 ? (
                        <p className="py-8 text-center text-muted-foreground">No expenses in this period.</p>
                    ) : (
                        <div className="space-y-4">
                            {summary.map((category, idx) => {
                                const pct = total > 0 ? (category.total / total) * 100 : 0;
                                return (
                                    <div key={category.category}>
                                        <div className="mb-1 flex justify-between">
                                            <span className="text-sm font-medium">{category.category.replace(/_/g, " ")}</span>
                                            <span className="text-sm text-muted-foreground">
                                                INR {category.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({category.count})
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-700", BAR_COLOR_CLASSES[idx % BAR_COLOR_CLASSES.length])}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Stat({ title, value, loading }: { title: string; value: string; loading: boolean }) {
    return (
        <Card className="border-none shadow-sm">
            <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold">{loading ? "..." : value}</p>
            </CardContent>
        </Card>
    );
}
