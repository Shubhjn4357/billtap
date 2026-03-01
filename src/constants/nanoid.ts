/**
 * Generates a URL-safe, random ID.
 * Uses crypto.randomUUID (available in all Cloudflare Workers runtimes).
 */
export const nanoid = (): string => crypto.randomUUID().replace(/-/g, '');
