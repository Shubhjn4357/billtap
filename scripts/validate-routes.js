#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appDir = path.join(projectRoot, 'src', 'app');
const srcDir = path.join(projectRoot, 'src');

const normalizedPath = (value) => value.replace(/\\/g, '/');

function walkFiles(dir) {
    if (!fs.existsSync(dir)) return [];
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
}

function toRoutePath(filePath) {
    const rel = normalizedPath(path.relative(appDir, filePath));
    const noExt = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
    const parts = noExt.split('/').filter(Boolean);

    if (parts.at(-1) === '_layout') return null;

    const cleaned = parts.filter((part) => !/^\(.*\)$/.test(part));
    if (cleaned.length === 0) return '/';
    if (cleaned.at(-1) === 'index') cleaned.pop();

    const route = `/${cleaned.join('/')}`.replace(/\/+/g, '/');
    return route === '' ? '/' : route;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRoutePattern(route) {
    const segments = route.split('/').filter(Boolean);
    const source = segments
        .map((segment) => {
            if (/^\[\.\.\..+\]$/.test(segment)) return '.+';
            if (/^\[.+\]$/.test(segment)) return '[^/]+';
            return escapeRegex(segment);
        })
        .join('/');

    return new RegExp(`^/${source}${segments.length === 0 ? '' : ''}$`);
}

function normalizeTargetPath(rawPath) {
    const normalized = rawPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const degrouped = normalized
        .split('/')
        .filter(Boolean)
        .filter((segment) => !/^\(.*\)$/.test(segment))
        .join('/');
    const degroupedPath = degrouped ? `/${degrouped}` : '/';
    return { normalized, degroupedPath };
}

function hasRouteForPath(routeSet, routePatterns, targetPath) {
    const { normalized, degroupedPath } = normalizeTargetPath(targetPath);
    if (routeSet.has(normalized) || routeSet.has(degroupedPath)) return true;
    return routePatterns.some((pattern) => pattern.test(normalized) || pattern.test(degroupedPath));
}

const appFiles = walkFiles(appDir);
const routeEntries = appFiles
    .map((filePath) => ({
        filePath,
        route: toRoutePath(filePath),
    }))
    .filter((entry) => Boolean(entry.route));

const staticRoutes = new Set(
    routeEntries
        .map((entry) => entry.route)
        .filter((route) => route && !route.includes('['))
);

const dynamicRoutePatterns = routeEntries
    .map((entry) => entry.route)
    .filter((route) => route && route.includes('['))
    .map((route) => toRoutePattern(route));

const issues = [];

const routeToFiles = new Map();
for (const entry of routeEntries) {
    const files = routeToFiles.get(entry.route) ?? [];
    files.push(normalizedPath(path.relative(projectRoot, entry.filePath)));
    routeToFiles.set(entry.route, files);
}
for (const [route, files] of routeToFiles.entries()) {
    const isExpectedRootAlias =
        route === '/'
        && files.some((entry) => entry.endsWith('src/app/index.tsx'))
        && files.some((entry) => entry.includes('src/app/(main)/index.tsx'));
    if (files.length > 1 && !isExpectedRootAlias) {
        issues.push(`Duplicate route "${route}" declared in: ${files.join(', ')}`);
    }
}

function validateLayoutScreens(layoutPath, componentName) {
    if (!fs.existsSync(layoutPath)) {
        issues.push(`Missing layout file: ${normalizedPath(path.relative(projectRoot, layoutPath))}`);
        return;
    }

    const source = fs.readFileSync(layoutPath, 'utf8');
    const regex = new RegExp(`<${componentName}\\.Screen\\s+name="([^"]+)"`, 'g');
    const matches = [...source.matchAll(regex)].map((match) => match[1]);
    const folder = path.dirname(layoutPath);

    for (const screenName of matches) {
        const fileCandidate = path.join(folder, `${screenName}.tsx`);
        const nestedIndexCandidate = path.join(folder, screenName, 'index.tsx');
        const nestedLayoutCandidate = path.join(folder, screenName, '_layout.tsx');
        if (fs.existsSync(fileCandidate) || fs.existsSync(nestedIndexCandidate) || fs.existsSync(nestedLayoutCandidate)) {
            continue;
        }
        issues.push(
            `${normalizedPath(path.relative(projectRoot, layoutPath))} declares "${screenName}" but no matching route file exists.`
        );
    }
}

validateLayoutScreens(path.join(appDir, '(auth)', '_layout.tsx'), 'Stack');
validateLayoutScreens(path.join(appDir, '(main)', '_layout.tsx'), 'Tabs');

const sourceFiles = [...new Set([...walkFiles(srcDir), ...appFiles])];

const routeMatchers = [
    { regex: /router\.(push|replace|navigate)\(\s*['"]([^'"]+)['"]/g, group: 2, label: 'route' },
    { regex: /href\s*[:=]\s*['"]([^'"]+)['"]/g, group: 1, label: 'href' },
    { regex: /pathname\s*:\s*['"]([^'"]+)['"]/g, group: 1, label: 'pathname' },
    { regex: /route\s*:\s*['"]([^'"]+)['"]/g, group: 1, label: 'route' },
    { regex: /returnPath\s*:\s*['"]([^'"]+)['"]/g, group: 1, label: 'returnPath' },
    { regex: /useSmartBack\(\s*['"]([^'"]+)['"]/g, group: 1, label: 'back fallback' },
    { regex: /navigateBackOrReplace\(\s*['"]([^'"]+)['"]/g, group: 1, label: 'back fallback' },
];

for (const filePath of sourceFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    const relPath = normalizedPath(path.relative(projectRoot, filePath));

    for (const matcher of routeMatchers) {
        for (const match of text.matchAll(matcher.regex)) {
            const target = match[matcher.group];
            if (!target.startsWith('/')) continue;
            const targetPath = target.split('?')[0];
            if (!hasRouteForPath(staticRoutes, dynamicRoutePatterns, targetPath)) {
                issues.push(`${relPath} references unknown ${matcher.label} "${target}".`);
            }
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
