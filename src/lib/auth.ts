import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const resolveApiBaseUrl = () => {
    const configured = [process.env.BACKEND_API_URL, process.env.NEXT_PUBLIC_API_URL]
        .map((entry) => entry?.trim())
        .find((entry): entry is string => Boolean(entry));

    if (!configured) return null;
    return configured.replace(/\/+$/, '');
};

const API_BASE_URL = resolveApiBaseUrl();

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
            const tokenRecord = token as Record<string, unknown>;

            const isSuperAdmin = adminRole === 'SUPER_ADMIN';
            const isAdmin = Boolean(adminRole);

            tokenRecord.isSuperAdmin = isSuperAdmin;
            tokenRecord.isAdmin = isAdmin;
            tokenRecord.adminRole = adminRole;

            if (account?.provider === 'google' && account?.id_token) {
                if (!API_BASE_URL) {
                    tokenRecord.backendAuthError = 'BACKEND_API_URL or NEXT_PUBLIC_API_URL is not configured for admin OAuth exchange.';
                    tokenRecord.backendJwt = undefined;
                    tokenRecord.backendUser = undefined;
                    return token;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/auth/google`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: account.id_token }),
                    });
                    const data = await res.json() as { ok?: boolean; token?: string; user?: Record<string, unknown>; message?: string };
                    if (!res.ok || !data.ok || !data.token) {
                        tokenRecord.backendAuthError = data.message || `Backend auth exchange failed (${res.status}).`;
                        tokenRecord.backendJwt = undefined;
                        tokenRecord.backendUser = undefined;
                    } else {
                        tokenRecord.backendJwt = data.token;
                        tokenRecord.backendUser = data.user;
                        tokenRecord.backendAuthError = null;
                    }
                } catch (error) {
                    tokenRecord.backendAuthError = error instanceof Error ? error.message : 'Backend auth exchange failed.';
                    tokenRecord.backendJwt = undefined;
                    tokenRecord.backendUser = undefined;
                }
            }

            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                backendJwt: (token as Record<string, unknown>).backendJwt as string | undefined,
                backendUser: (token as Record<string, unknown>).backendUser as Record<string, unknown> | undefined,
                backendAuthError: (token as Record<string, unknown>).backendAuthError as string | null | undefined,
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
