"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Store, CheckCircle2, XCircle } from "lucide-react";
import { Organization, organizationService } from "@/services/organizationService";
import { useToast } from "@/components/ui/Toast";
import { OrganizationDrawer } from "@/components/organizations/OrganizationDrawer";

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<Organization | undefined>(undefined);
    const { toast } = useToast();

    const fetchOrganizations = async () => {
        setIsLoading(true);
        try {
            const data = await organizationService.getAll();
            setOrganizations(data);
        } catch {
            toast({
                title: "Error",
                description: "Failed to fetch organizations",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEdit = (org: Organization) => {
        setSelectedOrg(org);
        setIsDrawerOpen(true);
    };

    const handleCreate = () => {
        setSelectedOrg(undefined);
        setIsDrawerOpen(true);
    };

    const columns = [
        {
            header: "Organization",
            accessorKey: "name",
            cell: (org: Organization) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Store className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-semibold">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.code}</p>
                    </div>
                </div>
            )
        },
        {
            header: "GST Number",
            accessorKey: "gstNumber",
            cell: (org: Organization) => org.gstNumber || "N/A"
        },
        {
            header: "Contact",
            accessorKey: "phoneNumber",
            cell: (org: Organization) => (
                <div className="text-xs space-y-0.5">
                    <p>{org.phoneNumber || "No Phone"}</p>
                    <p className="text-muted-foreground">{org.email || "No Email"}</p>
                </div>
            )
        },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (org: Organization) => (
                <div className={org.isActive ? "text-green-600 flex items-center gap-1.5" : "text-red-500 flex items-center gap-1.5"}>
                    {org.isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-xs font-semibold uppercase tracking-wider">{org.isActive ? "Active" : "Inactive"}</span>
                </div>
            )
        },
        {
            header: "Actions",
            accessorKey: "actions",
            className: "text-right",
            cell: (org: Organization) => (
                <Button variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(org);
                }}>
                    Edit
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
                    <p className="text-muted-foreground">Manage all registered businesses in the system.</p>
                </div>
                <Button onClick={handleCreate} className="h-11 px-6 shadow-lg shadow-primary/20">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Organization
                </Button>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredOrgs}
                        isLoading={isLoading}
                        onRowClick={handleEdit}
                        searchPlaceholder="Filter by name or code..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>

            <OrganizationDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                organization={selectedOrg}
                onSuccess={fetchOrganizations}
            />
        </div>
    );
}
