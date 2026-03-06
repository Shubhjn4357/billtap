"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Clock, Filter, MailPlus, RefreshCw, ShieldCheck, Trash2, UserMinus, Users, XCircle } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { organizationService, type Organization } from "@/services/organizationService";
import {
    staffService,
    type StaffDirectoryRow,
    type StaffInviteRow,
    type StaffMemberRow,
    type StaffOverviewStats,
} from "@/services/staffService";

const EMPTY_STATS: StaffOverviewStats = {
    totalPersonnel: 0,
    verifiedAdmins: 0,
    pendingInvites: 0,
    revokedAccess: 0,
};

export default function StaffPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState<StaffOverviewStats>(EMPTY_STATS);
    const [staff, setStaff] = useState<StaffDirectoryRow[]>([]);
    const [invites, setInvites] = useState<StaffInviteRow[]>([]);
    const [members, setMembers] = useState<StaffMemberRow[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [inviteForm, setInviteForm] = useState({
        businessId: "",
        phoneNumber: "",
        role: "STAFF" as "OWNER" | "STAFF",
        expiresInDays: "7",
    });
    const [inviteSearch, setInviteSearch] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const { toast } = useToast();

    const loadOverview = async () => {
        setIsLoading(true);
        try {
            const [overviewResponse, inviteRows, memberRows, organizationRows] = await Promise.all([
                staffService.getOverview(300),
                staffService.getInvites({ limit: 400 }),
                staffService.getMembers({ limit: 400 }),
                organizationService.getAll(),
            ]);
            setStats(overviewResponse.stats ?? EMPTY_STATS);
            setStaff(overviewResponse.staff ?? []);
            setInvites(inviteRows ?? []);
            setMembers(memberRows ?? []);
            setOrganizations(organizationRows ?? []);
            if (!inviteForm.businessId && organizationRows.length > 0) {
                setInviteForm((prev) => ({ ...prev, businessId: organizationRows[0].id }));
            }
        } catch (error) {
            console.error("Failed to load staff overview", error);
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to load staff data."),
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredStaff = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return staff;
        return staff.filter((entry) => (
            entry.name.toLowerCase().includes(query)
            || entry.contact.toLowerCase().includes(query)
            || entry.role.toLowerCase().includes(query)
            || entry.organizationName.toLowerCase().includes(query)
            || entry.status.toLowerCase().includes(query)
        ));
    }, [searchQuery, staff]);

    const filteredInvites = useMemo(() => {
        const query = inviteSearch.trim().toLowerCase();
        if (!query) return invites;
        return invites.filter((entry) => (
            entry.phoneNumber.toLowerCase().includes(query)
            || entry.businessName.toLowerCase().includes(query)
            || (entry.ownerEmail?.toLowerCase().includes(query) ?? false)
            || entry.status.toLowerCase().includes(query)
        ));
    }, [inviteSearch, invites]);

    const filteredMembers = useMemo(() => {
        const query = memberSearch.trim().toLowerCase();
        if (!query) return members;
        return members.filter((entry) => (
            entry.userName.toLowerCase().includes(query)
            || (entry.userEmail?.toLowerCase().includes(query) ?? false)
            || entry.businessName.toLowerCase().includes(query)
            || entry.role.toLowerCase().includes(query)
        ));
    }, [memberSearch, members]);

    const runMutation = async (work: () => Promise<void>, successMessage: string) => {
        setIsMutating(true);
        try {
            await work();
            toast({ title: "Success", description: successMessage, type: "success" });
            await loadOverview();
        } catch (error) {
            toast({
                title: "Action failed",
                description: getErrorMessage(error, "Unable to complete staff action."),
                type: "error",
            });
        } finally {
            setIsMutating(false);
        }
    };

    const createInvite = async () => {
        if (!inviteForm.businessId || !inviteForm.phoneNumber.trim()) {
            toast({ title: "Missing data", description: "Business and phone number are required.", type: "error" });
            return;
        }
        await runMutation(async () => {
            await staffService.createInvite({
                businessId: inviteForm.businessId,
                phoneNumber: inviteForm.phoneNumber.trim(),
                role: inviteForm.role,
                expiresInDays: Number(inviteForm.expiresInDays || 7),
            });
            setInviteForm((prev) => ({ ...prev, phoneNumber: "", expiresInDays: "7" }));
        }, "Staff invite created.");
    };

    const removeInvite = async (invite: StaffInviteRow) => {
        if (!window.confirm(`Delete invite for ${invite.phoneNumber}?`)) return;
        await runMutation(async () => {
            await staffService.deleteInvite(invite.id);
        }, "Invite deleted.");
    };

    const updateMemberRole = async (member: StaffMemberRow, role: "OWNER" | "STAFF") => {
        await runMutation(async () => {
            await staffService.updateMember(member.id, { role });
        }, "Member role updated.");
    };

    const toggleMemberState = async (member: StaffMemberRow) => {
        await runMutation(async () => {
            await staffService.updateMember(member.id, { isActive: !member.isActive });
        }, member.isActive ? "Member deactivated." : "Member reactivated.");
    };

    const removeMember = async (member: StaffMemberRow) => {
        if (!window.confirm(`Deactivate ${member.userName} from ${member.businessName}?`)) return;
        await runMutation(async () => {
            await staffService.removeMember(member.id);
        }, "Member removed from active access.");
    };

    const columns = [
        { header: "Name", accessorKey: "name" },
        { header: "Email / Phone", accessorKey: "contact" },
        { header: "Role", accessorKey: "role" },
        { header: "Organization", accessorKey: "organizationName" },
        { header: "Status", accessorKey: "status" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Staff & Roles</h1>
                    <p className="text-muted-foreground text-lg">Manage personnel directory, invite lifecycle, and member access controls.</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => { void loadOverview(); }}>
                    <Filter className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total Personnel</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalPersonnel.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">System-wide</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Verified Admins</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.verifiedAdmins.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Pending Invites</CardTitle>
                        <MailPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingInvites.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting acceptance</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Revoked Access</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.revokedAccess.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Membership disabled</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold">Personnel Directory</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={filteredStaff}
                        isLoading={isLoading}
                        searchPlaceholder="Filter by name, contact, role, or organization..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold">Staff Invites</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-3 md:grid-cols-5">
                        <div className="md:col-span-2">
                            <label className="text-xs font-medium">Business</label>
                            <Select
                                value={inviteForm.businessId}
                                onChange={(event) => setInviteForm((prev) => ({ ...prev, businessId: event.target.value }))}
                            >
                                <option value="">Select business</option>
                                {organizations.map((organization) => (
                                    <option key={organization.id} value={organization.id}>
                                        {organization.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium">Phone</label>
                            <Input
                                value={inviteForm.phoneNumber}
                                onChange={(event) => setInviteForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                                placeholder="+91..."
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Role</label>
                            <Select
                                value={inviteForm.role}
                                onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value as "OWNER" | "STAFF" }))}
                            >
                                <option value="STAFF">STAFF</option>
                                <option value="OWNER">OWNER</option>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium">Expires (days)</label>
                            <Input
                                type="number"
                                value={inviteForm.expiresInDays}
                                onChange={(event) => setInviteForm((prev) => ({ ...prev, expiresInDays: event.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={() => { void createInvite(); }} isLoading={isMutating}>
                            <MailPlus className="h-4 w-4 mr-2" />
                            Create Invite
                        </Button>
                    </div>

                    <DataTable
                        columns={[
                            { header: "Phone", accessorKey: "phoneNumber" },
                            { header: "Business", accessorKey: "businessName" },
                            { header: "Role", accessorKey: "role" },
                            { header: "Status", accessorKey: "status" },
                            {
                                header: "Expires",
                                accessorKey: "expiresAt",
                                cell: (entry: StaffInviteRow) => new Date(entry.expiresAt).toLocaleDateString(),
                            },
                            {
                                header: "Actions",
                                accessorKey: "id",
                                cell: (entry: StaffInviteRow) => (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { void removeInvite(entry); }}
                                        disabled={isMutating}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
                                    </Button>
                                ),
                            },
                        ]}
                        data={filteredInvites}
                        isLoading={isLoading}
                        searchPlaceholder="Search invites by phone, business, owner, or status..."
                        searchValue={inviteSearch}
                        onSearchChange={setInviteSearch}
                    />
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card/50">
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-bold">Business Members</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <DataTable
                        columns={[
                            { header: "Member", accessorKey: "userName" },
                            {
                                header: "Contact",
                                accessorKey: "userEmail",
                                cell: (entry: StaffMemberRow) => entry.userEmail || entry.userPhone || "-",
                            },
                            { header: "Business", accessorKey: "businessName" },
                            {
                                header: "Role",
                                accessorKey: "role",
                                cell: (entry: StaffMemberRow) => (
                                    <Select
                                        value={entry.role}
                                        onChange={(event) => { void updateMemberRole(entry, event.target.value as "OWNER" | "STAFF"); }}
                                    >
                                        <option value="OWNER">OWNER</option>
                                        <option value="STAFF">STAFF</option>
                                    </Select>
                                ),
                            },
                            {
                                header: "Status",
                                accessorKey: "isActive",
                                cell: (entry: StaffMemberRow) => (
                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${entry.isActive ? "bg-green-500/15 text-green-700" : "bg-zinc-500/15 text-zinc-700"}`}>
                                        {entry.isActive ? "ACTIVE" : "INACTIVE"}
                                    </span>
                                ),
                            },
                            {
                                header: "Actions",
                                accessorKey: "id",
                                cell: (entry: StaffMemberRow) => (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => { void toggleMemberState(entry); }} disabled={isMutating}>
                                            <RefreshCw className="h-3 w-3 mr-1" />
                                            {entry.isActive ? "Disable" : "Enable"}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => { void removeMember(entry); }} disabled={isMutating}>
                                            <UserMinus className="h-3 w-3 mr-1" />
                                            Remove
                                        </Button>
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredMembers}
                        isLoading={isLoading}
                        searchPlaceholder="Search members by name, email, business, or role..."
                        searchValue={memberSearch}
                        onSearchChange={setMemberSearch}
                    />
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Staff actions are audited and synced with admin logs.
            </div>
        </div>
    );
}
