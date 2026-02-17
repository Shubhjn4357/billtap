// import { OAuth2Client } from 'google-auth-library';
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
const verifyGoogleTokenViaApi = async (idToken) => {
    // Determine the verification URL.
    // For ID tokens, use: https://oauth2.googleapis.com/tokeninfo?id_token=XYZ
    // For Access tokens, use: https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=XYZ
    // Here we assume idToken.
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google token verification failed: ${text}`);
    }
    const payload = await response.json();
    return payload;
};
export const verifyGoogleIdentityToken = async (idToken, env) => {
    const audiences = getGoogleAudiences(env);
    if (audiences.length === 0) {
        throw new Error('Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID (or GOOGLE_OAUTH_CLIENT_IDS).');
    }
    // Use fetch-based verification to avoid Node.js crypto dependencies in Cloudflare Workers
    const payload = await verifyGoogleTokenViaApi(idToken);
    // Verify audience
    if (!payload.aud) {
        throw new Error('Invalid Google token: missing audience.');
    }
    const tokenAud = payload.aud;
    // payload.aud can be a string, check if it matches any of our allowed audiences
    const isValidAudience = audiences.includes(tokenAud);
    if (!isValidAudience) {
        // Also check for azimuth (authorized party) if present, though audience is primary.
        // Some Google tokens sets 'azp' to the client ID of the app that issued the token.
        const azp = payload.azp;
        if (!azp || !audiences.includes(azp)) {
            throw new Error(`Invalid Google token audience. Expected one of: ${audiences.join(', ')}, got: ${tokenAud} (azp: ${azp})`);
        }
    }
    if (!payload.sub) {
        throw new Error('Invalid Google token payload.');
    }
    return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
    };
};
