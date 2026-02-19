import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(clientRoot, '..');

const resolveBackendRoot = () => {
    const candidates = ['backend', 'vahi'];
    for (const candidate of candidates) {
        const root = path.join(workspaceRoot, candidate);
        const srcDir = path.join(root, 'src');
        if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
            return root;
        }
    }
    return path.join(workspaceRoot, 'backend');
};

const backendRoot = resolveBackendRoot();
const backendRoutesDir = path.join(backendRoot, 'src', 'routes');
const clientApiDir = path.join(clientRoot, 'src', 'api');

const resolveBackendEntryPath = () => {
    const candidates = ['app.ts', 'server.ts', 'index.ts'];
    for (const fileName of candidates) {
        const candidate = path.join(backendRoot, 'src', fileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return path.join(backendRoot, 'src', 'app.ts');
};

const backendEntryPath = resolveBackendEntryPath();

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const normalizedPath = (value) => {
    const withSlashes = value.startsWith('/') ? value : `/${value}`;
    const compact = withSlashes.replace(/\/+/g, '/');
    return compact.length > 1 ? compact.replace(/\/$/, '') : compact;
};

const walkFiles = (dir, exts) => {
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
};

const skipQuotedString = (source, startIndex, quote) => {
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
};

const skipTemplateLiteral = (source, startIndex) => {
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
};

const skipExpressionBlock = (source, startIndex) => {
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
};

const parseTemplatePath = (source, startIndex) => {
    let index = startIndex + 1; // after opening backtick
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
            }

            index = expressionEnd;
            continue;
        }
        output += char;
        index += 1;
    }

    return { raw: output, nextIndex: source.length };
};

const extractClientApiCalls = () => {
    const calls = [];
    const files = walkFiles(clientApiDir, ['.ts', '.tsx']);

    for (const filePath of files) {
        const source = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(clientRoot, filePath).replace(/\\/g, '/');

        const callRegex = /apiClient\.(get|post|put|patch|delete)(?:<[\s\S]*?>)?\s*\(/g;
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
            calls.push({ method, path: cleanPath, source: relPath });
        }
    }

    return calls;
};

const extractBackendRoutes = () => {
    const appSource = fs.readFileSync(backendEntryPath, 'utf8');
    const routeMounts = new Map();

    for (const match of appSource.matchAll(/apiRoutes\.route\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
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
        const routeRegex = new RegExp(`${routeVarName}\\.(get|post|put|patch|delete)\\([\\s\\r\\n]*['"]([^'"]+)['"]`, 'g');
        const routeFileRel = path.relative(backendRoot, routeFile).replace(/\\/g, '/');

        for (const match of source.matchAll(routeRegex)) {
            const method = String(match[1]).toUpperCase();
            const suffix = match[2];
            const fullPath = normalizedPath(suffix === '/' ? prefix : `${prefix}${suffix}`);
            routes.push({ method, path: fullPath, source: routeFileRel });
        }
    }

    for (const match of appSource.matchAll(/apiRoutes\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
        routes.push({
            method: String(match[1]).toUpperCase(),
            path: normalizedPath(match[2]),
            source: path.relative(backendRoot, backendEntryPath).replace(/\\/g, '/'),
        });
    }

    return routes;
};

const compileBackendPattern = (pathValue) => {
    const escaped = normalizedPath(pathValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const colonReplaced = escaped.replace(/:[A-Za-z0-9_]+/g, '[^/]+');
    const wildcardReplaced = colonReplaced.replace(/\\\*/g, '.+');
    return new RegExp(`^${wildcardReplaced}$`);
};

const clientCalls = extractClientApiCalls();
const backendRoutes = extractBackendRoutes();

const backendPatterns = backendRoutes.map((route) => ({
    ...route,
    pattern: compileBackendPattern(route.path),
}));

const issues = [];

for (const call of clientCalls) {
    const matchingPaths = backendPatterns.filter((backendRoute) => backendRoute.pattern.test(call.path));
    if (matchingPaths.length === 0) {
        issues.push(
            `${call.source} uses ${call.method} ${call.path}, but no matching backend route exists.`
        );
        continue;
    }

    const methodMatch = matchingPaths.some((backendRoute) => backendRoute.method === call.method);
    if (!methodMatch) {
        const methods = [...new Set(matchingPaths.map((entry) => entry.method))].join(', ');
        issues.push(
            `${call.source} uses ${call.method} ${call.path}, but backend supports [${methods}] only.`
        );
    }
}

if (issues.length > 0) {
    console.error('\nAPI route validation failed:\n');
    for (const issue of issues) {
        console.error(`- ${issue}`);
    }
    process.exit(1);
}

console.log(
    `API route validation passed (${clientCalls.length} client API calls checked against ${backendRoutes.length} backend routes).`
);
