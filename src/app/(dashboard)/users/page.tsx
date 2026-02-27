"use client";

import { useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { Button } from "@/components/ui/Button";
import { UserActionDialog } from "@/components/users/UserActionDialog";
import { User } from "@/types";
import { Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

export default function UsersPage() {
    const { data: users, isLoading } = useUsers(100);
    const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredUsers = users?.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleManage = (user: User) => {
        setSelectedUser(user);
    };

    if (isLoading) return <div className="p-8">Loading users...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground">Manage users, roles, and subscriptions.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="rounded-md border bg-card">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">User</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Subscription</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {filteredUsers?.map((user) => (
                                <tr key={user.uid} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.displayName || "Unknown"}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                            {user.businessName && <span className="text-xs text-muted-foreground italic">{user.businessName}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="flex items-center gap-1">
                                            <Shield className="w-3 h-3 text-muted-foreground" />
                                            <span className="capitalize">{user.role}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.subscriptionPlanName || "Free Plan"}</span>
                                            {user.subscriptionEndsAt && (
                                                <span className="text-xs text-muted-foreground">
                                                    Ends: {new Date(user.subscriptionEndsAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                        ${user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                                                user.subscriptionStatus === 'past_due' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}
                    `}>
                                            {user.subscriptionStatus}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleManage(user)}>
                                            Manage
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <UserActionDialog
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(undefined)}
                user={selectedUser}
            />
        </div>
    );
}
