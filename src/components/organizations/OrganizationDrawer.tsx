"use client";

import React, { useState, useEffect } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Organization, organizationService } from "@/services/organizationService";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import { getErrorMessage } from "@/lib/api-error";

interface OrganizationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    organization?: Organization;
    onSuccess: () => void;
}

export function OrganizationDrawer({ isOpen, onClose, organization, onSuccess }: OrganizationDrawerProps) {
    const [formData, setFormData] = useState<Partial<Organization>>({
        name: "",
        code: "",
        gstNumber: "",
        address: "",
        phoneNumber: "",
        email: "",
        currency: "INR",
        isActive: true,
    });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (organization) {
            setFormData(organization);
        } else {
            setFormData({
                name: "",
                code: "",
                gstNumber: "",
                address: "",
                phoneNumber: "",
                email: "",
                currency: "INR",
                isActive: true,
            });
        }
    }, [organization, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (organization) {
                await organizationService.update(organization.id, formData);
                toast({
                    title: "Success",
                    description: "Organization updated successfully",
                    type: "success"
                });
            } else {
                await organizationService.create(formData);
                toast({
                    title: "Success",
                    description: "Organization created successfully",
                    type: "success"
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to save organization."),
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={organization ? "Edit Organization" : "Create Organization"}
            description={organization ? `Managing ${organization.name}` : "Add a new business to the system."}
            footer={
                <div className="flex gap-3 justify-end w-full">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} isLoading={isLoading}>
                        {organization ? "Save Changes" : "Create Organization"}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Business Name</label>
                        <Input
                            placeholder="e.g. Vahi Mart"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Internal Code</label>
                        <Input
                            placeholder="e.g. VMART01"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">GST Number (Optional)</label>
                        <Input
                            placeholder="e.g. 07AAAAA0000A1Z5"
                            value={formData.gstNumber || ""}
                            onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                        />
                    </div>
                </div>

                <div className="h-px bg-muted" />

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email Address</label>
                        <Input
                            type="email"
                            placeholder="admin@business.com"
                            value={formData.email || ""}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Phone Number</label>
                        <Input
                            placeholder="+91 99999 99999"
                            value={formData.phoneNumber || ""}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Business Address</label>
                        <Input
                            placeholder="Full address here..."
                            value={formData.address || ""}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                </div>

                <div className="h-px bg-muted" />

                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold">Active Status</p>
                        <p className="text-xs text-muted-foreground">Toggle organization visibility and access.</p>
                    </div>
                    <Switch
                        checked={formData.isActive || false}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                </div>
            </form>
        </Sheet>
    );
}
