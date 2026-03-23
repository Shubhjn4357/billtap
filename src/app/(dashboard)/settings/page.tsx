"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    BellRing,
    CreditCard,
    ExternalLink,
    Flag,
    RefreshCw,
    Settings2,
    Shield,
    SlidersHorizontal,
    Sparkles,
    Store,
    Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminService, type AdminSettings } from "@/services/adminService";
import {
    businessSettingsAdminService,
    type BusinessSettingsFieldDefinition,
    type BusinessSettingsSchemaPayload,
} from "@/services/businessSettingsAdminService";
import { featureFlagService, type FeatureFlagDetails } from "@/services/featureFlagService";
import { organizationService, type Organization } from "@/services/organizationService";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import {
    VAHI_SETTINGS_GROUPS,
    VAHI_SETTINGS_SECTION_GROUP_MAP,
    getVahiSettingsSectionLabel,
    type VahiSettingsGroupKey,
} from "@/lib/vahiSettings";
import { cn } from "@/lib/utils";

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
] as const;

const DEFAULT_MODULES = [
    "billing",
    "inventory",
    "accounts",
    "reports",
    "parties",
    "settings",
    "operations",
    "staff",
] as const;

const PROFILE_COMPLETENESS_FIELDS: Array<keyof Organization> = [
    "name",
    "legalName",
    "state",
    "gstNumber",
    "phoneNumber",
    "email",
];

const RELATED_WORKSPACE_LINKS = [
    { href: "/organizations", label: "Organizations", description: "Owner, quotas, and business roster.", icon: Store },
    { href: "/feature-flags", label: "Feature Flags", description: "Business-level module and plan switches.", icon: Flag },
    { href: "/templates", label: "Templates", description: "Invoice, print, and business card presets.", icon: SlidersHorizontal },
    { href: "/master-data", label: "Master Data", description: "Units, categories, and seeded defaults.", icon: Wrench },
    { href: "/banners", label: "Offers & Announcements", description: "In-app banners with Vahi route redirects.", icon: Sparkles },
    { href: "/notifications/campaigns", label: "Notifications", description: "Platform campaigns and queued announcements.", icon: BellRing },
    { href: "/subscriptions", label: "Subscriptions", description: "Tier, billing cycle, and cloud access controls.", icon: CreditCard },
] as const;

const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

const isBlank = (value: unknown) => value == null || String(value).trim() === "";

const isLongTextField = (field: BusinessSettingsFieldDefinition) => {
    const key = field.key.toLowerCase();
    return key.endsWith("_json")
        || key.includes("description")
        || key.includes("conditions")
        || key.includes("overrides");
};

const normalizeFieldValue = (field: BusinessSettingsFieldDefinition, value: unknown): unknown => {
    if ((value === "" || value === undefined) && field.nullable) return null;

    switch (field.type) {
        case "boolean":
            return Boolean(value);
        case "integer": {
            if (value === "" || value == null) return field.default ?? 0;
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return field.default ?? 0;
            const intValue = Math.trunc(parsed);
            const withMin = field.min === undefined ? intValue : Math.max(field.min, intValue);
            return field.max === undefined ? withMin : Math.min(field.max, withMin);
        }
        case "number": {
            if (value === "" || value == null) return field.default ?? 0;
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return field.default ?? 0;
            const withMin = field.min === undefined ? parsed : Math.max(field.min, parsed);
            return field.max === undefined ? withMin : Math.min(field.max, withMin);
        }
        case "array_of_VoucherType":
            if (Array.isArray(value)) return value.map(String);
            return String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
        case "enum":
        case "string":
        default:
            return value == null ? "" : String(value);
    }
};

const getDefaultFieldValue = (field: BusinessSettingsFieldDefinition) => normalizeFieldValue(field, field.default ?? null);

