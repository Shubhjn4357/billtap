import * as jwt from 'jsonwebtoken';

export interface SessionTokenPayload {
    uid: string;
    role?: string | null;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

const getJwtSecret = (secretOverride?: string) => {
    const secret = secretOverride ?? process.env.API_JWT_SECRET;
    if (!secret || secret.length < 32 || secret === 'change-this-dev-secret-before-production') {
        throw new Error('API_JWT_SECRET is not configured securely (minimum 32 characters required).');
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

        const uid = 'uid' in decoded ? String(decoded.uid) : '';
        if (!uid) {
            return null;
        }

        return {
            uid,
            role: 'role' in decoded ? (decoded.role ? String(decoded.role) : null) : null,
        };
    } catch {
        return null;
    }
};
