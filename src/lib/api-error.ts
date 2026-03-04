import axios from "axios";

type ErrorPayload = {
    message?: string;
    code?: string;
    details?: unknown;
    error?: string;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const getMessageFromPayload = (value: unknown): string | null => {
    const payload = asObject(value) as ErrorPayload | null;
    if (!payload) return null;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
    return null;
};

const messageByStatus = (status?: number) => {
    if (status === 401) return "Unauthorized. Please sign in again.";
    if (status === 403) return "Access denied for this admin role.";
    if (status === 404) return "Requested admin API route was not found.";
    if (status === 429) return "Too many requests. Please retry in a moment.";
    if (status && status >= 500) return "Server error while processing admin request.";
    return "Request failed.";
};

export class ApiClientError extends Error {
    status?: number;
    code?: string;
    details?: unknown;

    constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
        super(message);
        this.name = "ApiClientError";
        this.status = options?.status;
        this.code = options?.code;
        this.details = options?.details;
    }
}

export const toApiClientError = (error: unknown, fallback = "Request failed."): ApiClientError => {
    if (error instanceof ApiClientError) return error;

    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const payloadMessage = getMessageFromPayload(error.response?.data);
        const message = payloadMessage
            || error.message
            || (!error.response
                ? "Unable to reach admin API. Check BACKEND_API_URL / NEXT_PUBLIC_API_URL and network."
                : messageByStatus(status))
            || fallback;

        return new ApiClientError(message, {
            status,
            code: error.code,
            details: error.response?.data,
        });
    }

    if (error instanceof Error) {
        return new ApiClientError(error.message || fallback);
    }

    return new ApiClientError(fallback);
};

export const getErrorMessage = (error: unknown, fallback = "Request failed.") =>
    toApiClientError(error, fallback).message;

