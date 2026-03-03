import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const API_BASE_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

const parseAdmins = (raw?: string): string[] => {
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
        }
    } catch {
        // fall back to comma-separated
    }

    return raw.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
};

const SUPER_ADMIN_EMAILS = new Set([
    ...parseAdmins(process.env.ADMINS),
    ...parseAdmins(process.env.DEVELOPER_ADMIN_EMAILS),
]);
const SUPPORT_ADMIN_EMAILS = new Set(parseAdmins(process.env.SUPPORT_ADMINS));
const READ_ONLY_ADMIN_EMAILS = new Set(parseAdmins(process.env.READ_ONLY_ADMINS));

const resolveAdminRole = (email: string): 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY_ADMIN' | null => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    if (SUPER_ADMIN_EMAILS.has(normalized)) return 'SUPER_ADMIN';
    if (SUPPORT_ADMIN_EMAILS.has(normalized)) return 'SUPPORT_ADMIN';
    if (READ_ONLY_ADMIN_EMAILS.has(normalized)) return 'READ_ONLY_ADMIN';
    return null;
};

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, profile }) {
            const emailFromProvider = (profile?.email || user?.email || token.email || '').toString().toLowerCase();
            const adminRole = resolveAdminRole(emailFromProvider);
           
            const isSuperAdmin = adminRole === 'SUPER_ADMIN';
            const isAdmin = Boolean(adminRole);

            (token as Record<string, unknown>).isSuperAdmin = isSuperAdmin;
            (token as Record<string, unknown>).isAdmin = isAdmin;
            (token as Record<string, unknown>).adminRole = adminRole;

            if (account?.provider === 'google' && account?.id_token) {
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/google`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: account.id_token }),
                    });
                    const data = await res.json() as { ok?: boolean; token?: string; user?: Record<string, unknown> };
                    if (data.ok && data.token) {
                        (token as Record<string, unknown>).backendJwt = data.token;
                        (token as Record<string, unknown>).backendUser = data.user;
                    }
                } catch {
                    // Keep NextAuth session even if backend exchange fails.
                }
            }

            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                backendJwt: (token as Record<string, unknown>).backendJwt as string | undefined,
                backendUser: (token as Record<string, unknown>).backendUser as Record<string, unknown> | undefined,
                isSuperAdmin: (token as Record<string, unknown>).isSuperAdmin as boolean | undefined,
                isAdmin: (token as Record<string, unknown>).isAdmin as boolean | undefined,
                adminRole: (token as Record<string, unknown>).adminRole as string | null | undefined,
            };
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
    session: {
        strategy: 'jwt',
    },
};
