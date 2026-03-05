export type ApiErrorPayload = {
    code: string;
    message: string;
    details?: unknown;
};

export class AppError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;

    constructor(code: string, message: string, status = 400, details?: unknown) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export const isAppError = (value: unknown): value is AppError =>
    value instanceof AppError;

export const toApiErrorPayload = (
    error: unknown,
    fallback: { code: string; message: string; status: number }
): { status: number; error: ApiErrorPayload } => {
    if (isAppError(error)) {
        return {
            status: error.status,
            error: {
                code: error.code,
                message: error.message,
                ...(error.details !== undefined ? { details: error.details } : {}),
            },
        };
    }

    const message = error instanceof Error ? error.message : fallback.message;
    return {
        status: fallback.status,
        error: {
            code: fallback.code,
            message: message || fallback.message,
        },
    };
};
