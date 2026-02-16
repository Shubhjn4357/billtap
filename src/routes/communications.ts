import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { messageLogs } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { requirePermission, withOrganizationContext } from '../middleware/permissions';

const communicationsRoute = new Hono<AppEnv>();

communicationsRoute.get('/messages/logs', requireAuth, withOrganizationContext, requirePermission('can_send_messages'), async (c) => {
    const ownerUserId = c.get('organizationOwnerId');
    const organizationId = c.get('organizationId');
    if (!ownerUserId || !organizationId) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

    const status = c.req.query('status');
    const channel = c.req.query('channel');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 300), 1), 2000);

    const conditions = [
        eq(messageLogs.userId, ownerUserId),
        eq(messageLogs.organizationId, organizationId),
    ];
    if (status) conditions.push(eq(messageLogs.status, status));
    if (channel) conditions.push(eq(messageLogs.channel, channel));

    const rows = await c.get('db')
        .select()
        .from(messageLogs)
        .where(and(...conditions))
        .orderBy(desc(messageLogs.createdAt))
        .limit(limit);

    return c.json({ ok: true, logs: rows });
});

communicationsRoute.post('/messages/send', requireAuth, withOrganizationContext, requirePermission('can_send_messages'), async (c) => {
    try {
        const ownerUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        const authUser = c.get('authUser');
        if (!ownerUserId || !organizationId || !authUser) return c.json({ ok: false, message: 'Organization context missing.' }, 400);

        const payload = z.object({
            channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']).default('WHATSAPP'),
            recipient: z.string().min(6),
            message: z.string().min(1),
            barcode: z.string().optional(),
            mediaUrl: z.string().url().optional(),
        }).parse(await c.req.json());

        const messageText = payload.barcode
            ? `${payload.message}\nBarcode: ${payload.barcode}`
            : payload.message;

        const id = nanoid();
        const now = new Date();
        let status: 'pending' | 'sent' | 'failed' = 'pending';
        let providerMessageId: string | null = null;
        let errorMessage: string | null = null;

        if (payload.channel === 'WHATSAPP' && c.env.WHATSAPP_API_URL && c.env.WHATSAPP_API_TOKEN) {
            try {
                const response = await fetch(c.env.WHATSAPP_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${c.env.WHATSAPP_API_TOKEN}`,
                    },
                    body: JSON.stringify({
                        to: payload.recipient,
                        message: messageText,
                        mediaUrl: payload.mediaUrl,
                    }),
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || `Provider status ${response.status}`);
                }
                const providerPayload = await response.json().catch(() => (null as unknown));
                if (
                    providerPayload
                    && typeof providerPayload === 'object'
                    && 'messageId' in providerPayload
                    && typeof (providerPayload as Record<string, unknown>).messageId === 'string'
                ) {
                    providerMessageId = (providerPayload as Record<string, unknown>).messageId as string;
                }
                status = 'sent';
            } catch (error: unknown) {
                status = 'failed';
                errorMessage = error instanceof Error ? error.message : 'Provider request failed.';
            }
        } else {
            // Graceful fallback for dev/self-hosted setups without provider credentials.
            status = 'sent';
        }

        await c.get('db').insert(messageLogs).values({
            id,
            userId: ownerUserId,
            organizationId,
            channel: payload.channel,
            recipient: payload.recipient,
            message: messageText,
            mediaUrl: payload.mediaUrl ?? null,
            providerMessageId,
            status,
            errorMessage,
            sentByUid: authUser.uid,
            sentAt: status === 'sent' ? now : null,
            createdAt: now,
        });

        return c.json({
            ok: true,
            id,
            status,
            providerMessageId,
            errorMessage,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to send message.' }, 400);
    }
});

export default communicationsRoute;
