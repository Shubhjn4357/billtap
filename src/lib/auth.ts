import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// The backend API base URL — used to exchange Google ID token for a backend JWT.
const API_BASE_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787/api";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async jwt({ token, user, account }) {
            // On initial sign-in, exchange the Google ID token for a backend JWT
            if (account?.provider === "google" && account?.id_token) {
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/google`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ idToken: account.id_token }),
                    });
                    const data = await res.json() as { ok?: boolean; token?: string; user?: Record<string, unknown> };
                    if (data.ok && data.token) {
                        token.backendJwt = data.token;
                        token.backendUser = data.user;
                    }
                } catch {
                    // Silent: backend exchange failed, token won't have backendJwt
                }
            }
            return token;
        },
        async session({ session, token }) {
            // Forward the backend JWT to the session so client components can use it
            return {
                ...session,
                backendJwt: token.backendJwt as string | undefined,
                backendUser: token.backendUser as Record<string, unknown> | undefined,
            };
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
    session: {
        strategy: "jwt",
    },
};
