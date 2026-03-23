"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, Edit3, RefreshCw, RotateCcw, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { organizationService, type Organization } from "@/services/organizationService";
import { partyAdminService, type PartyAdminRow, type PartyAdminSummary } from "@/services/partyAdminService";

const EMPTY_SUMMARY: PartyAdminSummary = {
    total: 0,
    active: 0,
    inactive: 0,
    customers: 0,
    suppliers: 0,
};

export default function PartiesPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [summary, setSummary] = useState<PartyAdminSummary>(EMPTY_SUMMARY);
    const [rows, setRows] = useState<PartyAdminRow[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [businessFilter, setBusinessFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState<"ALL" | "CUSTOMER" | "SUPPLIER">("ALL");
    const [includeInactive, setIncludeInactive] = useState(false);
    const [selectedParty, setSelectedParty] = useState<PartyAdminRow | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        type: "CUSTOMER" as "CUSTOMER" | "SUPPLIER",
        phone: "",
        email: "",
        billingAddress: "",
        gstin: "",
        openingBalance: "0",
        creditLimit: "0",
        loyaltyPoints: "0",
        isActive: true,
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [partyResponse, orgRows] = await Promise.all([
                partyAdminService.getAll({
                    businessId: businessFilter === "ALL" ? undefined : businessFilter,
                    type: typeFilter === "ALL" ? undefined : typeFilter,
                    includeInactive,
                    limit: 500,
                }),
                organizationService.getAll(),
            ]);
            setSummary(partyResponse.summary ?? EMPTY_SUMMARY);
            setRows(partyResponse.parties ?? []);
            setOrganizations(orgRows ?? []);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load parties."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessFilter, typeFilter, includeInactive]);

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.businessName.toLowerCase().includes(query)
            || (entry.phone?.toLowerCase().includes(query) ?? false)
            || (entry.email?.toLowerCase().includes(query) ?? false)
            || (entry.gstin?.toLowerCase().includes(query) ?? false)
        ));
    }, [rows, searchQuery]);

    const openEdit = (party: PartyAdminRow) => {
        setSelectedParty(party);
        setForm({
            name: party.name,
            type: party.type,
            phone: party.phone ?? "",
            email: party.email ?? "",
            billingAddress: party.billingAddress ?? "",
            gstin: party.gstin ?? "",
            openingBalance: String(party.openingBalance ?? 0),
            creditLimit: String(party.creditLimit ?? 0),
            loyaltyPoints: String(party.loyaltyPoints ?? 0),
            isActive: party.isActive,
        });
        setIsEditOpen(true);
    };

    const runMutation = async (work: () => Promise<void>, successMessage: string) => {
        setIsMutating(true);
        try {
            await work();
            toast({ title: "Success", description: successMessage, type: "success" });
            await loadData();
        } catch (error) {
            toast({
                title: "Action failed",
                description: getErrorMessage(error, "Unable to complete party action."),
                type: "error",
            });
        } finally {
            setIsMutating(false);
        }
    };

    const saveEdit = async () => {
        if (!selectedParty) return;
        await runMutation(async () => {
            await partyAdminService.update(selectedParty.id, {
                name: form.name.trim(),
                type: form.type,
                phone: form.phone.trim() || null,
                email: form.email.trim() || null,
                billingAddress: form.billingAddress.trim() || null,
                gstin: form.gstin.trim() || null,
                openingBalance: Number(form.openingBalance || 0),
                creditLimit: Number(form.creditLimit || 0),
                loyaltyPoints: Number(form.loyaltyPoints || 0),
                isActive: form.isActive,
            });
            setIsEditOpen(false);
            setSelectedParty(null);
        }, "Party updated.");
    };

    const toggleActiveState = async (party: PartyAdminRow) => {
        if (party.isActive) {
            await runMutation(async () => {
                await partyAdminService.deactivate(party.id);
            }, "Party deactivated.");
            return;
        }
        await runMutation(async () => {
            await partyAdminService.restore(party.id);
        }, "Party restored.");
    };

    const permanentDelete = async (party: PartyAdminRow) => {
        if (!window.confirm(`Permanently delete ${party.name}? This cannot be undone.`)) return;
        await runMutation(async () => {
            await partyAdminService.deletePermanent(party.id);
        }, "Party permanently deleted.");
    };

    const columns = [
        {
            header: "Party",
            accessorKey: "name",
            cell: (entry: PartyAdminRow) => (
                <div className="space-y-1">
                    <div className="font-semibold">{entry.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.businessName}</div>
                </div>
            ),
        },
        {
            header: "Type",
            accessorKey: "type",
            cell: (entry: PartyAdminRow) => (
                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${entry.type === "CUSTOMER" ? "bg-blue-500/15 text-blue-700" : "bg-orange-500/15 text-orange-700"}`}>
                    {entry.type}
                </span>
            ),
        },
        { header: "Phone", accessorKey: "phone" },
        { header: "Email", accessorKey: "email" },
        {
            header: "Credit",
            accessorKey: "creditLimit",
            cell: (entry: PartyAdminRow) => `INR ${Number(entry.creditLimit ?? 0).toLocaleString()}`,
        },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (entry: PartyAdminRow) => (
                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${entry.isActive ? "bg-green-500/15 text-green-700" : "bg-zinc-500/15 text-zinc-700"}`}>
                    {entry.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
            ),
        },
        {
            header: "Actions",
            accessorKey: "id",
            cell: (entry: PartyAdminRow) => (
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(entry)}>
                        <Edit3 className="mr-1 h-3 w-3" />
                        Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { void toggleActiveState(entry); }} disabled={isMutating}>
                        <RotateCcw className="mr-1 h-3 w-3" />
                        {entry.isActive ? "Deactivate" : "Restore"}
                    </Button>
                    {!entry.isActive ? (
                        <Button variant="outline" size="sm" onClick={() => { void permanentDelete(entry); }} disabled={isMutating}>
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                        </Button>
                    ) : null}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Parties</h1>
                    <p className="text-muted-foreground">Dedicated customer and supplier management instead of hiding party governance inside generic settings.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}>
                        <option value="ALL">All businesses</option>
                        {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                    </Select>
                    <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "ALL" | "CUSTOMER" | "SUPPLIER")}>
                        <option value="ALL">All types</option>
                        <option value="CUSTOMER">Customers</option>
                        <option value="SUPPLIER">Suppliers</option>
                    </Select>
                    <Button variant={includeInactive ? "default" : "outline"} onClick={() => setIncludeInactive((prev) => !prev)}>
                        {includeInactive ? "Including inactive" : "Active only"}
                    </Button>
                    <Button variant="outline" onClick={() => { void loadData(); }}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Total Parties" value={String(summary.total)} icon={Users} meta="Visible under current filters" />
                <SummaryCard title="Active" value={String(summary.active)} icon={Building2} meta="Currently usable in business flows" />
                <SummaryCard title="Customers" value={String(summary.customers)} icon={Users} meta="Customer ledger records" />
                <SummaryCard title="Suppliers" value={String(summary.suppliers)} icon={Users} meta="Supplier ledger records" />
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredRows}
                        isLoading={isLoading}
                        searchPlaceholder="Filter by party name, phone, email, GSTIN, or business..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>

            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title={selectedParty ? `Edit Party: ${selectedParty.name}` : "Edit Party"}
                className="max-w-3xl"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name">
                        <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                    </Field>
                    <Field label="Type">
                        <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as "CUSTOMER" | "SUPPLIER" }))}>
                            <option value="CUSTOMER">CUSTOMER</option>
                            <option value="SUPPLIER">SUPPLIER</option>
                        </Select>
                    </Field>
                    <Field label="Phone">
                        <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                    </Field>
                    <Field label="Email">
                        <Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                    </Field>
                    <Field label="GSTIN">
                        <Input value={form.gstin} onChange={(event) => setForm((prev) => ({ ...prev, gstin: event.target.value.toUpperCase() }))} />
                    </Field>
                    <Field label="Opening Balance">
                        <Input type="number" value={form.openingBalance} onChange={(event) => setForm((prev) => ({ ...prev, openingBalance: event.target.value }))} />
                    </Field>
                    <Field label="Credit Limit">
                        <Input type="number" value={form.creditLimit} onChange={(event) => setForm((prev) => ({ ...prev, creditLimit: event.target.value }))} />
                    </Field>
                    <Field label="Loyalty Points">
                        <Input type="number" value={form.loyaltyPoints} onChange={(event) => setForm((prev) => ({ ...prev, loyaltyPoints: event.target.value }))} />
                    </Field>
                </div>
                <Field label="Billing Address" className="mt-4">
                    <textarea
                        className="min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                        value={form.billingAddress}
                        onChange={(event) => setForm((prev) => ({ ...prev, billingAddress: event.target.value }))}
                    />
                </Field>
                <div className="mt-4 flex items-center justify-between rounded-2xl border p-4">
                    <div>
                        <p className="font-semibold">Party Active</p>
                        <p className="text-sm text-muted-foreground">Controls whether the record remains available to business users.</p>
                    </div>
                    <Button variant={form.isActive ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}>
                        {form.isActive ? "Active" : "Inactive"}
                    </Button>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                    <Button onClick={() => { void saveEdit(); }} isLoading={isMutating}>Save</Button>
                </div>
            </Modal>
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
        <Card className="border-none shadow-sm bg-muted/20">
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

function Field({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <label className="mb-1 block text-xs font-medium">{label}</label>
            {children}
        </div>
    );
}
