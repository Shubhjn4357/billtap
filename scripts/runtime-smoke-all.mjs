import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = path.join(ROOT, 'src');
const ROUTES_ROOT = path.join(SRC_ROOT, 'routes');
const APP_PATH = path.join(SRC_ROOT, 'app.ts');
const ENV_FILE = process.env.SMOKE_ENV_FILE
    ? path.resolve(ROOT, process.env.SMOKE_ENV_FILE)
    : path.join(ROOT, '.env');
dotenv.config({ path: ENV_FILE });

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8788';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 12000);
const REQUIRE_AUTH = process.env.SMOKE_REQUIRE_AUTH === 'true';
const LOCAL_SECRET_LENGTH = (process.env.API_JWT_SECRET ?? process.env.JWT_SECRET ?? '').length;

function normalizedPath(value) {
    const withLeading = value.startsWith('/') ? value : `/${value}`;
    const compact = withLeading.replace(/\/+/g, '/');
    return compact.length > 1 ? compact.replace(/\/$/, '') : compact;
}

function walkFiles(dir, exts) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkFiles(full, exts));
            continue;
        }
        if (exts.includes(path.extname(entry.name))) {
            out.push(full);
        }
    }
    return out;
}

function extractRoutes() {
    const appSource = fs.readFileSync(APP_PATH, 'utf8');
    const routeMounts = new Map();
    for (const match of appSource.matchAll(/apiRoutes\.route\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
        routeMounts.set(match[2], normalizedPath(match[1]));
    }

    const routeVarToFile = new Map();
    for (const routeFile of walkFiles(ROUTES_ROOT, ['.ts'])) {
        const source = fs.readFileSync(routeFile, 'utf8');
        const varMatch = source.match(/const\s+([A-Za-z0-9_]+)\s*=\s*new\s+Hono/);
        if (varMatch) {
            routeVarToFile.set(varMatch[1], routeFile);
        }
    }

    const routes = [];
    for (const [routeVar, prefix] of routeMounts.entries()) {
        const routeFile = routeVarToFile.get(routeVar);
        if (!routeFile) continue;
        const source = fs.readFileSync(routeFile, 'utf8');
        const regex = new RegExp(`${routeVar}\\.(get|post|put|patch|delete|options)\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
        for (const match of source.matchAll(regex)) {
            const method = match[1].toUpperCase();
            const suffix = match[2];
            const fullPath = normalizedPath(suffix === '/' ? prefix : `${prefix}${suffix}`);
            routes.push({ method, path: normalizedPath(`/api${fullPath}`) });
        }
    }

    for (const match of appSource.matchAll(/apiRoutes\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)['"`]/g)) {
        routes.push({
            method: match[1].toUpperCase(),
            path: normalizedPath(match[2]),
        });
    }

    const dedup = new Map();
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        if (!dedup.has(key)) dedup.set(key, route);
    }
    return [...dedup.values()].sort((a, b) => {
        const pathSort = a.path.localeCompare(b.path);
        if (pathSort !== 0) return pathSort;
        return a.method.localeCompare(b.method);
    });
}

async function getDbContext() {
    const databaseUrl = process.env.DATABASE_URL;
    const jwtSecret = process.env.API_JWT_SECRET ?? process.env.JWT_SECRET;
    if (!databaseUrl || !jwtSecret) {
        return { token: null, businessId: null };
    }

    const client = new Client({ connectionString: databaseUrl });
    try {
        await client.connect();
        const userRes = await client.query(
            'select id, email from users where is_disabled = false order by created_at asc limit 1'
        );
        const user = userRes.rows[0];
        if (!user?.id) {
            return { token: null, businessId: null };
        }

        const businessRes = await client.query(
            'select id from businesses where owner_user_id = $1 and is_active = true order by created_at asc limit 1',
            [user.id]
        );
        const businessId = businessRes.rows[0]?.id ?? null;
        const token = jwt.sign(
            { sub: String(user.id), email: user.email ? String(user.email) : null, role: null },
            jwtSecret,
            { expiresIn: 60 * 60 * 24 }
        );
        return { token, businessId };
    } catch {
        return { token: null, businessId: null };
    } finally {
        await client.end().catch(() => undefined);
    }
}

function replaceParams(pathValue, context) {
    return pathValue.replace(/:([A-Za-z0-9_]+)/g, (_m, param) => {
        const key = String(param).toLowerCase();
        if (key === 'section') return 'GENERAL';
        if (key === 'intentid') return 'intent_smoke_001';
        if (key === 'accountid') return 'acct_smoke_001';
        if (key === 'itemid') return 'item_smoke_001';
        if (key === 'memberid') return 'member_smoke_001';
        if (key === 'uid') return 'usr_smoke_001';
        if (key === 'id') return 'smoke_001';
        return `${key}_smoke_001`;
    });
}

function bodyForRoute(route) {
    if (route.method === 'GET' || route.method === 'DELETE' || route.method === 'OPTIONS') return null;

    const p = route.path;
    if (p === '/api/auth/google') return { idToken: 'smoke.invalid.token' };
    if (p === '/api/organizations') {
        const stamp = Date.now().toString().slice(-6);
        return { name: `Smoke Org ${stamp}`, code: `SMK${stamp}` };
    }
    if (p.startsWith('/api/settings/')) return { data: {} };
    if (p === '/api/subscription/checkout') return { planId: 'starter_monthly' };
    if (p === '/api/subscription/discounts/validate') return { code: 'SMOKE' };
    if (p === '/api/subscription/webhook') {
        return { intentId: 'intent_smoke_001', status: 'pending' };
    }
    if (p === '/api/operations/periods/lock') {
        return { fromDate: new Date().toISOString(), toDate: new Date().toISOString(), reason: 'smoke' };
    }
    return {};
}

