import { OAuth2Client } from 'google-auth-library';

interface GoogleIdentity {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
}

let oauthClient: OAuth2Client | null = null;

export type GoogleOAuthEnv = {
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_IDS?: string;
    GOOGLE_OAUTH_ANDROID_CLIENT_ID?: string;
    GOOGLE_OAUTH_IOS_CLIENT_ID?: string;
};

const parseEnvClientIds = (value?: string): string[] =>
    (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

const getGoogleAudiences = (env?: GoogleOAuthEnv): string[] => {
    const source = env ?? (process.env as GoogleOAuthEnv);
    const audiences = new Set<string>([
        ...parseEnvClientIds(source.GOOGLE_OAUTH_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_CLIENT_IDS),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_ANDROID_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_IOS_CLIENT_ID),
    ]);

    return [...audiences];
};

export const verifyGoogleIdentityToken = async (idToken: string, env?: GoogleOAuthEnv): Promise<GoogleIdentity> => {
    const audiences = getGoogleAudiences(env);

    if (audiences.length === 0) {
        throw new Error(
            'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID (or GOOGLE_OAUTH_CLIENT_IDS).'
        );
    }

    if (!oauthClient) {
        oauthClient = new OAuth2Client();
    }

    const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: audiences,
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
