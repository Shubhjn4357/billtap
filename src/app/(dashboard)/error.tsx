"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Dashboard caught error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    {error.message || "An unexpected error occurred while loading this page."}
                </p>
            </div>
            <div className="pt-4">
                <Button onClick={() => reset()} className="shadow-lg shadow-primary/20">
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </div>
        </div>
    );
}
