"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import {
    Bell,
    Search,
    LogOut,
    User,
    Menu as MenuIcon
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSidebar } from "@/components/providers/SidebarProvider";

import { ThemeToggle } from "./ThemeToggle";

export function UserNav() {
    const { data: session } = useSession();
    const { toggleMobile } = useSidebar();
    const adminRole = (session as { adminRole?: string } | null)?.adminRole ?? "SUPER_ADMIN";

    return (
        <div className="flex items-center justify-between w-full h-full lg:justify-end">
            {/* Mobile Menu Toggle */}
            <button
                onClick={toggleMobile}
                className="p-2 rounded-lg hover:bg-muted lg:hidden"
            >
                <MenuIcon className="h-6 w-6" />
            </button>

            <div className="flex items-center gap-2 lg:gap-4">
                {/* Global Search - Visual only for now */}
                <div className="hidden md:flex items-center relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        placeholder="Search everything..."
                        className="pl-9 pr-4 py-2 bg-muted/50 border-none rounded-xl text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                </div>

                <div className="flex items-center gap-1 lg:gap-2 border-l pl-2 lg:pl-4 ml-2">
                    <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-background" />
                    </Button>
                    
                    <ThemeToggle />

                    <div className="flex items-center gap-2 px-1 py-1 rounded-full hover:bg-muted cursor-pointer transition-colors group">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <User className="h-5 w-5" />
                        </div>
                        <div className="hidden sm:block text-left mr-1">
                            <p className="text-xs font-semibold truncate max-w-[120px]">
                                {session?.user?.name || "Admin User"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                                {adminRole}
                            </p>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
