import axios from "axios";
import { getSession } from "next-auth/react";

const resolveBaseUrl = () => {
    const configured = (process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || "").trim();
    if (configured) {
        return configured.replace(/\/$/, "");
    }
    return "http://localhost:8787/api";
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
        config.headers.Authorization = `Bearer ${session.backendJwt}`;
    }
    return config;
});

export const fetcher = (url: string) => api.get(url).then((res) => res.data);
