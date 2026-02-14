import * as jwt from 'jsonwebtoken';

export interface SessionTokenPayload {
    uid: string;
    role?: string | null;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

const getJwtSecret = () => {
    return process.env.API_JWT_SECRET || 'change-this-dev-secret-before-production';
};

export const signSessionToken = (payload: SessionTokenPayload): string => {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: DEFAULT_TTL_SECONDS,
    });
};

export const verifySessionToken = (token: string): SessionTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, getJwtSecret());
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