const countCustomizedFields = (
    settingsData: Record<string, Record<string, unknown>>,
    schema: Record<string, BusinessSettingsFieldDefinition[]>
) => {
    let count = 0;
    for (const [section, fields] of Object.entries(schema)) {
        const values = settingsData[section] ?? {};
        for (const field of fields) {
            const current = normalizeFieldValue(field, values[field.key]);
            const fallback = getDefaultFieldValue(field);
            if (JSON.stringify(current) !== JSON.stringify(fallback)) count += 1;
        }
    }
    return count;
};

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [globalSettings, setGlobalSettings] = useState<AdminSettings | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedBusinessId, setSelectedBusinessId] = useState("");
    const [selectedBusiness, setSelectedBusiness] = useState<Organization | null>(null);
    const [profileDraft, setProfileDraft] = useState<Partial<Organization>>({});
    const [featureDetails, setFeatureDetails] = useState<FeatureFlagDetails | null>(null);
    const [settingsSchema, setSettingsSchema] = useState<BusinessSettingsSchemaPayload | null>(null);
    const [settingsData, setSettingsData] = useState<Record<string, Record<string, unknown>>>({});
    const [activeGroup, setActiveGroup] = useState<VahiSettingsGroupKey>("business");
    const [activeSection, setActiveSection] = useState("");
    const [sectionDraft, setSectionDraft] = useState<Record<string, unknown>>({});
    const [loadingGlobal, setLoadingGlobal] = useState(true);
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [loadingWorkspace, setLoadingWorkspace] = useState(false);
    const [savingGlobal, setSavingGlobal] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingFlags, setSavingFlags] = useState(false);
    const [savingSection, setSavingSection] = useState(false);
    const [resettingSection, setResettingSection] = useState(false);

    const loadGlobalSettings = useCallback(async () => {
        setLoadingGlobal(true);
        try {
            const data = await adminService.getSettings();
            setGlobalSettings(data);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to load platform settings."), type: "error" });
        } finally {
            setLoadingGlobal(false);
        }
    }, [toast]);

    const loadOrganizations = useCallback(async () => {
        setLoadingBusinesses(true);
        try {
            const rows = await organizationService.getAll();
            setOrganizations(rows);
            const requestedBusinessId = searchParams.get("businessId") ?? "";
            const nextId = requestedBusinessId || rows[0]?.id || "";
            setSelectedBusinessId((current) => current || nextId);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to load businesses."), type: "error" });
        } finally {
            setLoadingBusinesses(false);
        }
    }, [searchParams, toast]);

    const loadWorkspace = useCallback(async (businessId: string) => {
        if (!businessId) return;
        setLoadingWorkspace(true);
        try {
            const [business, flags, schema, allSettings] = await Promise.all([
                organizationService.getById(businessId),
                featureFlagService.getBusinessFlags(businessId),
                businessSettingsAdminService.getSchema(businessId),
                businessSettingsAdminService.getAll(businessId),
            ]);
            setSelectedBusiness(business);
            setProfileDraft(business);
            setFeatureDetails(flags);
            setSettingsSchema(schema);
            setSettingsData(allSettings.data);
        } catch (error) {
            toast({ title: "Workspace error", description: getErrorMessage(error, "Failed to load the Vahi business workspace."), type: "error" });
        } finally {
            setLoadingWorkspace(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadGlobalSettings();
        void loadOrganizations();
    }, [loadGlobalSettings, loadOrganizations]);

    useEffect(() => {
        if (!selectedBusinessId) return;
        void loadWorkspace(selectedBusinessId);
    }, [loadWorkspace, selectedBusinessId]);

    const groupedSections = useMemo(() => {
        const result: Record<VahiSettingsGroupKey, string[]> = {
            business: [],
            invoicing: [],
            inventory: [],
            printing: [],
        };
        for (const section of settingsSchema?.sections ?? []) {
            const group = VAHI_SETTINGS_SECTION_GROUP_MAP[section] ?? "business";
            result[group].push(section);
        }
        return result;
    }, [settingsSchema]);

    useEffect(() => {
        const availableSections = groupedSections[activeGroup] ?? [];
        if (availableSections.length === 0) {
            setActiveSection("");
            return;
        }
        if (!availableSections.includes(activeSection)) {
            setActiveSection(availableSections[0]);
        }
    }, [activeGroup, activeSection, groupedSections]);

    useEffect(() => {
        if (!activeSection) return;
        setSectionDraft(settingsData[activeSection] ?? {});
    }, [activeSection, settingsData]);

    const activeSectionFields = useMemo(() => settingsSchema?.schema[activeSection] ?? [], [activeSection, settingsSchema]);
    const activeSectionBaseline = useMemo(() => settingsData[activeSection] ?? {}, [activeSection, settingsData]);
    const activeSectionChanged = useMemo(() => JSON.stringify(activeSectionBaseline) !== JSON.stringify(sectionDraft), [activeSectionBaseline, sectionDraft]);

    const moduleAccess = useMemo(
        () => featureDetails?.moduleControl.appModuleAccess ?? {},
        [featureDetails]
    );
    const moduleVisibility = useMemo(
        () => featureDetails?.moduleControl.moduleVisibility ?? {},
        [featureDetails]
    );
    const enabledFeatureFlags = featureDetails?.subscription?.featureFlagsEnabled ?? [];

    const moduleKeys = useMemo(() => {
        const keys = new Set<string>(DEFAULT_MODULES);
        Object.keys(moduleAccess).forEach((key) => keys.add(key));
        Object.keys(moduleVisibility).forEach((key) => keys.add(key));
        return [...keys];
    }, [moduleAccess, moduleVisibility]);

    const customizedFieldCount = useMemo(() => countCustomizedFields(settingsData, settingsSchema?.schema ?? {}), [settingsData, settingsSchema]);
    const profileCompletion = useMemo(() => {
        const completed = PROFILE_COMPLETENESS_FIELDS.filter((key) => !isBlank(profileDraft[key])).length;
        return { completed, total: PROFILE_COMPLETENESS_FIELDS.length };
    }, [profileDraft]);

    const saveGlobalSettings = async () => {
        if (!globalSettings) return;
        setSavingGlobal(true);
        try {
            await adminService.updateSettings(globalSettings);
            toast({ title: "Saved", description: "Platform settings updated successfully.", type: "success" });
            await loadGlobalSettings();
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to save platform settings."), type: "error" });
        } finally {
            setSavingGlobal(false);
        }
    };

    const saveBusinessProfile = async () => {
        if (!selectedBusinessId) return;
        setSavingProfile(true);
        try {
            await organizationService.update(selectedBusinessId, {
                ...profileDraft,
                booksStartDate: profileDraft.booksStartDate ? String(profileDraft.booksStartDate) : null,
            });
            toast({ title: "Saved", description: "Business profile updated.", type: "success" });
            await loadOrganizations();
            await loadWorkspace(selectedBusinessId);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to update business profile."), type: "error" });
        } finally {
            setSavingProfile(false);
        }
    };

    const toggleFeatureFlag = (flag: string) => {
        if (!featureDetails?.subscription) return;
        const current = new Set(featureDetails.subscription.featureFlagsEnabled ?? []);
        if (current.has(flag)) current.delete(flag);
        else current.add(flag);
        setFeatureDetails({
            ...featureDetails,
            subscription: {
                ...featureDetails.subscription,
                featureFlagsEnabled: [...current],
            },
        });
    };

    const toggleModuleControl = (key: string, target: "access" | "visibility") => {
        if (!featureDetails) return;
        if (target === "access") {
            setFeatureDetails({
                ...featureDetails,
                moduleControl: {
                    ...featureDetails.moduleControl,
                    appModuleAccess: {
                        ...featureDetails.moduleControl.appModuleAccess,
                        [key]: !Boolean(featureDetails.moduleControl.appModuleAccess[key]),
                    },
                },
            });
            return;
        }
        setFeatureDetails({
            ...featureDetails,
            moduleControl: {
                ...featureDetails.moduleControl,
                moduleVisibility: {
                    ...featureDetails.moduleControl.moduleVisibility,
                    [key]: !Boolean(featureDetails.moduleControl.moduleVisibility[key]),
                },
            },
        });
    };

    const saveFlags = async () => {
        if (!selectedBusinessId || !featureDetails) return;
        setSavingFlags(true);
        try {
            await featureFlagService.updateBusinessFlags(selectedBusinessId, {
                appModuleAccess: featureDetails.moduleControl.appModuleAccess,
                moduleVisibility: featureDetails.moduleControl.moduleVisibility,
                featureFlagsEnabled: featureDetails.subscription?.featureFlagsEnabled ?? [],
            });
            toast({ title: "Saved", description: "Module access and feature flags updated.", type: "success" });
            await loadWorkspace(selectedBusinessId);
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to update module controls."), type: "error" });
        } finally {
            setSavingFlags(false);
        }
    };

    const saveSection = async () => {
        if (!selectedBusinessId || !activeSection) return;
        setSavingSection(true);
        try {
            const response = await businessSettingsAdminService.updateSection(selectedBusinessId, activeSection, sectionDraft);
            setSettingsData((current) => ({ ...current, [activeSection]: response.data }));
            setSectionDraft(response.data);
            toast({ title: "Saved", description: `${getVahiSettingsSectionLabel(activeSection)} updated.`, type: "success" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to save business settings section."), type: "error" });
        } finally {
            setSavingSection(false);
        }
    };

    const resetSection = async () => {
        if (!selectedBusinessId || !activeSection) return;
        const confirmed = window.confirm(`Reset ${getVahiSettingsSectionLabel(activeSection)} to defaults?`);
        if (!confirmed) return;
        setResettingSection(true);
        try {
            const response = await businessSettingsAdminService.resetSection(selectedBusinessId, activeSection);
            setSettingsData((current) => ({ ...current, [activeSection]: response.data }));
            setSectionDraft(response.data);
            toast({ title: "Reset", description: `${getVahiSettingsSectionLabel(activeSection)} restored to defaults.`, type: "success" });
        } catch (error) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to reset business settings."), type: "error" });
        } finally {
            setResettingSection(false);
        }
    };

    const updateSectionField = (field: BusinessSettingsFieldDefinition, value: unknown) => {
        setSectionDraft((current) => ({ ...current, [field.key]: normalizeFieldValue(field, value) }));
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Platform & Vahi Control Center</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        This rebuild aligns admin with the live Vahi app surface: business profile, plan gates,
                        module controls, and the same settings schema used by mobile and web clients.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void loadGlobalSettings()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Global
                    </Button>
                    <Button variant="outline" onClick={() => selectedBusinessId && void loadWorkspace(selectedBusinessId)} disabled={!selectedBusinessId}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Workspace
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    title="Modules Enabled"
                    value={`${moduleKeys.filter((key) => Boolean(moduleAccess[key])).length}/${moduleKeys.length || 0}`}
                    meta="Matches the app-level module contract"
                    icon={Settings2}
                />
                <SummaryCard
                    title="Feature Flags"
                    value={String(enabledFeatureFlags.length)}
                    meta="Subscription-controlled premium switches"
                    icon={Flag}
                />
                <SummaryCard
                    title="Custom Fields"
                    value={String(customizedFieldCount)}
                    meta="Business settings changed from defaults"
                    icon={SlidersHorizontal}
                />
                <SummaryCard
                    title="Profile Readiness"
                    value={`${profileCompletion.completed}/${profileCompletion.total}`}
                    meta={featureDetails?.subscription ? `${featureDetails.subscription.tier} • ${featureDetails.subscription.status}` : "No subscription linked"}
                    icon={Shield}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle>Platform Settings</CardTitle>
                        <CardDescription>Global admin defaults that apply across the whole platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {loadingGlobal || !globalSettings ? (
                            <div className="flex min-h-[220px] items-center justify-center text-muted-foreground">
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Loading global settings...
                            </div>
                        ) : (
                            <>
                                <ToggleRow
                                    title="Maintenance Mode"
                                    description="Prevent non-admin traffic while keeping the admin panel available."
                                    checked={globalSettings.maintenanceMode}
                                    onCheckedChange={(checked) => setGlobalSettings({ ...globalSettings, maintenanceMode: checked })}
                                />
                                <ToggleRow
                                    title="Registration Allowed"
                                    description="Allow new end-user signups and business creation."
                                    checked={globalSettings.registrationAllowed}
                                    onCheckedChange={(checked) => setGlobalSettings({ ...globalSettings, registrationAllowed: checked })}
                                />
                                <div className="grid gap-4 md:grid-cols-2">
                                    <LabeledField label="Global Tax Rate (%)">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={String(globalSettings.globalTaxRate)}
                                            onChange={(event) => setGlobalSettings({
                                                ...globalSettings,
                                                globalTaxRate: Number(event.target.value || 0),
                                            })}
                                        />
                                    </LabeledField>
                                    <LabeledField label="Support Email">
                                        <Input
                                            type="email"
                                            value={globalSettings.supportEmail}
                                            onChange={(event) => setGlobalSettings({
                                                ...globalSettings,
                                                supportEmail: event.target.value,
                                            })}
                                        />
                                    </LabeledField>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={() => void saveGlobalSettings()} isLoading={savingGlobal}>
                                        Save Platform Settings
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle>Related Admin Modules</CardTitle>
                        <CardDescription>
                            These pages now connect directly to the same Vahi workspace model instead of living as isolated tools.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {RELATED_WORKSPACE_LINKS.map((entry) => {
                            const Icon = entry.icon;
                            return (
                                <Link
                                    key={entry.href}
                                    href={entry.href}
                                    className="group rounded-2xl border p-4 transition-colors hover:bg-muted/50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="font-semibold">{entry.label}</p>
                                            <p className="text-sm text-muted-foreground">{entry.description}</p>
                                        </div>
                                        <div className="rounded-xl bg-primary/10 p-2 text-primary">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                                        Open
                                        <ExternalLink className="ml-1 h-3 w-3" />
                                    </div>
                                </Link>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle>Business Workspace</CardTitle>
                    <CardDescription>
                        Compare and manage a business against the same settings surface exposed inside Vahi.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 xl:grid-cols-[300px,1fr]">
                        <LabeledField label="Select Business">
                            <Select value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(event.target.value)} disabled={loadingBusinesses}>
                                {organizations.map((organization) => (
                                    <option key={organization.id} value={organization.id}>
                                        {organization.name} ({organization.code})
                                    </option>
                                ))}
                            </Select>
                        </LabeledField>

                        <div className="grid gap-4 md:grid-cols-3">
                            <MiniStat
                                label="Business"
                                value={selectedBusiness?.name ?? "Not selected"}
                                meta={selectedBusiness?.legalName || selectedBusiness?.code || "Choose a business"}
                            />
                            <MiniStat
                                label="Subscription"
                                value={featureDetails?.subscription?.tier ?? "None"}
                                meta={featureDetails?.subscription?.status ?? "No linked subscription"}
                            />
                            <MiniStat
                                label="Workspace Status"
                                value={loadingWorkspace ? "Refreshing" : "Ready"}
                                meta={selectedBusiness?.state || "No state configured"}
                            />
                        </div>
                    </div>

                    {loadingWorkspace ? (
                        <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Loading business workspace...
                        </div>
                    ) : !selectedBusiness ? (
                        <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                            Choose a business to load its Vahi-aligned admin workspace.
                        </div>
                    ) : (
                        <BusinessWorkspace
                            activeGroup={activeGroup}
                            activeSection={activeSection}
                            activeSectionChanged={activeSectionChanged}
                            activeSectionFields={activeSectionFields}
                            enabledFeatureFlags={enabledFeatureFlags}
                            featureDetails={featureDetails}
                            groupedSections={groupedSections}
                            moduleAccess={moduleAccess}
                            moduleKeys={moduleKeys}
                            moduleVisibility={moduleVisibility}
                            profileDraft={profileDraft}
                            resettingSection={resettingSection}
                            savingFlags={savingFlags}
                            savingProfile={savingProfile}
                            savingSection={savingSection}
                            sectionDraft={sectionDraft}
                            selectedBusiness={selectedBusiness}
                            settingsSchema={settingsSchema}
                            onProfileDraftChange={setProfileDraft}
                            onSaveBusinessProfile={saveBusinessProfile}
                            onSaveFlags={saveFlags}
                            onToggleFeatureFlag={toggleFeatureFlag}
                            onToggleModuleControl={toggleModuleControl}
                            onGroupChange={setActiveGroup}
                            onSectionChange={setActiveSection}
                            onResetSection={resetSection}
                            onSaveSection={saveSection}
                            onSectionFieldChange={updateSectionField}
                        />
                    )}
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
    icon: React.ComponentType<{ className?: string }>;
}) {
    return (
        <Card className="border-none shadow-sm">
            <CardContent className="flex items-start justify-between gap-4 p-6">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold tracking-tight">{value}</p>
                    <p className="text-sm text-muted-foreground">{meta}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
}

function BusinessWorkspace({
    activeGroup,
    activeSection,
    activeSectionChanged,
    activeSectionFields,
    enabledFeatureFlags,
    featureDetails,
    groupedSections,
    moduleAccess,
    moduleKeys,
    moduleVisibility,
    profileDraft,
    resettingSection,
    savingFlags,
    savingProfile,
    savingSection,
    sectionDraft,
    selectedBusiness,
    settingsSchema,
    onProfileDraftChange,
    onSaveBusinessProfile,
    onSaveFlags,
    onToggleFeatureFlag,
    onToggleModuleControl,
    onGroupChange,
    onSectionChange,
    onResetSection,
    onSaveSection,
    onSectionFieldChange,
}: {
    activeGroup: VahiSettingsGroupKey;
    activeSection: string;
    activeSectionChanged: boolean;
    activeSectionFields: BusinessSettingsFieldDefinition[];
    enabledFeatureFlags: string[];
    featureDetails: FeatureFlagDetails | null;
    groupedSections: Record<VahiSettingsGroupKey, string[]>;
    moduleAccess: Record<string, boolean>;
    moduleKeys: string[];
    moduleVisibility: Record<string, boolean>;
    profileDraft: Partial<Organization>;
    resettingSection: boolean;
    savingFlags: boolean;
    savingProfile: boolean;
    savingSection: boolean;
    sectionDraft: Record<string, unknown>;
    selectedBusiness: Organization;
    settingsSchema: BusinessSettingsSchemaPayload | null;
    onProfileDraftChange: React.Dispatch<React.SetStateAction<Partial<Organization>>>;
    onSaveBusinessProfile: () => Promise<void>;
    onSaveFlags: () => Promise<void>;
    onToggleFeatureFlag: (flag: string) => void;
    onToggleModuleControl: (key: string, target: "access" | "visibility") => void;
    onGroupChange: (group: VahiSettingsGroupKey) => void;
    onSectionChange: (section: string) => void;
    onResetSection: () => Promise<void>;
    onSaveSection: () => Promise<void>;
    onSectionFieldChange: (field: BusinessSettingsFieldDefinition, value: unknown) => void;
}) {
    return (
        <>
            <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                <Card className="border shadow-none">
                    <CardHeader>
                        <CardTitle className="text-xl">Business Profile</CardTitle>
                        <CardDescription>Core identity, GST metadata, and branding inputs consumed by the app.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <LabeledField label="Business Name">
                                <Input value={profileDraft.name || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, name: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Internal Code">
                                <Input value={profileDraft.code || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, code: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Legal Name">
                                <Input value={profileDraft.legalName || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, legalName: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="State">
                                <Input value={profileDraft.state || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, state: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="GST Number">
                                <Input value={profileDraft.gstNumber || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, gstNumber: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="PAN">
                                <Input value={profileDraft.pan || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, pan: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Category">
                                <Input value={profileDraft.category || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, category: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Currency">
                                <Input value={profileDraft.currency || "INR"} onChange={(event) => onProfileDraftChange({ ...profileDraft, currency: event.target.value.toUpperCase() })} />
                            </LabeledField>
                            <LabeledField label="Phone Number">
                                <Input value={profileDraft.phoneNumber || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, phoneNumber: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Email">
                                <Input type="email" value={profileDraft.email || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, email: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Books Start Date">
                                <Input type="date" value={toDateInputValue(profileDraft.booksStartDate)} onChange={(event) => onProfileDraftChange({ ...profileDraft, booksStartDate: event.target.value })} />
                            </LabeledField>
                            <LabeledField label="Logo URL">
                                <Input value={profileDraft.logoUrl || ""} onChange={(event) => onProfileDraftChange({ ...profileDraft, logoUrl: event.target.value })} placeholder="https://example.com/logo.png" />
                            </LabeledField>
                        </div>
                        <LabeledField label="Address">
                            <textarea
                                className="min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                value={profileDraft.address || ""}
                                onChange={(event) => onProfileDraftChange({ ...profileDraft, address: event.target.value })}
                            />
                        </LabeledField>
                        <div className="flex items-center justify-between rounded-2xl border p-4">
                            <div>
                                <p className="font-semibold">Business Active</p>
                                <p className="text-sm text-muted-foreground">Controls whether the business is available for app access.</p>
                            </div>
                            <Switch checked={Boolean(profileDraft.isActive)} onCheckedChange={(checked) => onProfileDraftChange({ ...profileDraft, isActive: checked })} />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={() => void onSaveBusinessProfile()} isLoading={savingProfile}>
                                Save Business Profile
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border shadow-none">
                    <CardHeader>
                        <CardTitle className="text-xl">Module Access & Plan Gates</CardTitle>
                        <CardDescription>These controls are compared directly against the Vahi module contract used in the app and backend.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Module Controls</p>
                            <div className="space-y-3">
                                {moduleKeys.map((moduleKey) => (
                                    <div key={moduleKey} className="rounded-2xl border p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="font-semibold capitalize">{moduleKey}</p>
                                                <p className="text-sm text-muted-foreground">Controls Vahi navigation and backend access for this module.</p>
                                            </div>
                                            <div className="space-y-2 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</span>
                                                    <Switch checked={Boolean(moduleAccess[moduleKey])} onCheckedChange={() => onToggleModuleControl(moduleKey, "access")} />
                                                </div>
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visible</span>
                                                    <Switch checked={Boolean(moduleVisibility[moduleKey])} onCheckedChange={() => onToggleModuleControl(moduleKey, "visibility")} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Feature Flags</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {CORE_FEATURE_FLAGS.map((flag) => (
                                    <div key={flag} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                                        <span className="text-xs font-semibold tracking-wide">{flag}</span>
                                        <Switch checked={enabledFeatureFlags.includes(flag)} onCheckedChange={() => onToggleFeatureFlag(flag)} disabled={!featureDetails?.subscription} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={() => void onSaveFlags()} isLoading={savingFlags}>
                                Save Module Controls
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border shadow-none">
                <CardHeader>
                    <CardTitle className="text-xl">Business Settings Schema</CardTitle>
                    <CardDescription>Same per-section settings model used by Vahi app screens, now manageable from admin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {VAHI_SETTINGS_GROUPS.map((group) => (
                            <button
                                key={group.key}
                                type="button"
                                onClick={() => onGroupChange(group.key)}
                                className={cn(
                                    "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                                    activeGroup === group.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                            >
                                {group.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[300px,1fr]">
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {VAHI_SETTINGS_GROUPS.find((group) => group.key === activeGroup)?.description}
                            </p>
                            {(groupedSections[activeGroup] ?? []).map((section) => (
                                <button
                                    key={section}
                                    type="button"
                                    onClick={() => onSectionChange(section)}
                                    className={cn(
                                        "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                                        activeSection === section ? "border-primary bg-primary/5" : "hover:bg-muted"
                                    )}
                                >
                                    <p className="font-semibold">{getVahiSettingsSectionLabel(section)}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {(settingsSchema?.schema[section] ?? []).length} configurable fields
                                    </p>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {activeSection ? (
                                <>
                                    <div className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-semibold">{getVahiSettingsSectionLabel(activeSection)}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Edit the real section values consumed by Vahi screens and repositories for {selectedBusiness.name}.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" onClick={() => void onResetSection()} isLoading={resettingSection}>
                                                Reset Section
                                            </Button>
                                            <Button onClick={() => void onSaveSection()} isLoading={savingSection} disabled={!activeSectionChanged}>
                                                Save Section
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        {activeSectionFields.map((field) => {
                                            const rawValue = sectionDraft[field.key];
                                            const normalizedValue = normalizeFieldValue(field, rawValue);
                                            const enumOptions = field.enumValues ?? field.allowed ?? [];
                                            const valueString = Array.isArray(normalizedValue)
                                                ? normalizedValue.join(", ")
                                                : normalizedValue == null
                                                    ? ""
                                                    : String(normalizedValue);

                                            return (
                                                <div key={field.key} className="rounded-2xl border p-4">
                                                    <div className="mb-3 flex items-start justify-between gap-4">
                                                        <div>
                                                            <p className="font-semibold">{field.label}</p>
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.key}</p>
                                                        </div>
                                                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                                            {field.type}
                                                        </span>
                                                    </div>

                                                    {field.type === "boolean" ? (
                                                        <ToggleRow
                                                            title={Boolean(normalizedValue) ? "Enabled" : "Disabled"}
                                                            description="Directly controls the stored boolean value for this business."
                                                            checked={Boolean(normalizedValue)}
                                                            onCheckedChange={(checked) => onSectionFieldChange(field, checked)}
                                                        />
                                                    ) : enumOptions.length > 0 ? (
                                                        <Select value={valueString} onChange={(event) => onSectionFieldChange(field, event.target.value)}>
                                                            {field.nullable ? <option value="">Not set</option> : null}
                                                            {enumOptions.map((option) => (
                                                                <option key={option} value={option}>{option}</option>
                                                            ))}
                                                        </Select>
                                                    ) : field.type === "array_of_VoucherType" || isLongTextField(field) ? (
                                                        <textarea
                                                            className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                                            value={valueString}
                                                            onChange={(event) => onSectionFieldChange(field, event.target.value)}
                                                            placeholder={field.type === "array_of_VoucherType" ? "Comma separated values" : ""}
                                                        />
                                                    ) : (
                                                        <Input
                                                            type={field.type === "integer" || field.type === "number" ? "number" : "text"}
                                                            min={field.min}
                                                            max={field.max}
                                                            step={field.type === "integer" ? 1 : "any"}
                                                            value={valueString}
                                                            onChange={(event) => onSectionFieldChange(field, event.target.value)}
                                                        />
                                                    )}

                                                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                                        <p>Default: {Array.isArray(field.default) ? field.default.join(", ") : String(field.default ?? "none")}</p>
                                                        {field.min !== undefined || field.max !== undefined ? <p>Range: {field.min ?? "any"} - {field.max ?? "any"}</p> : null}
                                                        {field.nullable ? <p>Nullable field</p> : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                                    No settings section available for this group yet.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}

function MiniStat({ label, value, meta }: { label: string; value: string; meta: string }) {
    return (
        <div className="rounded-2xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
        </div>
    );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            {children}
        </div>
    );
}

function ToggleRow({
    title,
    description,
    checked,
    onCheckedChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
            <div className="space-y-1">
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}
