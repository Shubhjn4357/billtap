"use client";

import { useEffect, useMemo, useState } from "react";
import { type LucideIcon, UsersRound, ShieldCheck, UserMinus, MailPlus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";
import { organizationService, type Organization } from "@/services/organizationService";
import { staffService, type StaffMemberRow, type StaffOverviewStats } from "@/services/staffService";

export default function PayrollPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [stats, setStats] = useState<StaffOverviewStats | null>(null);
    const [members, setMembers] = useState<StaffMemberRow[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [inviteForm, setInviteForm] = useState({
        businessId: "",
        phoneNumber: "",
        role: "STAFF" as "OWNER" | "STAFF",
    });

    const load = async () => {
        setIsLoading(true);
        try {
            const [overview, memberRows, organizationRows] = await Promise.all([
                staffService.getOverview(300),
                staffService.getMembers({ limit: 400 }),
                organizationService.getAll(),
            ]);
            setStats(overview.stats);
            setMembers(memberRows);
            setOrganizations(organizationRows);
            if (!inviteForm.businessId && organizationRows.length > 0) {
                setInviteForm((prev) => ({ ...prev, businessId: organizationRows[0].id }));
            }
        } catch (error) {
            toast({
                title: "Load failed",
                description: getErrorMessage(error, "Unable to load payroll overview."),
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

    const runMutation = async (work: () => Promise<void>, successMessage: string) => {
        setIsMutating(true);
        try {
            await work();
            toast({ title: "Success", description: successMessage, type: "success" });
            await load();
        } catch (error) {
            toast({
                title: "Action failed",
                description: getErrorMessage(error, "Unable to complete payroll action."),
                type: "error",
            });
        } finally {
            setIsMutating(false);
        }
    };

    const filteredMembers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return members;
        return members.filter((entry) => (
            entry.userName.toLowerCase().includes(query)
            || (entry.userEmail?.toLowerCase().includes(query) ?? false)
            || entry.businessName.toLowerCase().includes(query)
            || entry.role.toLowerCase().includes(query)
        ));
    }, [members, searchQuery]);

    const columns = [
        { header: "Name", accessorKey: "userName" },
        {
            header: "Contact",
            accessorKey: "userEmail",
            cell: (entry: StaffMemberRow) => entry.userEmail || entry.userPhone || "-",
        },
        { header: "Organization", accessorKey: "businessName" },
        {
            header: "Role",
            accessorKey: "role",
            cell: (entry: StaffMemberRow) => (
                <Select
                    value={entry.role}
                    onChange={(event) => {
                        const role = event.target.value as "OWNER" | "STAFF";
                        void runMutation(async () => {
                            await staffService.updateMember(entry.id, { role });
                        }, "Role updated.");
                    }}
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
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${entry.isActive ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-800"}`}>
                    {entry.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
            ),
        },
        {
            header: "Actions",
            accessorKey: "id",
            cell: (entry: StaffMemberRow) => (
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                        void runMutation(async () => {
                            await staffService.updateMember(entry.id, { isActive: !entry.isActive });
                        }, entry.isActive ? "Member deactivated." : "Member activated.");
                    }} disabled={isMutating}>
                        {entry.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                        if (!window.confirm(`Deactivate ${entry.userName}?`)) return;
                        void runMutation(async () => {
                            await staffService.removeMember(entry.id);
                        }, "Member removed.");
                    }} disabled={isMutating}>
                        <UserMinus className="h-3 w-3 mr-1" />
                        Remove
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payroll and Personnel</h1>
                    <p className="text-muted-foreground">Manage personnel lifecycle and invite operations for payroll governance.</p>
                </div>
                <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Total Personnel" value={stats?.totalPersonnel ?? 0} icon={UsersRound} />
                <MetricCard title="Verified Admins" value={stats?.verifiedAdmins ?? 0} icon={ShieldCheck} />
                <MetricCard title="Pending Invites" value={stats?.pendingInvites ?? 0} icon={MailPlus} />
                <MetricCard title="Revoked Access" value={stats?.revokedAccess ?? 0} icon={UserMinus} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Create Invite</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-4">
                        <div>
                            <label className="text-xs font-medium">Business</label>
                            <Select value={inviteForm.businessId} onChange={(event) => setInviteForm((prev) => ({ ...prev, businessId: event.target.value }))}>
                                <option value="">Select business</option>
                                {organizations.map((organization) => (
                                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium">Phone</label>
                            <Input value={inviteForm.phoneNumber} onChange={(event) => setInviteForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} placeholder="+91..." />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Role</label>
                            <Select value={inviteForm.role} onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value as "OWNER" | "STAFF" }))}>
                                <option value="STAFF">STAFF</option>
                                <option value="OWNER">OWNER</option>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={() => {
                                if (!inviteForm.businessId || !inviteForm.phoneNumber.trim()) {
                                    toast({ title: "Missing data", description: "Business and phone are required.", type: "error" });
                                    return;
                                }
                                void runMutation(async () => {
                                    await staffService.createInvite({
                                        businessId: inviteForm.businessId,
                                        phoneNumber: inviteForm.phoneNumber.trim(),
                                        role: inviteForm.role,
                                        expiresInDays: 7,
                                    });
                                    setInviteForm((prev) => ({ ...prev, phoneNumber: "" }));
                                }, "Invite created.");
                            }} isLoading={isMutating}>
                                <MailPlus className="h-4 w-4 mr-2" />
                                Invite
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Personnel Directory</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={filteredMembers}
                        isLoading={isLoading}
                        searchPlaceholder="Search personnel..."
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function MetricCard({
    title,
    value,
    icon: Icon,
}: {
    title: string;
    value: number;
    icon: LucideIcon;
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    {title}
                    <Icon className="h-4 w-4 text-primary" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-bold">{value.toLocaleString()}</p>
            </CardContent>
        </Card>
    );
}
