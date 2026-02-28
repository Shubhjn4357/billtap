#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const invokedScriptPath = process.argv[1]
    ? path.resolve(process.argv[1])
    : path.resolve(process.cwd(), 'scripts', 'verify-api-contract.js');
const scriptDir = path.dirname(invokedScriptPath);
const clientRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(clientRoot, '..');
const backendRoot = path.join(workspaceRoot, 'server');
const backendSrcDir = path.join(backendRoot, 'src');
const backendRoutesDir = path.join(backendSrcDir, 'routes');
const clientSrcDir = path.join(clientRoot, 'src');

const BACKEND_ENTRY_CANDIDATES = [
    path.join(backendSrcDir, 'app.ts'),
    path.join(backendSrcDir, 'index.ts'),
    path.join(backendSrcDir, 'server.ts'),
];

const CLIENT_CALL_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const BACKEND_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options'];

function normalizedPath(value) {
    const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
    const compact = withLeadingSlash.replace(/\/+/g, '/');
    return compact.length > 1 ? compact.replace(/\/$/, '') : compact;
}

function walkFiles(dir, exts) {
    if (!fs.existsSync(dir)) return [];
    const output = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            output.push(...walkFiles(fullPath, exts));
            continue;
        }

        if (!exts.includes(path.extname(entry.name))) continue;
        output.push(fullPath);
    }

    return output;
}

function skipQuotedString(source, startIndex, quote) {
    let index = startIndex + 1;
    while (index < source.length) {
        const char = source[index];
        if (char === '\\') {
            index += 2;
            continue;
        }
        if (char === quote) return index + 1;
        index += 1;
    }
    return source.length;
}

function skipExpressionBlock(source, startIndex) {
    let depth = 1;
    let index = startIndex;

    while (index < source.length && depth > 0) {
        const char = source[index];

        if (char === '\'' || char === '"') {
            index = skipQuotedString(source, index, char);
            continue;
        }

        if (char === '`') {
            index = skipTemplateLiteral(source, index);
            continue;
        }

        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        index += 1;
    }

    return index;
}

function skipTemplateLiteral(source, startIndex) {
    let index = startIndex + 1;
    while (index < source.length) {
        const char = source[index];
        if (char === '\\') {
            index += 2;
            continue;
        }
        if (char === '`') return index + 1;
        if (char === '$' && source[index + 1] === '{') {
            index = skipExpressionBlock(source, index + 2);
            continue;
        }
        index += 1;
    }
    return source.length;
}

function parseTemplatePath(source, startIndex) {
    let index = startIndex + 1;
    let output = '';

    while (index < source.length) {
        const char = source[index];
        if (char === '\\') {
            if (index + 1 < source.length) {
                output += source[index + 1];
            }
            index += 2;
            continue;
        }

        if (char === '`') {
            return { raw: output, nextIndex: index + 1 };
        }

        if (char === '$' && source[index + 1] === '{') {
            const expressionStart = index + 2;
            const expressionEnd = skipExpressionBlock(source, expressionStart);
            const previousChar = output.at(-1);
            const nextChar = source[expressionEnd];

            if (previousChar === '/') {
                output += ':param';
            } else if (nextChar === '/') {
                output += '/:param';
            } else {
                output += ':param';
            }

            index = expressionEnd;
            continue;
        }

        output += char;
        index += 1;
    }

    return { raw: output, nextIndex: source.length };
}

