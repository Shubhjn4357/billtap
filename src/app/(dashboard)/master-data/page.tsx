"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { notificationService, type MasterDataPayload } from "@/services/notificationService";
import { Check, Database, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";

const sortUnique = (values: string[]) => [...new Set(values.map((entry) => entry.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export default function MasterDataPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [payload, setPayload] = useState<MasterDataPayload | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [units, setUnits] = useState<string[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [newUnit, setNewUnit] = useState("");
    const { toast } = useToast();

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await notificationService.getMasterData();
            setPayload(data);
            setCategories(sortUnique(data.categories.configured));
            setUnits(sortUnique(data.units.configured));
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load master data."),
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

    const discoveredCategories = useMemo(
        () => sortUnique(payload?.categories.discovered ?? []),
        [payload]
    );
    const discoveredUnits = useMemo(
        () => sortUnique(payload?.units.discovered ?? []),
        [payload]
    );

    const addCategory = (entry: string) => {
        const value = entry.trim();
        if (!value) return;
        setCategories((prev) => sortUnique([...prev, value]));
        setNewCategory("");
    };

    const addUnit = (entry: string) => {
        const value = entry.trim();
        if (!value) return;
        setUnits((prev) => sortUnique([...prev, value]));
        setNewUnit("");
    };

    const removeCategory = (entry: string) => {
        setCategories((prev) => prev.filter((item) => item !== entry));
    };

    const removeUnit = (entry: string) => {
        setUnits((prev) => prev.filter((item) => item !== entry));
    };

    const save = async () => {
        setIsSaving(true);
        try {
            const result = await notificationService.updateMasterData({
                categories,
                units,
            });
            toast({
                title: "Saved",
                description: `Master data updated (${result.categories.length} categories, ${result.units.length} units).`,
                type: "success",
            });
            await load();
        } catch (error) {
            toast({
                title: "Save failed",
                description: getErrorMessage(error, "Failed to update master data."),
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const seedDefaults = async () => {
        setIsSeeding(true);
        try {
            const result = await notificationService.seedMasterDataDefaults();
            toast({
                title: "Defaults seeded",
                description: `Added ${result.seededTemplates} template presets and refreshed categories/units.`,
                type: "success",
            });
            await load();
        } catch (error) {
            toast({
                title: "Seed failed",
                description: getErrorMessage(error, "Failed to seed defaults."),
                type: "error",
            });
        } finally {
            setIsSeeding(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Loading master data...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Master Data</h1>
                    <p className="text-muted-foreground">Manage reusable category/unit presets and default template pack.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void load()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline" onClick={() => { void seedDefaults(); }} disabled={isSeeding}>
                        <Database className="mr-2 h-4 w-4" />
                        {isSeeding ? "Seeding..." : "Seed Defaults"}
                    </Button>
                    <Button onClick={() => { void save(); }} disabled={isSaving}>
                        <Check className="mr-2 h-4 w-4" />
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Item Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                value={newCategory}
                                onChange={(event) => setNewCategory(event.target.value)}
                                placeholder="Add category (e.g. FMCG)"
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addCategory(newCategory);
                                    }
                                }}
                            />
                            <Button variant="outline" onClick={() => addCategory(newCategory)}>Add</Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {categories.map((entry) => (
                                <button
                                    key={entry}
                                    type="button"
                                    onClick={() => removeCategory(entry)}
                                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                                    title="Remove from configured list"
                                >
                                    {entry}
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            ))}
                            {categories.length === 0 && <p className="text-sm text-muted-foreground">No configured categories yet.</p>}
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Detected from live data</p>
                            <div className="flex flex-wrap gap-2">
                                {discoveredCategories.map((entry) => (
                                    <button
                                        key={entry}
                                        type="button"
                                        onClick={() => addCategory(entry)}
                                        className="rounded-full border border-dashed px-3 py-1 text-xs hover:bg-muted"
                                    >
                                        + {entry}
                                    </button>
                                ))}
                                {discoveredCategories.length === 0 && <p className="text-sm text-muted-foreground">No discovered categories.</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Item Units</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                value={newUnit}
                                onChange={(event) => setNewUnit(event.target.value)}
                                placeholder="Add unit (e.g. carton)"
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addUnit(newUnit);
                                    }
                                }}
                            />
                            <Button variant="outline" onClick={() => addUnit(newUnit)}>Add</Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {units.map((entry) => (
                                <button
                                    key={entry}
                                    type="button"
                                    onClick={() => removeUnit(entry)}
                                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                                    title="Remove from configured list"
                                >
                                    {entry}
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            ))}
                            {units.length === 0 && <p className="text-sm text-muted-foreground">No configured units yet.</p>}
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Detected from live data</p>
                            <div className="flex flex-wrap gap-2">
                                {discoveredUnits.map((entry) => (
                                    <button
                                        key={entry}
                                        type="button"
                                        onClick={() => addUnit(entry)}
                                        className="rounded-full border border-dashed px-3 py-1 text-xs hover:bg-muted"
                                    >
                                        + {entry}
                                    </button>
                                ))}
                                {discoveredUnits.length === 0 && <p className="text-sm text-muted-foreground">No discovered units.</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Global Template Pack</CardTitle>
                    <Link href="/templates" className="text-sm font-medium text-primary hover:underline">
                        Open Template Manager
                    </Link>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {(payload?.templates ?? []).map((entry) => (
                            <div key={entry.id} className="rounded-lg border p-3">
                                <p className="font-medium">{entry.name}</p>
                                <p className="text-xs text-muted-foreground uppercase">{entry.type}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {entry.businessId ? `Business: ${entry.businessId}` : "Global preset"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {entry.isDefault ? "Default" : "Optional"} | {entry.isActive ? "Active" : "Inactive"}
                                </p>
                            </div>
                        ))}
                        {(payload?.templates ?? []).length === 0 && (
                            <p className="text-sm text-muted-foreground">No template records available.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

