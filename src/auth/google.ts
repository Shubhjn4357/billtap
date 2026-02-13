import { OAuth2Client } from 'google-auth-library';

interface GoogleIdentity {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
}

let oauthClient: OAuth2Client | null = null;

const decodeJwtPayload = (token: string): GoogleIdentity => {
    const parts = token.split('.');
    if (parts.length < 2) {
        throw new Error('Invalid token format.');
    }

    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - payloadBase64.length % 4) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as Record<string, unknown>;

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) {
        throw new Error('Identity token is missing subject (sub).');
    }

    return {
        sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
};

export const verifyGoogleIdentityToken = async (idToken: string): Promise<GoogleIdentity> => {
    const audience = process.env.GOOGLE_OAUTH_CLIENT_ID;

    if (!audience) {
        // TODO(auth-security): Require strict Google token verification in production by
        // setting GOOGLE_OAUTH_CLIENT_ID and rejecting unverifiable tokens.
        return decodeJwtPayload(idToken);
    }

    if (!oauthClient) {
        oauthClient = new OAuth2Client(audience);
    }

    const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub) {
        throw new Error('Invalid Google token payload.');
    }

    return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
    };
};
