import { Hono } from 'hono';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { mediaAssets, users } from '../db/schema';
import { requireAuth, type AppContext, type AppEnv } from '../middleware/auth';

const mediaRoute = new Hono<AppEnv>();

const uploadAssetTypeSchema = z.enum([
    'PRODUCT_IMAGE',
    'PROFILE_IMAGE',
    'BILL_ATTACHMENT',
    'SIGNATURE',
    'OTHER',
]);

type UploadAssetType = z.infer<typeof uploadAssetTypeSchema>;

const uploadRequestSchema = z.object({
    fileName: z.string().min(1).max(160),
    fileType: z.string().min(3).max(120),
    assetType: uploadAssetTypeSchema.default('OTHER'),
    entityType: z.string().max(80).optional(),
    entityId: z.string().max(120).optional(),
});

type UploadTokenPayload = {
    key: string;
    ownerUserId: string;
    organizationId: string;
    assetType: UploadAssetType;
    entityType: string | null;
    entityId: string | null;
    mimeType: string;
    expiresAt: number;
    maxUploadBytes: number;
};

const DEFAULT_TOKEN_TTL_SECONDS = 120;
const DEFAULT_MAX_UPLOAD_MB = 10;

const normalizeFileName = (value: string): string => value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80) || 'upload.bin';

const inferExtensionFromMime = (mimeType: string): string => {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'image/png') return 'png';
    if (normalized === 'image/jpeg') return 'jpg';
    if (normalized === 'image/webp') return 'webp';
    if (normalized === 'image/svg+xml') return 'svg';
    if (normalized === 'application/pdf') return 'pdf';
    return 'bin';
};

const buildObjectKey = (
    ownerUserId: string,
    organizationId: string,
    fileName: string,
    mimeType: string
) => {
    const sanitizedFileName = normalizeFileName(fileName);
    const hasExtension = /\.[a-zA-Z0-9]{2,8}$/.test(sanitizedFileName);
    const extension = hasExtension ? '' : `.${inferExtensionFromMime(mimeType)}`;
    return [
        'uploads',
        ownerUserId,
        organizationId,
        `${Date.now()}_${nanoid(6)}_${sanitizedFileName}${extension}`,
    ].join('/');
};

const resolveUploadSecret = (c: AppContext): string | null =>
    c.env.MEDIA_UPLOAD_SECRET || c.env.API_JWT_SECRET || null;

const encodeTokenPayload = (payload: UploadTokenPayload): string => {
    const json = JSON.stringify(payload);
    return Buffer.from(json, 'utf8').toString('base64url');
};

const decodeTokenPayload = (value: string): UploadTokenPayload | null => {
    try {
        const json = Buffer.from(value, 'base64url').toString('utf8');
        return JSON.parse(json) as UploadTokenPayload;
    } catch {
        return null;
    }
};

const signValue = async (value: string, secret: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
    return Buffer.from(signature).toString('base64url');
};

const createSignedToken = async (payload: UploadTokenPayload, secret: string): Promise<string> => {
    const encoded = encodeTokenPayload(payload);
    const signature = await signValue(encoded, secret);
    return `${encoded}.${signature}`;
};

const verifySignedToken = async (token: string, secret: string): Promise<UploadTokenPayload | null> => {
    const [encoded, signature] = token.split('.', 2);
    if (!encoded || !signature) return null;

    const expectedSignature = await signValue(encoded, secret);
    if (signature !== expectedSignature) return null;

    const payload = decodeTokenPayload(encoded);
    if (!payload) return null;
    if (!payload.key || !payload.ownerUserId || !payload.organizationId || !payload.mimeType || !payload.assetType) {
        return null;
    }
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= 0) return null;
    if (!Number.isFinite(payload.maxUploadBytes) || payload.maxUploadBytes <= 0) return null;
    return payload;
};

