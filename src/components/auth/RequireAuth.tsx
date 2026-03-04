"use client";

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isRouteAllowedForRole, normalizeAdminRole } from '@/lib/rbac';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const isAdmin = Boolean((session as { isAdmin?: boolean } | null)?.isAdmin);
    const backendJwt = (session as { backendJwt?: string } | null)?.backendJwt;
    const role = normalizeAdminRole(session as { adminRole?: string | null } | null);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
            return;
        }

        if (!isAdmin) {
            router.replace('/auth/signin?error=not_admin');
            return;
        }

        if (!backendJwt) {
            router.replace('/auth/signin?error=backend_auth');
            return;
        }

        if (!isRouteAllowedForRole(role, pathname)) {
            router.replace('/dashboard?error=forbidden');
        }
    }, [session, status, isAdmin, backendJwt, role, router, pathname]);

    if (status === 'loading') {
        return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Validating session...</div>;
    }

    if (!session || !isAdmin || !backendJwt) {
        return null;
    }

    return <>{children}</>;
}
