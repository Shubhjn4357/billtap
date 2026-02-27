"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { UserNav } from "@/components/layout/UserNav";
import { SidebarProvider } from "@/components/providers/SidebarProvider";
import RequireAuth from "@/components/auth/RequireAuth";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RequireAuth>
            <SidebarProvider>
                <div className="flex h-screen bg-background overflow-hidden relative">
                    <Sidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                        <header className="h-16 border-b bg-card/50 backdrop-blur-md flex items-center px-6 sticky top-0 z-30">
                            <UserNav />
                        </header>
                        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                            <div className="max-w-7xl mx-auto space-y-8">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );
}