async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

async function waitForHealth() {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
        try {
            const res = await fetchWithTimeout(`${BASE_URL}/api/health`, { method: 'GET' });
            if (res.ok) return true;
        } catch {
            // retry
        }
        await delay(800);
    }
    return false;
}

async function run() {
    console.log(`[runtime-smoke] Base URL: ${BASE_URL}`);
    console.log(`[runtime-smoke] Env file: ${ENV_FILE}`);
    const healthy = await waitForHealth();
    if (!healthy) {
        console.error('[runtime-smoke] Local server is not reachable on /api/health');
        process.exit(1);
    }

    const routes = extractRoutes();
    const dbContext = await getDbContext();
    const explicitToken = process.env.SMOKE_BEARER_TOKEN;
    const token = explicitToken || dbContext.token;
    const businessId = process.env.SMOKE_BUSINESS_ID || dbContext.businessId;

    console.log(`[runtime-smoke] Routes discovered: ${routes.length}`);
    console.log(`[runtime-smoke] Auth token: ${token ? 'yes' : 'no'}`);
    console.log(`[runtime-smoke] Business header: ${businessId ? 'yes' : 'no'}`);
    if (LOCAL_SECRET_LENGTH > 0 && LOCAL_SECRET_LENGTH < 32) {
        console.warn(`[runtime-smoke] Warning: local JWT secret length is ${LOCAL_SECRET_LENGTH}, expected >= 32.`);
    }

    const failures = [];
    const statuses = new Map();
    let authProbeStatus = null;
    let authProbeBody = '';

    if (token) {
        const authProbeHeaders = {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(businessId ? { 'X-Organization-Id': businessId } : {}),
        };
        try {
            const probeRes = await fetchWithTimeout(`${BASE_URL}/api/auth/me`, {
                method: 'GET',
                headers: authProbeHeaders,
            });
            authProbeStatus = probeRes.status;
            authProbeBody = await probeRes.text().catch(() => '');
        } catch (error) {
            authProbeStatus = -1;
            authProbeBody = error instanceof Error ? error.message : String(error);
        }
    }

    for (const route of routes) {
        const finalPath = replaceParams(route.path, { businessId });
        const url = `${BASE_URL}${finalPath}`;
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Client-Platform': 'SMOKE',
            'X-Client-Version': 'runtime-smoke',
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (businessId) headers['X-Organization-Id'] = businessId;

        const body = bodyForRoute(route);
        const init = {
            method: route.method,
            headers,
        };
        if (body !== null) {
            init.body = JSON.stringify(body);
        }

        try {
            const res = await fetchWithTimeout(url, init);
            const statusKey = `${route.method} ${res.status}`;
            statuses.set(statusKey, (statuses.get(statusKey) ?? 0) + 1);

            if (res.status >= 500) {
                const text = await res.text().catch(() => '');
                failures.push({
                    route: `${route.method} ${route.path}`,
                    calledAs: `${route.method} ${finalPath}`,
                    status: res.status,
                    response: text.slice(0, 400),
                });
            }
        } catch (error) {
            failures.push({
                route: `${route.method} ${route.path}`,
                calledAs: `${route.method} ${finalPath}`,
                status: 'EXCEPTION',
                response: error instanceof Error ? error.message : String(error),
            });
        }
    }

    console.log('\n[runtime-smoke] Status distribution:');
    for (const [key, count] of [...statuses.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`- ${key}: ${count}`);
    }

    if (token && authProbeStatus !== 200) {
        console.warn(`\n[runtime-smoke] Warning: auth probe returned ${authProbeStatus}.`);
        if (authProbeBody) {
            console.warn(`[runtime-smoke] Auth probe response: ${authProbeBody.slice(0, 300).replace(/\\s+/g, ' ').trim()}`);
        }
        console.warn('[runtime-smoke] Check JWT secret parity between runtime bindings and smoke token generation.');
        if (REQUIRE_AUTH) {
            failures.push({
                route: 'GET /api/auth/me',
                calledAs: 'GET /api/auth/me',
                status: authProbeStatus ?? 'AUTH_PROBE_FAILED',
                response: authProbeBody,
            });
        }
    }

    if (failures.length > 0) {
        console.error(`\n[runtime-smoke] 5xx/exceptions detected: ${failures.length}`);
        for (const failure of failures.slice(0, 60)) {
            console.error(`- ${failure.route} -> ${failure.status}`);
            console.error(`  Called: ${failure.calledAs}`);
            if (failure.response) {
                console.error(`  Response: ${failure.response.replace(/\s+/g, ' ').trim()}`);
            }
        }
        if (failures.length > 60) {
            console.error(`- ...and ${failures.length - 60} more`);
        }
        process.exit(1);
    }

    console.log('\n[runtime-smoke] PASS: no 5xx responses or runtime exceptions.');
}

run().catch((error) => {
    console.error('[runtime-smoke] fatal', error);
    process.exit(1);
});
