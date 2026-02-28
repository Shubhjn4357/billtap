"use client";

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const isAdmin = Boolean((session as { isAdmin?: boolean } | null)?.isAdmin);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
            return;
        }

        if (!isAdmin) {
            router.replace('/auth/signin?error=not_admin');
        }
    }, [session, status, isAdmin, router, pathname]);

    if (status === 'loading') {
        return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Validating session...</div>;
    }

    if (!session || !isAdmin) {
        return null;
    }

    return <>{children}</>;
}
