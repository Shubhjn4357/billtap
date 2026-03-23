"use client";

import { useEffect, useMemo, useState } from "react";
import { Flag, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import {
    type BusinessFeatureFlagRecord,
    type FeatureFlagDetails,
    featureFlagService,
} from "@/services/featureFlagService";

const CORE_FEATURE_FLAGS = [
    "OFFLINE_BILLING",
    "GST_INVOICES",
    "PURCHASE_MODULE",
    "STOCK_MODULE",
    "PARTY_MANAGEMENT",
    "GST_REPORTS",
    "ADVANCED_REPORTS",
    "E_INVOICE",
    "E_WAY_BILL",
    "MULTI_BUSINESS",
    "STAFF_USERS",
    "CLOUD_SYNC",
    "MULTI_DEVICE",
    "BACKUP_CLOUD",
    "EXPORT_PDF",
    "EXPORT_EXCEL",
    "ACCESS_WEB_DASHBOARD",
    "API_ACCESS",
    "BATCH_EXPIRY",
    "MULTI_GODOWN",
    "POS_MODE",
    "LOYALTY_POINTS",
];

const DEFAULT_MODULES = [
    "billing",
    "inventory",
    "accounts",
    "reports",
    "parties",
    "settings",
    "operations",
    "staff",
];

export default function FeatureFlagsPage() {
    const { toast } = useToast();
    const [businesses, setBusinesses] = useState<BusinessFeatureFlagRecord[]>([]);
    const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [details, setDetails] = useState<FeatureFlagDetails | null>(null);

    const loadBusinesses = async () => {
        setLoadingBusinesses(true);
        try {
            const list = await featureFlagService.listBusinesses();
            setBusinesses(list);
            if (!selectedBusinessId && list[0]) setSelectedBusinessId(list[0].id);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load businesses."),
                type: "error",
            });
        } finally {
            setLoadingBusinesses(false);
        }
    };

    const loadDetails = async (businessId: string) => {
        if (!businessId) return;
        setLoadingDetails(true);
        try {
            const data = await featureFlagService.getBusinessFlags(businessId);
            setDetails(data);
        } catch (error) {
            setDetails(null);
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load feature flags."),
                type: "error",
            });
        } finally {
            setLoadingDetails(false);
        }
    };

    useEffect(() => {
        void loadBusinesses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedBusinessId) return;
        void loadDetails(selectedBusinessId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBusinessId]);

    const featureFlagsEnabled = useMemo(() => new Set(details?.subscription?.featureFlagsEnabled ?? []), [details]);
    const moduleAccess = useMemo(() => details?.moduleControl?.appModuleAccess ?? {}, [details]);
    const moduleVisibility = useMemo(() => details?.moduleControl?.moduleVisibility ?? {}, [details]);

    const toggleFeatureFlag = (flag: string) => {
        if (!details?.subscription) return;
        const current = new Set(details.subscription.featureFlagsEnabled ?? []);
        if (current.has(flag)) current.delete(flag);
        else current.add(flag);
        setDetails({
            ...details,
            subscription: {
                ...details.subscription,
                featureFlagsEnabled: [...current],
            },
        });
    };

    const toggleModule = (key: string, target: "access" | "visibility") => {
        if (!details) return;
        if (target === "access") {
            setDetails({
                ...details,
                moduleControl: {
                    ...details.moduleControl,
                    appModuleAccess: {
                        ...details.moduleControl.appModuleAccess,
                        [key]: !Boolean(details.moduleControl.appModuleAccess[key]),
                    },
                },
            });
            return;
        }

        setDetails({
            ...details,
            moduleControl: {
                ...details.moduleControl,
                moduleVisibility: {
                    ...details.moduleControl.moduleVisibility,
                    [key]: !Boolean(details.moduleControl.moduleVisibility[key]),
                },
            },
        });
    };

    const saveChanges = async () => {
        if (!selectedBusinessId || !details) return;
        setSaving(true);
        try {
            await featureFlagService.updateBusinessFlags(selectedBusinessId, {
                appModuleAccess: details.moduleControl.appModuleAccess,
                moduleVisibility: details.moduleControl.moduleVisibility,
                featureFlagsEnabled: details.subscription?.featureFlagsEnabled ?? [],
            });
            toast({
                title: "Success",
                description: "Feature flags updated.",
                type: "success",
            });
            await loadDetails(selectedBusinessId);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to save changes."),
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const moduleKeys = useMemo(() => {
        const keys = new Set<string>(DEFAULT_MODULES);
        Object.keys(moduleAccess).forEach((entry) => keys.add(entry));
        Object.keys(moduleVisibility).forEach((entry) => keys.add(entry));
        return [...keys];
    }, [moduleAccess, moduleVisibility]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Business Feature Flags</h1>
                    <p className="text-muted-foreground">Inspect and override module/feature access per business.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void loadDetails(selectedBusinessId)} disabled={!selectedBusinessId}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={() => void saveChanges()} disabled={!details} isLoading={saving}>Save Changes</Button>
                </div>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle>Select Business</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select
                        value={selectedBusinessId}
                        onChange={(event) => setSelectedBusinessId(event.target.value)}
                        disabled={loadingBusinesses}
                    >
                        {businesses.map((business) => (
                            <option key={business.id} value={business.id}>
                                {business.name} ({business.code || business.id.slice(0, 8)})
                            </option>
                        ))}
                    </Select>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Flag className="h-5 w-5 text-primary" />
                            Feature Flags
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loadingDetails ? (
                            <p className="text-sm text-muted-foreground">Loading feature flags…</p>
                        ) : (
                            CORE_FEATURE_FLAGS.map((flag) => (
                                <div key={flag} className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <span className="text-xs font-semibold tracking-wider">{flag}</span>
                                    <Switch
                                        checked={featureFlagsEnabled.has(flag)}
                                        onCheckedChange={() => toggleFeatureFlag(flag)}
                                        disabled={!details?.subscription}
                                    />
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle>Module Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loadingDetails ? (
                            <p className="text-sm text-muted-foreground">Loading module controls…</p>
                        ) : (
                            moduleKeys.map((moduleKey) => (
                                <div key={moduleKey} className="rounded-md border p-3">
                                    <p className="text-sm font-semibold capitalize">{moduleKey}</p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Module Access</span>
                                        <Switch checked={Boolean(moduleAccess[moduleKey])} onCheckedChange={() => toggleModule(moduleKey, "access")} />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Module Visible</span>
                                        <Switch checked={Boolean(moduleVisibility[moduleKey])} onCheckedChange={() => toggleModule(moduleKey, "visibility")} />
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
