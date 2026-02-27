"use client";

import React, { createContext, useContext, useState } from "react";

interface SidebarContextType {
    isCollapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    isMobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
    toggleCollapsed: () => void;
    toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setCollapsed] = useState(false);
    const [isMobileOpen, setMobileOpen] = useState(false);

    // Close mobile sidebar on route change (logic usually in sidebar component but good to have state here)
    const toggleCollapsed = () => setCollapsed(!isCollapsed);
    const toggleMobile = () => setMobileOpen(!isMobileOpen);

    return (
        <SidebarContext.Provider
            value={{
                isCollapsed,
                setCollapsed,
                isMobileOpen,
                setMobileOpen,
                toggleCollapsed,
                toggleMobile,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
