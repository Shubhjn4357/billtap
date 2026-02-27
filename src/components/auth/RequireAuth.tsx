"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (status === "loading") return;

        if (!session) {
            router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
        }
    }, [session, status, router, pathname]);

    if (status === "loading") {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!session) {
        return null;
    }

    return <>{children}</>;
}
