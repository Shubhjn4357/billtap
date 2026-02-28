import * as jwt from 'jsonwebtoken';

export interface SessionTokenPayload {
    sub: string;
    email?: string | null;
    role?: string | null;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

const getJwtSecret = (secretOverride?: string) => {
    const secret = secretOverride ?? process.env.JWT_SECRET ?? process.env.API_JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT secret is not configured securely (minimum 32 characters required).');
    }
    return secret;
};

export const signSessionToken = (payload: SessionTokenPayload, secretOverride?: string): string => {
    return jwt.sign(payload, getJwtSecret(secretOverride), {
        expiresIn: DEFAULT_TTL_SECONDS,
    });
};

export const verifySessionToken = (token: string, secretOverride?: string): SessionTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, getJwtSecret(secretOverride));
        if (!decoded || typeof decoded !== 'object') {
            return null;
        }

        const sub = 'sub' in decoded ? String(decoded.sub) : '';
        if (!sub) {
            return null;
        }

        return {
            sub,
            email: 'email' in decoded ? (decoded.email ? String(decoded.email) : null) : null,
            role: 'role' in decoded ? (decoded.role ? String(decoded.role) : null) : null,
        };
    } catch {
        return null;
    }
};
