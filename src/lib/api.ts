import axios from "axios";
import { getSession } from "next-auth/react";
import { ApiClientError, toApiClientError } from "@/lib/api-error";

const resolveBaseUrl = () => {
    if (typeof window !== "undefined") {
        return "/api/backend";
    }

    const internal = process.env.ADMIN_INTERNAL_API_URL?.trim();
    if (internal) return internal.replace(/\/$/, "");

    const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
    if (nextAuthUrl) {
        return `${nextAuthUrl.replace(/\/$/, "")}/api/backend`;
    }

    return "http://localhost:3000/api/backend";
};

const baseURL = resolveBaseUrl();

export const api = axios.create({
    baseURL,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(async (config) => {
    const session = await getSession() as { backendJwt?: string } | null;
    if (session?.backendJwt) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${session.backendJwt}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        const payload = response.data as { ok?: boolean; message?: string; details?: unknown } | undefined;
        if (payload && payload.ok === false) {
            throw new ApiClientError(payload.message || "Request failed.", {
                status: response.status,
                details: payload.details,
            });
        }
        return response;
    },
    (error) => Promise.reject(toApiClientError(error))
);

export const fetcher = (url: string) => api.get(url).then((res) => res.data);
