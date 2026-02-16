import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const appDir = path.join(projectRoot, 'app');
const srcDir = path.join(projectRoot, 'src');

const normalizedPath = (value) => value.replace(/\\/g, '/');

const walkFiles = (dir) => {
    const output = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            output.push(...walkFiles(fullPath));
            continue;
        }
        if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) continue;
        output.push(fullPath);
    }
    return output;
};

const toRoutePath = (filePath) => {
    const rel = normalizedPath(path.relative(appDir, filePath));
    const noExt = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
    const parts = noExt.split('/').filter(Boolean);

    // `_layout` files are not routes.
    if (parts.at(-1) === '_layout') return null;

    const cleaned = parts.filter((part) => !/^\(.*\)$/.test(part));
    if (cleaned.length === 0) return '/';

    if (cleaned.at(-1) === 'index') cleaned.pop();

    const route = `/${cleaned.join('/')}`.replace(/\/+/g, '/');
    return route === '' ? '/' : route;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toRoutePattern = (route) => {
    const segments = route.split('/').filter(Boolean);
    const source = segments
        .map((segment) => {
            if (/^\[\.\.\..+\]$/.test(segment)) return '.+';
            if (/^\[.+\]$/.test(segment)) return '[^/]+';
            return escapeRegex(segment);
        })
        .join('/');

    return new RegExp(`^/${source}${segments.length === 0 ? '' : ''}$`);
};

const appFiles = walkFiles(appDir);
const routeEntries = appFiles
    .map((filePath) => ({
        filePath,
        route: toRoutePath(filePath),
    }))
    .filter((entry) => Boolean(entry.route));

const staticRoutes = new Set(routeEntries
    .map((entry) => entry.route)
    .filter((route) => route && !route.includes('[')));

const dynamicRoutePatterns = routeEntries
    .map((entry) => entry.route)
    .filter((route) => route && route.includes('['))
    .map((route) => toRoutePattern(route));

const matchesKnownRoute = (rawPath) => {
    const normalized = rawPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    // Group-qualified paths (e.g. /(main)/(tabs)/home) resolve to /home.
    const degrouped = normalized
        .split('/')
        .filter(Boolean)
        .filter((segment) => !/^\(.*\)$/.test(segment))
        .join('/');
    const degroupedPath = degrouped ? `/${degrouped}` : '/';

    if (staticRoutes.has(normalized) || staticRoutes.has(degroupedPath)) return true;
    return dynamicRoutePatterns.some((pattern) => pattern.test(normalized) || pattern.test(degroupedPath));
};

const issues = [];

const routeToFiles = new Map();
for (const entry of routeEntries) {
    const route = entry.route;
    const files = routeToFiles.get(route) ?? [];
    files.push(normalizedPath(path.relative(projectRoot, entry.filePath)));
    routeToFiles.set(route, files);
}
for (const [route, files] of routeToFiles.entries()) {
    if (files.length > 1) {
        issues.push(`Duplicate route "${route}" declared in: ${files.join(', ')}`);
    }
}

// 1) Validate explicit Stack.Screen names in app/(main)/_layout.tsx
const mainLayoutPath = path.join(appDir, '(main)', '_layout.tsx');
const mainLayoutSource = fs.readFileSync(mainLayoutPath, 'utf8');
const screenNameMatches = [...mainLayoutSource.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)];
const declaredScreenNames = screenNameMatches.map((match) => match[1]);

const mainChildRouteNames = new Set(
    appFiles
        .filter((filePath) => normalizedPath(filePath).includes('/app/(main)/'))
        .filter((filePath) => !normalizedPath(filePath).endsWith('/app/(main)/_layout.tsx'))
        .map((filePath) => {
            const rel = normalizedPath(path.relative(path.join(appDir, '(main)'), filePath))
                .replace(/\.(tsx|ts|jsx|js)$/, '');
            if (rel === '_layout') return null;
            if (rel.endsWith('/_layout')) {
                return rel.split('/')[0];
            }
            return rel;
        })
        .filter(Boolean)
);

for (const screenName of declaredScreenNames) {
    if (!mainChildRouteNames.has(screenName)) {
        issues.push(
            `app/(main)/_layout.tsx declares "${screenName}" but no matching child route file was found.`
        );
    }
}

// 2) Validate router.push/replace/navigate hardcoded route strings in app + src.
const sourceFiles = [...walkFiles(srcDir), ...appFiles];
for (const filePath of sourceFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    const relPath = normalizedPath(path.relative(projectRoot, filePath));
    const regex = /router\.(push|replace|navigate)\(\s*['"]([^'"]+)['"]/g;

    for (const match of text.matchAll(regex)) {
        const target = match[2];
        if (!target.startsWith('/')) continue;
        if (!matchesKnownRoute(target)) {
            issues.push(`${relPath} references unknown route "${target}".`);
        }
    }
}

if (issues.length > 0) {
    console.error('\nRoute validation failed:\n');
    for (const issue of issues) {
        console.error(`- ${issue}`);
    }
    process.exit(1);
}

console.log(`Route validation passed (${routeEntries.length} routes scanned).`);