const buildUploadUrl = (requestUrl: string, token: string): string => {
    const url = new URL(requestUrl);
    const hasApiPrefix = url.pathname.startsWith('/api/');
    const prefix = hasApiPrefix ? '/api' : '';
    return `${url.origin}${prefix}/media/upload?token=${encodeURIComponent(token)}`;
};

const joinPublicUrl = (baseUrl: string, key: string): string => {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${normalizedBase}/${key}`;
};

const buildFileUrl = (c: AppContext, key: string): string => {
    if (c.env.MEDIA_PUBLIC_BASE_URL) {
        return joinPublicUrl(c.env.MEDIA_PUBLIC_BASE_URL, key);
    }

    const currentUrl = new URL(c.req.url);
    const hasApiPrefix = currentUrl.pathname.startsWith('/api/');
    const prefix = hasApiPrefix ? '/api' : '';
    return `${currentUrl.origin}${prefix}/media/files/${key}`;
};

const parseMaxUploadBytes = (raw?: string): number => {
    const parsed = Number(raw);
    const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_MB;
    return Math.floor(mb * 1024 * 1024);
};

const getMediaScope = (c: AppContext): { ownerUserId: string; organizationId: string } | null => {
    const ownerUserId = c.get('effectiveOwnerUserId');
    const organizationId = c.get('effectiveOrganizationId');
    if (!ownerUserId || !organizationId) return null;
    return { ownerUserId, organizationId };
};

const buildOptionalOrgScopeCondition = (
    organizationColumn: any,
    organizationId: string,
    ownerUserId: string
) => {
    if (organizationId === ownerUserId) {
        return or(eq(organizationColumn, organizationId), isNull(organizationColumn));
    }
    return eq(organizationColumn, organizationId);
};

mediaRoute.post('/upload-url', requireAuth, async (c) => {
    try {
        const scope = getMediaScope(c);
        if (!scope) {
            return c.json({ ok: false, message: 'Organization context missing.' }, 400);
        }

        const secret = resolveUploadSecret(c);
        if (!secret) {
            return c.json({ ok: false, message: 'MEDIA_UPLOAD_SECRET is not configured.' }, 500);
        }

        const payload = uploadRequestSchema.parse(await c.req.json());
        const key = buildObjectKey(scope.ownerUserId, scope.organizationId, payload.fileName, payload.fileType);
        const ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS;
        const expiresAt = Date.now() + ttlSeconds * 1000;

        const db = c.get('db');
        await db
            .select({
                subscriptionStatus: users.subscriptionStatus,
                subscriptionPlanId: users.subscriptionPlanId,
                subscriptionPlanName: users.subscriptionPlanName,
            })
            .from(users)
            .where(eq(users.uid, scope.ownerUserId))
            .limit(1);

        const maxUploadBytes = parseMaxUploadBytes(c.env.MEDIA_MAX_UPLOAD_MB);

        const tokenPayload: UploadTokenPayload = {
            key,
            ownerUserId: scope.ownerUserId,
            organizationId: scope.organizationId,
            assetType: payload.assetType,
            entityType: payload.entityType ?? null,
            entityId: payload.entityId ?? null,
            mimeType: payload.fileType,
            expiresAt,
            maxUploadBytes,
        };
        const token = await createSignedToken(tokenPayload, secret);

        return c.json({
            ok: true,
            uploadUrl: buildUploadUrl(c.req.url, token),
            fileUrl: buildFileUrl(c, key),
            key,
            expiresAt,
            maxUploadBytes,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create upload URL.' }, 400);
    }
});

mediaRoute.put('/upload', async (c) => {
    try {
        const token = c.req.query('token');
        if (!token) return c.json({ ok: false, message: 'Upload token is required.' }, 400);

        const secret = resolveUploadSecret(c);
        if (!secret) {
            return c.json({ ok: false, message: 'MEDIA_UPLOAD_SECRET is not configured.' }, 500);
        }

        const tokenPayload = await verifySignedToken(token, secret);
        if (!tokenPayload) return c.json({ ok: false, message: 'Invalid upload token.' }, 401);
        if (Date.now() > tokenPayload.expiresAt) {
            return c.json({ ok: false, message: 'Upload token has expired.' }, 401);
        }

        const bucket = c.env.MEDIA_BUCKET;
        if (!bucket) {
            return c.json({ ok: false, message: 'MEDIA_BUCKET binding is not configured.' }, 500);
        }

        const envMaxUploadBytes = parseMaxUploadBytes(c.env.MEDIA_MAX_UPLOAD_MB);
        const maxUploadBytes = Math.min(envMaxUploadBytes, tokenPayload.maxUploadBytes);
        const body = await c.req.arrayBuffer();
        if (body.byteLength === 0) {
            return c.json({ ok: false, message: 'Upload body is empty.' }, 400);
        }
        if (body.byteLength > maxUploadBytes) {
            return c.json({ ok: false, message: `File exceeds maximum size of ${maxUploadBytes} bytes.` }, 413);
        }

        const alreadyExists = await bucket.head(tokenPayload.key);
        if (alreadyExists) {
            return c.json({ ok: false, message: 'Upload token already used.' }, 409);
        }

        await bucket.put(tokenPayload.key, body, {
            httpMetadata: {
                contentType: tokenPayload.mimeType,
            },
            customMetadata: {
                ownerUserId: tokenPayload.ownerUserId,
                organizationId: tokenPayload.organizationId,
                assetType: tokenPayload.assetType,
            },
        });

        const now = new Date();
        const assetId = nanoid();
        const fileUrl = buildFileUrl(c, tokenPayload.key);
        const db = c.get('db');
        await db.insert(mediaAssets).values({
            id: assetId,
            userId: tokenPayload.ownerUserId,
            organizationId: tokenPayload.organizationId,
            assetType: tokenPayload.assetType as any,
            entityType: tokenPayload.entityType,
            entityId: tokenPayload.entityId,
            url: fileUrl,
            mimeType: tokenPayload.mimeType,
            sizeBytes: body.byteLength,
            createdByUid: null,
            createdAt: now,
        });

        return c.json({
            ok: true,
            id: assetId,
            key: tokenPayload.key,
            fileUrl,
            sizeBytes: body.byteLength,
            mimeType: tokenPayload.mimeType,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Upload failed.' }, 400);
    }
});

mediaRoute.get('/files/*', async (c) => {
    const bucket = c.env.MEDIA_BUCKET;
    if (!bucket) {
        return c.json({ ok: false, message: 'MEDIA_BUCKET binding is not configured.' }, 500);
    }

    const key = c.req.param('*');
    if (!key) return c.json({ ok: false, message: 'File key is required.' }, 400);

    const object = await bucket.get(key);
    if (!object || !object.body) {
        return c.json({ ok: false, message: 'File not found.' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
});

mediaRoute.get('/assets', requireAuth, async (c) => {
    const scope = getMediaScope(c);
    if (!scope) {
        return c.json({ ok: false, message: 'Organization context missing.' }, 400);
    }

    const assetTypeRaw = c.req.query('assetType');
    const assetType = assetTypeRaw && uploadAssetTypeSchema.safeParse(assetTypeRaw).success
        ? assetTypeRaw as UploadAssetType
        : null;
    const entityType = c.req.query('entityType');
    const entityId = c.req.query('entityId');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 100), 1), 500);

    const conditions = [
        eq(mediaAssets.userId, scope.ownerUserId),
        buildOptionalOrgScopeCondition(mediaAssets.organizationId, scope.organizationId, scope.ownerUserId),
    ];
    if (assetType) conditions.push(eq(mediaAssets.assetType, assetType as any));
    if (entityType) conditions.push(eq(mediaAssets.entityType, entityType));
    if (entityId) conditions.push(eq(mediaAssets.entityId, entityId));

    const rows = await c.get('db')
        .select()
        .from(mediaAssets)
        .where(and(...conditions))
        .orderBy(asc(mediaAssets.createdAt))
        .limit(limit);

    return c.json({ ok: true, assets: rows });
});

export default mediaRoute;

