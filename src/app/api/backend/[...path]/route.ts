import { NextRequest, NextResponse } from "next/server";

const FORWARDED_REQUEST_HEADERS = [
    "authorization",
    "content-type",
    "accept",
    "x-organization-id",
    "x-requested-with",
] as const;

const FORWARDED_RESPONSE_HEADERS = [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
] as const;

const resolveBackendBase = () => {
    const configured = [process.env.BACKEND_API_URL, process.env.NEXT_PUBLIC_API_URL]
        .map((entry) => entry?.trim())
        .find((entry): entry is string => Boolean(entry));

    if (!configured) return null;
    return configured.replace(/\/+$/, "");
};

const buildTargetUrl = (request: NextRequest, pathSegments: string[]) => {
    const backendBase = resolveBackendBase();
    if (!backendBase) return null;

    const path = pathSegments.join("/");
    return `${backendBase}/${path}${request.nextUrl.search}`;
};

const forwardRequest = async (request: NextRequest, pathSegments: string[]) => {
    const targetUrl = buildTargetUrl(request, pathSegments);
    if (!targetUrl) {
        return NextResponse.json(
            {
                ok: false,
                message: "Backend API URL is not configured. Set BACKEND_API_URL or NEXT_PUBLIC_API_URL in admin env.",
            },
            { status: 500 }
        );
    }

    const outboundHeaders = new Headers();
    FORWARDED_REQUEST_HEADERS.forEach((headerName) => {
        const headerValue = request.headers.get(headerName);
        if (headerValue) {
            outboundHeaders.set(headerName, headerValue);
        }
    });

    const method = request.method.toUpperCase();
    const shouldSendBody = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    const rawBody = shouldSendBody ? await request.arrayBuffer() : undefined;
    const body = rawBody && rawBody.byteLength > 0 ? rawBody : undefined;

    try {
        const response = await fetch(targetUrl, {
            method,
            headers: outboundHeaders,
            body,
            cache: "no-store",
        });

        const responseHeaders = new Headers();
        FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
            const headerValue = response.headers.get(headerName);
            if (headerValue) {
                responseHeaders.set(headerName, headerValue);
            }
        });

        const responseBody = await response.arrayBuffer();
        return new NextResponse(responseBody, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                message: error instanceof Error ? error.message : "Backend proxy request failed.",
            },
            { status: 502 }
        );
    }
};

type RouteContext = {
    params: {
        path?: string[];
    } | Promise<{
        path?: string[];
    }>;
};

const handler = async (request: NextRequest, context: RouteContext) => {
    const params = await Promise.resolve(context.params);
    const pathSegments = params.path ?? [];
    return forwardRequest(request, pathSegments);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