function resolveBackendEntryPath() {
    for (const candidate of BACKEND_ENTRY_CANDIDATES) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return BACKEND_ENTRY_CANDIDATES[0];
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractClientApiCalls() {
    const calls = [];
    const files = walkFiles(clientSrcDir, ['.ts', '.tsx']);
    const callRegex = new RegExp(
        `(?:\\bapi\\b|\\bapiClient\\b)\\.(${CLIENT_CALL_METHODS.join('|')})(?:<[\\s\\S]*?>)?\\s*\\(`,
        'g'
    );

    for (const filePath of files) {
        const source = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(clientRoot, filePath).replace(/\\/g, '/');

        for (const match of source.matchAll(callRegex)) {
            const method = String(match[1]).toUpperCase();
            let index = (match.index ?? 0) + match[0].length;

            while (index < source.length && /\s/.test(source[index])) index += 1;
            if (index >= source.length) continue;

            const firstChar = source[index];
            let rawPath = null;

            if (firstChar === '\'' || firstChar === '"') {
                const end = skipQuotedString(source, index, firstChar);
                rawPath = source.slice(index + 1, end - 1);
                index = end;
            } else if (firstChar === '`') {
                const parsed = parseTemplatePath(source, index);
                rawPath = parsed.raw;
                index = parsed.nextIndex;
            }

            if (!rawPath || !rawPath.startsWith('/')) continue;
            const cleanPath = normalizedPath(rawPath.split('?')[0]);

            calls.push({
                method,
                path: cleanPath,
                source: relPath,
            });
        }
    }

    return calls;
}

function extractBackendRoutes() {
    const backendEntryPath = resolveBackendEntryPath();
    const appSource = fs.readFileSync(backendEntryPath, 'utf8');

    const routeMounts = new Map();
    for (const match of appSource.matchAll(/apiRoutes\.route\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
        const prefix = normalizedPath(match[1]);
        const routeVarName = match[2];
        routeMounts.set(routeVarName, prefix);
    }

    const routeVarToFile = new Map();
    for (const filePath of walkFiles(backendRoutesDir, ['.ts'])) {
        const source = fs.readFileSync(filePath, 'utf8');
        const routeVarMatch = source.match(/const\s+([A-Za-z0-9_]+)\s*=\s*new\s+Hono/);
        if (!routeVarMatch) continue;
        routeVarToFile.set(routeVarMatch[1], filePath);
    }

    const routes = [];

    for (const [routeVarName, prefix] of routeMounts.entries()) {
        const routeFile = routeVarToFile.get(routeVarName);
        if (!routeFile) continue;

        const source = fs.readFileSync(routeFile, 'utf8');
        const routeFileRel = path.relative(backendRoot, routeFile).replace(/\\/g, '/');
        const routeRegex = new RegExp(
            `${escapeRegex(routeVarName)}\\.(${BACKEND_METHODS.join('|')})\\([\\s\\r\\n]*['"\`]([^'"\\\`]+)['"\`]`,
            'g'
        );

        for (const match of source.matchAll(routeRegex)) {
            const method = String(match[1]).toUpperCase();
            const suffix = match[2];
            const fullPath = normalizedPath(suffix === '/' ? prefix : `${prefix}${suffix}`);
            routes.push({
                method,
                path: fullPath,
                source: routeFileRel,
            });
        }
    }

    const apiDirectRegex = new RegExp(
        `apiRoutes\\.(${BACKEND_METHODS.join('|')})\\(\\s*['"\`]([^'"\\\`]+)['"\`]`,
        'g'
    );
    for (const match of appSource.matchAll(apiDirectRegex)) {
        routes.push({
            method: String(match[1]).toUpperCase(),
            path: normalizedPath(match[2]),
            source: path.relative(backendRoot, backendEntryPath).replace(/\\/g, '/'),
        });
    }

    return routes;
}

function compileBackendPattern(pathValue) {
    const escaped = normalizedPath(pathValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const colonReplaced = escaped.replace(/:[A-Za-z0-9_]+/g, '[^/]+');
    const wildcardReplaced = colonReplaced.replace(/\\\*/g, '.+');
    return new RegExp(`^${wildcardReplaced}$`);
}

function createBackendRouteVariants(routes) {
    const variants = [];

    for (const route of routes) {
        const candidatePaths = new Set([
            normalizedPath(route.path),
            normalizedPath(`/api${route.path}`),
        ]);

        for (const pathValue of candidatePaths) {
            variants.push({
                ...route,
                publicPath: pathValue,
                pattern: compileBackendPattern(pathValue),
            });
        }
    }

    return variants;
}

function formatIssue(line) {
    return `- ${line}`;
}

function runValidation() {
    if (!fs.existsSync(backendRoot)) {
        console.error(`[verify-api-contract] Backend folder not found: ${backendRoot}`);
        process.exit(1);
    }
    if (!fs.existsSync(backendRoutesDir)) {
        console.error(`[verify-api-contract] Backend routes folder not found: ${backendRoutesDir}`);
        process.exit(1);
    }
    if (!fs.existsSync(clientSrcDir)) {
        console.error(`[verify-api-contract] Client src folder not found: ${clientSrcDir}`);
        process.exit(1);
    }

    const clientCalls = extractClientApiCalls();
    const backendRoutes = extractBackendRoutes();
    const backendRouteVariants = createBackendRouteVariants(backendRoutes);
    const issues = [];

    for (const call of clientCalls) {
        const matchingPaths = backendRouteVariants.filter((entry) => entry.pattern.test(call.path));

        if (matchingPaths.length === 0) {
            issues.push(
                `${call.source} uses ${call.method} ${call.path}, but no backend route matches this path.`
            );
            continue;
        }

        const methodMatch = matchingPaths.some((entry) => entry.method === call.method);
        if (!methodMatch) {
            const methods = [...new Set(matchingPaths.map((entry) => entry.method))].join(', ');
            const sampleBackendPath = matchingPaths[0]?.publicPath ?? 'unknown';
            issues.push(
                `${call.source} uses ${call.method} ${call.path}, but backend route ${sampleBackendPath} supports [${methods}] only.`
            );
        }
    }

    const duplicateClientCalls = new Map();
    for (const call of clientCalls) {
        const key = `${call.method} ${call.path}`;
        const current = duplicateClientCalls.get(key) ?? new Set();
        current.add(call.source);
        duplicateClientCalls.set(key, current);
    }

    if (issues.length > 0) {
        console.error('\nAPI contract validation failed:\n');
        for (const issue of issues) {
            console.error(formatIssue(issue));
        }
        process.exit(1);
    }

    const duplicateSummary = [...duplicateClientCalls.entries()]
        .filter(([, sources]) => sources.size > 1)
        .length;

    console.log(
        `[verify-api-contract] Passed: ${clientCalls.length} client API calls validated against ${backendRoutes.length} backend routes (${backendRouteVariants.length} public variants).`
    );
    if (duplicateSummary > 0) {
        console.log(`[verify-api-contract] Note: ${duplicateSummary} client endpoints are called from multiple files.`);
    }
}

runValidation();
