interface GoogleIdentity {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
}

export type GoogleOAuthEnv = {
    GOOGLE_CLIENT_ID?: string;
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
        ...parseEnvClientIds(source.GOOGLE_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_CLIENT_IDS),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_ANDROID_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_IOS_CLIENT_ID),
    ]);

    return [...audiences];
};

const verifyGoogleTokenViaApi = async (idToken: string): Promise<Record<string, unknown>> => {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google token verification failed: ${text}`);
    }

    return (await response.json()) as Record<string, unknown>;
};

export const verifyGoogleIdentityToken = async (idToken: string, env?: GoogleOAuthEnv): Promise<GoogleIdentity> => {
    const audiences = getGoogleAudiences(env);

    if (audiences.length === 0) {
        throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID on the server.');
    }

    const payload = await verifyGoogleTokenViaApi(idToken);
    const tokenAud = typeof payload.aud === 'string' ? payload.aud : '';
    const azp = typeof payload.azp === 'string' ? payload.azp : '';

    if (!tokenAud || (!audiences.includes(tokenAud) && (!azp || !audiences.includes(azp)))) {
        throw new Error(`Invalid Google token audience. Expected one of: ${audiences.join(', ')}`);
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) {
        throw new Error('Invalid Google token payload.');
    }

    return {
        sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
};
