"use client";

import { useEffect, useState } from "react";
import { type LucideIcon, UsersRound, ShieldCheck, UserMinus, MailPlus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/api-error";

type StaffEntry = {
    id: string;
    name: string;
    contact: string;
    role: string;
    organizationName: string;
    status: string;
};

type StaffOverview = {
    totalPersonnel: number;
    verifiedAdmins: number;
    pendingInvites: number;
    revokedAccess: number;
};

export default function PayrollPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<StaffOverview | null>(null);
    const [staff, setStaff] = useState<StaffEntry[]>([]);

    const load = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get<{ ok: boolean; stats: StaffOverview; staff: StaffEntry[] }>("/admin/staff/overview");
            setStats(data.stats);
            setStaff(data.staff);
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

    const columns = [
        { header: "Name", accessorKey: "name" },
        { header: "Contact", accessorKey: "contact" },
        { header: "Role", accessorKey: "role" },
        { header: "Organization", accessorKey: "organizationName" },
        { header: "Status", accessorKey: "status" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payroll and Personnel</h1>
                    <p className="text-muted-foreground">Personnel overview with access lifecycle and admin verification.</p>
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
                    <CardTitle>Personnel Directory</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={staff} isLoading={isLoading} searchPlaceholder="Search personnel..." />
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
