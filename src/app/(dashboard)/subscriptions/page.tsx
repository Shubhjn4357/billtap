"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { BadgePlus, Ban, CheckCircle2, CreditCard, RefreshCw, Shuffle } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { normalizeAdminRole } from "@/lib/rbac";
import { planService } from "@/services/planService";
import { organizationService, type Organization } from "@/services/organizationService";
import {
    subscriptionService,
    type AdminSubscriptionRow,
    type SubscriptionListResponse,
    type SubscriptionStatus,
    type SubscriptionTier,
} from "@/services/subscriptionService";

type StatusFilter = "ALL" | SubscriptionStatus;
type TierFilter = "ALL" | SubscriptionTier;
type CycleFilter = "ALL" | "MONTHLY" | "YEARLY" | "THREE_YEAR" | "NONE";

const STATUS_FILTERS: StatusFilter[] = ["ALL", "ACTIVE", "TRIAL", "GRACE", "EXPIRED", "CANCELLED"];
const TIER_FILTERS: TierFilter[] = ["ALL", "FREE", "STARTER", "GROWTH", "ENTERPRISE"];
const CYCLE_FILTERS: CycleFilter[] = ["ALL", "MONTHLY", "YEARLY", "THREE_YEAR", "NONE"];

const createEmptySummary = (): SubscriptionListResponse["summary"] => ({
    total: 0,
    byStatus: {
        ACTIVE: 0,
        TRIAL: 0,
        GRACE: 0,
        EXPIRED: 0,
        CANCELLED: 0,
    },
    byTier: {
        FREE: 0,
        STARTER: 0,
        GROWTH: 0,
        ENTERPRISE: 0,
    },
    byCycle: {
        MONTHLY: 0,
        YEARLY: 0,
        THREE_YEAR: 0,
        NONE: 0,
    },
});

const statusClasses: Record<SubscriptionStatus, string> = {
    ACTIVE: "bg-green-500/15 text-green-700",
    TRIAL: "bg-blue-500/15 text-blue-700",
    GRACE: "bg-orange-500/15 text-orange-700",
    EXPIRED: "bg-red-500/15 text-red-700",
    CANCELLED: "bg-zinc-500/15 text-zinc-700",
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : "—");
const computeDurationDays = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return 30;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 30;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
};

