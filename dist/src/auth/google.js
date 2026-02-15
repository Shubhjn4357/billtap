import { OAuth2Client } from 'google-auth-library';
let oauthClient = null;
const parseEnvClientIds = (value) => (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
const getGoogleAudiences = (env) => {
    const source = env ?? process.env;
    const audiences = new Set([
        ...parseEnvClientIds(source.GOOGLE_OAUTH_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_CLIENT_IDS),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_ANDROID_CLIENT_ID),
        ...parseEnvClientIds(source.GOOGLE_OAUTH_IOS_CLIENT_ID),
    ]);
    return [...audiences];
};
export const verifyGoogleIdentityToken = async (idToken, env) => {
    const audiences = getGoogleAudiences(env);
    if (audiences.length === 0) {
        throw new Error('Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID (or GOOGLE_OAUTH_CLIENT_IDS).');
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
