"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Shield, Zap, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminService, AdminSettings } from "@/services/adminService";
import { useToast } from "@/components/ui/Toast";

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<AdminSettings | null>(null);

    const { toast } = useToast();

    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getSettings();
            setSettings(data);
        } catch (error) {
            console.error("Failed to load settings", error);
            toast({
                title: "Error",
                description: "Failed to load global settings",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    const handleUpdate = async (update: Partial<AdminSettings>) => {
        if (!settings) return;
        setSettings({ ...settings, ...update });
    };

    const saveSettings = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await adminService.updateSettings(settings);
            toast({
                title: "Success",
                description: "Global settings updated successfully",
                type: "success"
            });
        } catch (error) {
            console.error("Failed to save settings", error);
            toast({
                title: "Error",
                description: "Failed to persist changes",
                type: "error"
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
                <p className="text-muted-foreground text-lg">Configure global system behavior and security policies.</p>
            </div>

            <div className="space-y-6">
                <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-6 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Authentication & Security</CardTitle>
                                <CardDescription>Manage security protocols and access controls.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 divide-y">
                        <div className="flex items-center justify-between pt-0">
                            <div className="space-y-1">
                                <p className="font-semibold">Maintenance Mode</p>
                                <p className="text-sm text-muted-foreground">Redirect all non-admin users to a maintenance page.</p>
                            </div>
                            <Switch
                                checked={settings?.maintenanceMode ?? false}
                                onCheckedChange={(val) => handleUpdate({ maintenanceMode: val })}
                            />
                        </div>
                        <div className="flex items-center justify-between pt-6">
                            <div className="space-y-1">
                                <p className="font-semibold">Registration Allowed</p>
                                <p className="text-sm text-muted-foreground">Enable or disable new user registrations.</p>
                            </div>
                            <Switch
                                checked={settings?.registrationAllowed ?? false}
                                onCheckedChange={(val) => handleUpdate({ registrationAllowed: val })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-6 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                                <Zap className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Financial Defaults</CardTitle>
                                <CardDescription>Global defaults for financial calculations.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 divide-y">
                        <div className="space-y-2 pt-0">
                            <div className="space-y-1">
                                <p className="font-semibold">Global Tax Rate (%)</p>
                                <p className="text-sm text-muted-foreground">Default tax percentage applied to items.</p>
                            </div>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={String(settings?.globalTaxRate ?? 0)}
                                onChange={(event) => handleUpdate({
                                    globalTaxRate: Number(event.target.value || 0),
                                })}
                            />
                        </div>
                        <div className="space-y-2 pt-6">
                            <div className="space-y-1">
                                <p className="font-semibold">Support Email</p>
                                <p className="text-sm text-muted-foreground">Contact point for system level inquiries.</p>
                            </div>
                            <Input
                                type="email"
                                value={settings?.supportEmail ?? ""}
                                onChange={(event) => handleUpdate({
                                    supportEmail: event.target.value,
                                })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="ghost" onClick={loadSettings}>Reset</Button>
                <Button
                    size="lg"
                    className="px-8 shadow-lg shadow-primary/20"
                    onClick={saveSettings}
                    disabled={isSaving}
                >
                    {isSaving ? "Saving..." : "Save Global Settings"}
                </Button>
            </div>
        </div>
    );
}
