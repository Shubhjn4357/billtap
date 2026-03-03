"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    CreditCard,
    LayoutDashboard,
    ChevronLeft,
    X,
    Store,
    Box,
    FileSpreadsheet,
    Megaphone,
    BarChart3,
    History,
    Settings,
    UserCircle,
    Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/providers/SidebarProvider";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
}

interface NavCategory {
    label: string;
    items: NavItem[];
}

const navCategories: NavCategory[] = [
    {
        label: "Core",
        items: [
            { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
            { href: "/organizations", label: "Organizations", icon: Store },
            { href: "/users", label: "Users", icon: Users },
            { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
        ]
    },
    {
        label: "Operations",
        items: [
            { href: "/transactions", label: "Transactions", icon: FileSpreadsheet },
            { href: "/inventory", label: "Inventory", icon: Box },
            { href: "/banners", label: "Offers", icon: Megaphone },
            { href: "/discounts", label: "Discounts", icon: CreditCard },
        ]
    },
    {
        label: "System",
        items: [
            { href: "/analytics", label: "Analytics", icon: BarChart3 },
            { href: "/audit-logs", label: "Audit Logs", icon: History },
            { href: "/templates", label: "Templates", icon: FileSpreadsheet },
            { href: "/feature-flags", label: "Feature Flags", icon: Flag },
            { href: "/settings", label: "Settings", icon: Settings },
        ]
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const { isCollapsed, toggleCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

    const SidebarContent = (
        <div className="flex flex-col h-full bg-card border-r shadow-sm">
            {/* Header */}
            <div className={cn(
                "flex items-center h-16 px-6 border-b shrink-0 transition-all duration-300",
                isCollapsed ? "justify-center px-2" : "justify-between"
            )}>
                {!isCollapsed && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xl font-bold text-primary truncate"
                    >
                        Vahi Admin
                    </motion.span>
                )}
                <button
                    onClick={toggleCollapsed}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors hidden lg:flex"
                >
                    <ChevronLeft className={cn("h-5 w-5 transition-transform duration-300", isCollapsed && "rotate-180")} />
                </button>
                <button
                    onClick={() => setMobileOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors lg:hidden"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 custom-scrollbar">
                {navCategories.map((category) => (
                    <div key={category.label} className="space-y-2">
                        {!isCollapsed && (
                            <h3 className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-all">
                                {category.label}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {category.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group relative",
                                            isActive
                                                ? "bg-primary/10 text-primary shadow-sm"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                            isCollapsed && "justify-center px-2"
                                        )}
                                    >
                                        <Icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-primary" : "text-muted-foreground")} />
                                        {!isCollapsed && <span>{item.label}</span>}
                                        {isCollapsed && (
                                            <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md border">
                                                {item.label}
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className={cn(
                "p-4 border-t shrink-0 transition-all",
                isCollapsed ? "items-center" : ""
            )}>
                <div className={cn(
                    "flex items-center gap-3 p-2 rounded-xl bg-muted/50 transition-all",
                    isCollapsed ? "justify-center" : ""
                )}>
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                        <UserCircle className="h-6 w-6" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate leading-none">Admin User</p>
                            <p className="text-[11px] text-muted-foreground truncate uppercase mt-1">Super Admin</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className={cn(
                "hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-300 z-40",
                isCollapsed ? "w-20" : "w-64"
            )}>
                {SidebarContent}
            </aside>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden"
                        >
                            {SidebarContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
