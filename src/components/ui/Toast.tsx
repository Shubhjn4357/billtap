"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    title: string;
    description?: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (props: Omit<Toast, "id">) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const toast = React.useCallback(({ title, description, type }: Omit<Toast, "id">) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, title, description, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
                <AnimatePresence mode="popLayout">
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            layout
                            initial={{ opacity: 0, y: 50, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            className={cn(
                                "flex items-start gap-3 p-4 rounded-xl border bg-card shadow-lg",
                                {
                                    "border-green-500/20 bg-green-50 dark:bg-green-950/20": t.type === "success",
                                    "border-red-500/20 bg-red-50 dark:bg-red-950/20": t.type === "error",
                                    "border-blue-500/20 bg-blue-50 dark:bg-blue-950/20": t.type === "info",
                                }
                            )}
                        >
                            <div className="shrink-0 mt-0.5">
                                {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                                {t.type === "error" && <AlertCircle className="h-5 w-5 text-red-600" />}
                                {t.type === "info" && <Info className="h-5 w-5 text-blue-600" />}
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-sm font-semibold leading-none">{t.title}</h3>
                                {t.description && (
                                    <p className="text-sm text-muted-foreground">{t.description}</p>
                                )}
                            </div>
                            <button
                                onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
                                className="shrink-0 p-1 hover:bg-muted rounded-md transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