export default function SubscriptionsPage() {
    const { data: session } = useSession();
    const role = normalizeAdminRole(session as { adminRole?: string | null } | null);
    const canManage = role === "SUPER_ADMIN";
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
    const [summary, setSummary] = useState<SubscriptionListResponse["summary"]>(createEmptySummary());
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [plans, setPlans] = useState<Array<{ id: string; name: string; tier?: string; billingCycle?: string | null }>>([]);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");
    const [cycleFilter, setCycleFilter] = useState<CycleFilter>("ALL");

    const [assignOpen, setAssignOpen] = useState(false);
    const [assignBusinessId, setAssignBusinessId] = useState("");
    const [assignPlanId, setAssignPlanId] = useState("");
    const [assignStatus, setAssignStatus] = useState<SubscriptionStatus>("ACTIVE");
    const [assignDurationDays, setAssignDurationDays] = useState(30);

    const [changeOpen, setChangeOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionRow | null>(null);
    const [changePlanId, setChangePlanId] = useState("");
    const [changeStatus, setChangeStatus] = useState<SubscriptionStatus>("ACTIVE");
    const [changeDurationDays, setChangeDurationDays] = useState(30);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [subscriptionPayload, planRows, organizationRows] = await Promise.all([
                subscriptionService.list({ limit: 500 }),
                planService.getAll(true),
                organizationService.getAll(),
            ]);

            setSubscriptions(subscriptionPayload.subscriptions);
            setSummary(subscriptionPayload.summary);
            setPlans(planRows.map((entry) => ({
                id: entry.id,
                name: entry.displayName || entry.name,
                tier: entry.tier,
                billingCycle: entry.billingCycle,
            })));
            setOrganizations(organizationRows);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load subscriptions."),
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

    useEffect(() => {
        if (!assignBusinessId && organizations.length > 0) {
            setAssignBusinessId(organizations[0].id);
        }
    }, [assignBusinessId, organizations]);

    useEffect(() => {
        if (!assignPlanId && plans.length > 0) {
            setAssignPlanId(plans[0].id);
        }
    }, [assignPlanId, plans]);

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return subscriptions.filter((entry) => {
            if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
            if (tierFilter !== "ALL" && entry.tier !== tierFilter) return false;
            if (cycleFilter !== "ALL") {
                const rowCycle: CycleFilter = entry.billingCycle ?? "NONE";
                if (rowCycle !== cycleFilter) return false;
            }
            if (!query) return true;
            return (
                entry.id.toLowerCase().includes(query)
                || entry.businessName.toLowerCase().includes(query)
                || (entry.businessCode?.toLowerCase().includes(query) ?? false)
                || (entry.ownerName?.toLowerCase().includes(query) ?? false)
                || (entry.ownerEmail?.toLowerCase().includes(query) ?? false)
                || entry.tier.toLowerCase().includes(query)
                || entry.status.toLowerCase().includes(query)
                || entry.planDisplayName.toLowerCase().includes(query)
            );
        });
    }, [cycleFilter, searchQuery, statusFilter, subscriptions, tierFilter]);

    const openChangePlanModal = (entry: AdminSubscriptionRow) => {
        setSelectedSubscription(entry);
        setChangePlanId(entry.planId ?? plans[0]?.id ?? "");
        setChangeStatus(entry.status);
        setChangeDurationDays(computeDurationDays(entry.startDate, entry.endDate));
        setChangeOpen(true);
    };

    const runAssign = async () => {
        if (!assignBusinessId || !assignPlanId) return;
        setIsActionLoading(true);
        try {
            await subscriptionService.assignToBusiness(assignBusinessId, {
                planId: assignPlanId,
                status: assignStatus,
                durationDays: Number(assignDurationDays),
            });
            toast({
                title: "Assigned",
                description: "Subscription assigned to selected business.",
                type: "success",
            });
            setAssignOpen(false);
            await loadData();
        } catch (error) {
            toast({
                title: "Assignment failed",
                description: getErrorMessage(error, "Could not assign subscription."),
                type: "error",
            });
        } finally {
            setIsActionLoading(false);
        }
    };

    const runChangePlan = async () => {
        if (!selectedSubscription || !changePlanId) return;
        setIsActionLoading(true);
        try {
            await subscriptionService.changePlan(selectedSubscription.id, {
                planId: changePlanId,
                status: changeStatus,
                durationDays: Number(changeDurationDays),
            });
            toast({
                title: "Updated",
                description: "Subscription plan changed successfully.",
                type: "success",
            });
            setChangeOpen(false);
            setSelectedSubscription(null);
            await loadData();
        } catch (error) {
            toast({
                title: "Plan change failed",
                description: getErrorMessage(error, "Could not change subscription plan."),
                type: "error",
            });
        } finally {
            setIsActionLoading(false);
        }
    };

    const runCancel = async (entry: AdminSubscriptionRow) => {
        if (!window.confirm(`Cancel subscription for ${entry.businessName}?`)) return;
        setIsActionLoading(true);
        try {
            await subscriptionService.cancel(entry.id);
            toast({
                title: "Cancelled",
                description: "Subscription cancelled successfully.",
                type: "success",
            });
            await loadData();
        } catch (error) {
            toast({
                title: "Cancel failed",
                description: getErrorMessage(error, "Could not cancel subscription."),
                type: "error",
            });
        } finally {
            setIsActionLoading(false);
        }
    };

    const runActivate = async (entry: AdminSubscriptionRow) => {
        setIsActionLoading(true);
        try {
            await subscriptionService.update(entry.id, { status: "ACTIVE" });
            toast({
                title: "Activated",
                description: "Subscription status updated to ACTIVE.",
                type: "success",
            });
            await loadData();
        } catch (error) {
            toast({
                title: "Update failed",
                description: getErrorMessage(error, "Could not update subscription status."),
                type: "error",
            });
        } finally {
            setIsActionLoading(false);
        }
    };

    const columns = [
        {
            header: "Business",
            accessorKey: "businessName",
            cell: (entry: AdminSubscriptionRow) => (
                <div className="space-y-1">
                    <p className="font-semibold">{entry.businessName}</p>
                    <p className="text-xs text-muted-foreground">{entry.businessCode ?? entry.businessId}</p>
                </div>
            ),
        },
        {
            header: "Owner",
            accessorKey: "ownerName",
            cell: (entry: AdminSubscriptionRow) => (
                <div className="space-y-1">
                    <p className="text-sm">{entry.ownerName ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{entry.ownerEmail ?? "—"}</p>
                </div>
            ),
        },
        {
            header: "Plan",
            accessorKey: "planDisplayName",
            cell: (entry: AdminSubscriptionRow) => (
                <div className="space-y-1">
                    <p className="font-medium">{entry.planDisplayName}</p>
                    <p className="text-xs text-muted-foreground">
                        {entry.tier} / {entry.billingCycle ?? "NONE"} {entry.monthlyAmount !== null ? `· ${entry.currency} ${entry.monthlyAmount.toFixed(2)}/mo` : ""}
                    </p>
                </div>
            ),
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (entry: AdminSubscriptionRow) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[entry.status]}`}>
                    {entry.status}
                </span>
            ),
        },
        {
            header: "Dates",
            accessorKey: "startDate",
            cell: (entry: AdminSubscriptionRow) => (
                <div className="space-y-1 text-xs">
                    <p>Start: {formatDate(entry.startDate)}</p>
                    <p>End: {formatDate(entry.endDate)}</p>
                </div>
            ),
        },
        {
            header: "Actions",
            accessorKey: "actions",
            className: "text-right",
            cell: (entry: AdminSubscriptionRow) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canManage || isActionLoading}
                        onClick={(event) => {
                            event.stopPropagation();
                            openChangePlanModal(entry);
                        }}
                    >
                        <Shuffle className="mr-1 h-4 w-4" />
                        Change
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canManage || isActionLoading || entry.status === "ACTIVE"}
                        onClick={(event) => {
                            event.stopPropagation();
                            void runActivate(entry);
                        }}
                    >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Activate
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={!canManage || isActionLoading || entry.status === "CANCELLED"}
                        onClick={(event) => {
                            event.stopPropagation();
                            void runCancel(entry);
                        }}
                    >
                        <Ban className="mr-1 h-4 w-4" />
                        Cancel
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscription Control Center</h1>
                    <p className="text-muted-foreground">Manage live business subscriptions with categorized visibility and plan actions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { void loadData(); }} disabled={isLoading || isActionLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={() => setAssignOpen(true)} disabled={!canManage}>
                        <BadgePlus className="mr-2 h-4 w-4" />
                        Assign Subscription
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary.byStatus.ACTIVE}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Trial</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary.byStatus.TRIAL}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Grace</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary.byStatus.GRACE}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Expired</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary.byStatus.EXPIRED}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Cancelled</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{summary.byStatus.CANCELLED}</p></CardContent></Card>
            </div>

            <Card>
                <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Categorized Subscriptions
                    </CardTitle>
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {STATUS_FILTERS.map((status) => (
                                <Button
                                    key={status}
                                    size="sm"
                                    variant={statusFilter === status ? "default" : "outline"}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status} ({status === "ALL" ? summary.total : summary.byStatus[status]})
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {TIER_FILTERS.map((tier) => (
                                <Button
                                    key={tier}
                                    size="sm"
                                    variant={tierFilter === tier ? "default" : "outline"}
                                    onClick={() => setTierFilter(tier)}
                                >
                                    {tier} ({tier === "ALL" ? summary.total : summary.byTier[tier]})
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {CYCLE_FILTERS.map((cycle) => (
                                <Button
                                    key={cycle}
                                    size="sm"
                                    variant={cycleFilter === cycle ? "default" : "outline"}
                                    onClick={() => setCycleFilter(cycle)}
                                >
                                    {cycle} ({cycle === "ALL" ? summary.total : summary.byCycle[cycle]})
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={filteredRows}
                        isLoading={isLoading}
                        searchPlaceholder="Search business, owner, plan, tier, status..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        emptyMessage="No subscriptions match selected categories."
                    />
                </CardContent>
            </Card>

            <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Subscription">
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium">Business</label>
                        <Select value={assignBusinessId} onChange={(event) => setAssignBusinessId(event.target.value)}>
                            {organizations.map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.name} ({entry.code || entry.id})</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium">Plan</label>
                        <Select value={assignPlanId} onChange={(event) => setAssignPlanId(event.target.value)}>
                            {plans.map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.name} ({entry.tier}/{entry.billingCycle ?? "NONE"})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium">Status</label>
                            <Select value={assignStatus} onChange={(event) => setAssignStatus(event.target.value as SubscriptionStatus)}>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="TRIAL">TRIAL</option>
                                <option value="GRACE">GRACE</option>
                                <option value="EXPIRED">EXPIRED</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium">Duration (days)</label>
                            <Input
                                type="number"
                                min={1}
                                max={3650}
                                value={String(assignDurationDays)}
                                onChange={(event) => setAssignDurationDays(Number(event.target.value || 30))}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-3">
                        <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
                        <Button onClick={() => { void runAssign(); }} disabled={!canManage || isActionLoading}>
                            Assign
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={changeOpen} onClose={() => setChangeOpen(false)} title="Change Subscription Plan">
                <div className="space-y-4">
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">{selectedSubscription?.businessName}</p>
                        <p className="text-xs text-muted-foreground">{selectedSubscription?.id}</p>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium">New Plan</label>
                        <Select value={changePlanId} onChange={(event) => setChangePlanId(event.target.value)}>
                            {plans.map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.name} ({entry.tier}/{entry.billingCycle ?? "NONE"})</option>
                            ))}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium">Status</label>
                            <Select value={changeStatus} onChange={(event) => setChangeStatus(event.target.value as SubscriptionStatus)}>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="TRIAL">TRIAL</option>
                                <option value="GRACE">GRACE</option>
                                <option value="EXPIRED">EXPIRED</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium">Duration (days)</label>
                            <Input
                                type="number"
                                min={1}
                                max={3650}
                                value={String(changeDurationDays)}
                                onChange={(event) => setChangeDurationDays(Number(event.target.value || 30))}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-3">
                        <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
                        <Button onClick={() => { void runChangePlan(); }} disabled={!canManage || isActionLoading}>
                            Save
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

