#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_DIR = __dirname;
const VAHI_ROOT = path.resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = path.resolve(VAHI_ROOT, '..');
const SERVER_ROOT = path.join(WORKSPACE_ROOT, 'server');
const ADMIN_ROOT = path.join(WORKSPACE_ROOT, 'admin');
const SERVER_SRC_ROOT = path.join(SERVER_ROOT, 'src');
const SERVER_ROUTES_ROOT = path.join(SERVER_SRC_ROOT, 'routes');
const MOBILE_SRC_ROOT = path.join(VAHI_ROOT, 'src');
const MOBILE_APP_ROOT = path.join(MOBILE_SRC_ROOT, 'app');
const ADMIN_SRC_ROOT = path.join(ADMIN_ROOT, 'src');
const ADMIN_APP_ROOT = path.join(ADMIN_SRC_ROOT, 'app');
const REPORT_PATH = path.join(VAHI_ROOT, 'docs', 'PLATFORM_VERIFICATION_REPORT.md');

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const CALL_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const BACKEND_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options'];
const IMPORT_SUFFIXES = [
    '',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.native.ts',
    '.native.tsx',
    '.web.ts',
    '.web.tsx',
    '.native.js',
    '.web.js',
];

function normalizedPath(value) {
    const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
    const compact = withLeadingSlash.replace(/\/+/g, '/');
    return compact.length > 1 ? compact.replace(/\/$/, '') : compact;
}

function walkFiles(dir, exts) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const output = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            output.push(...walkFiles(fullPath, exts));
            continue;
        }
        if (!exts.includes(path.extname(entry.name))) continue;
        output.push(path.resolve(fullPath));
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
            if (index + 1 < source.length) output += source[index + 1];
            index += 2;
            continue;
        }

        if (char === '`') {
            return { raw: output, nextIndex: index + 1 };
        }

        if (char === '$' && source[index + 1] === '{') {
            index = skipExpressionBlock(source, index + 2);
            output += ':param';
            continue;
        }

        output += char;
        index += 1;
    }

    return { raw: output, nextIndex: source.length };
}

function parseFirstArgPath(source, openParenIndex) {
    let index = openParenIndex + 1;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) return null;

    const firstChar = source[index];
    if (firstChar === '\'' || firstChar === '"') {
        const end = skipQuotedString(source, index, firstChar);
        return {
            raw: source.slice(index + 1, end - 1),
            nextIndex: end,
        };
    }
    if (firstChar === '`') {
        return parseTemplatePath(source, index);
    }
    return null;
}

function normalizeClientPath(rawPath) {
    if (!rawPath) return null;
    let candidate = String(rawPath).trim();
    if (!candidate) return null;

    const queryIndex = candidate.indexOf('?');
    if (queryIndex >= 0) candidate = candidate.slice(0, queryIndex);

    if (/^https?:\/\//i.test(candidate)) {
        try {
            candidate = new URL(candidate).pathname;
        } catch {
            const apiIndex = candidate.indexOf('/api/');
            if (apiIndex >= 0) {
                candidate = candidate.slice(apiIndex);
            }
        }
    }

    if (candidate.startsWith(':param')) {
        const slashIndex = candidate.indexOf('/');
        candidate = slashIndex >= 0 ? candidate.slice(slashIndex) : '/';
    }

    if (candidate.startsWith('/:param')) {
        const slashIndex = candidate.indexOf('/', '/:param'.length);
        candidate = slashIndex >= 0 ? candidate.slice(slashIndex) : '/';
    }

    if (!candidate.startsWith('/')) {
        const apiIndex = candidate.indexOf('/api/');
        if (apiIndex >= 0) {
            candidate = candidate.slice(apiIndex);
        } else {
            const slashIndex = candidate.indexOf('/');
            candidate = slashIndex >= 0 ? candidate.slice(slashIndex) : null;
        }
    }

    if (!candidate) return null;
    return normalizedPath(candidate);
}

function deriveExpoRouteFromFile(filePath) {
    const marker = `${path.sep}src${path.sep}app${path.sep}`;
    const idx = filePath.indexOf(marker);
    if (idx === -1) return null;

    const rel = filePath.slice(idx + marker.length).replace(/\\/g, '/');
    const noExt = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
    const parts = noExt.split('/').filter(Boolean);
    if (parts.at(-1) === '_layout') return null;
    const cleaned = parts.filter((part) => !/^\(.*\)$/.test(part));
    if (cleaned.at(-1) === 'index') cleaned.pop();
    return cleaned.length > 0 ? `/${cleaned.join('/')}` : '/';
}

function deriveNextPageRouteFromFile(filePath) {
    const marker = `${path.sep}src${path.sep}app${path.sep}`;
    const idx = filePath.indexOf(marker);
    if (idx === -1) return null;

    const rel = filePath.slice(idx + marker.length).replace(/\\/g, '/');
    if (!rel.endsWith('/page.tsx') && !rel.endsWith('/page.ts') && rel !== 'page.tsx' && rel !== 'page.ts') {
        return null;
    }

    const noPage = rel
        .replace(/\/page\.(tsx|ts)$/, '')
        .replace(/^page\.(tsx|ts)$/, '');
    const parts = noPage.split('/').filter(Boolean).filter((part) => !/^\(.*\)$/.test(part));
    if (parts.length === 0) return '/';
    return `/${parts.join('/')}`;
}

function inferFetchMethod(source, nextIndex) {
    const lookAhead = source.slice(nextIndex, Math.min(source.length, nextIndex + 220));
    const match = lookAhead.match(/method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE|OPTIONS)['"`]/i);
    return (match?.[1] ?? 'GET').toUpperCase();
}

function normalizeAdminCallPath(callPath) {
    const normalized = normalizedPath(callPath);
    if (normalized.startsWith('/api/backend/')) {
        const stripped = normalized.slice('/api/backend'.length);
        return stripped.startsWith('/') ? stripped : `/${stripped}`;
    }
    return normalized;
}

function extractImportSpecifiers(source) {
    const specs = [];
    const patterns = [
        /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
        /\bexport\s+(?:\*\s+from|\{[\s\S]*?\}\s+from)\s*['"]([^'"]+)['"]/g,
        /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            const spec = match[1];
            if (!spec) continue;
            specs.push(spec);
        }
    }

    return specs;
}

function extractRelativeImports(source) {
    return extractImportSpecifiers(source).filter((specifier) => specifier.startsWith('.'));
}

function resolveImportWithSuffixes(base) {
    const tried = [];

    for (const suffix of IMPORT_SUFFIXES) {
        const candidate = path.resolve(`${base}${suffix}`);
        tried.push(candidate);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }

    for (const suffix of IMPORT_SUFFIXES.filter(Boolean)) {
        const candidate = path.resolve(path.join(base, `index${suffix}`));
        tried.push(candidate);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }

    return null;
}

function resolveLocalImport(input, maybeSpecifier, maybeSourceRoot) {
    const fromFileAbs = typeof input === 'string' ? input : input?.fromFileAbs;
    const specifier = typeof input === 'string' ? maybeSpecifier : input?.specifier;
    const sourceRoot = typeof input === 'string' ? maybeSourceRoot : input?.sourceRoot;
    if (!specifier) return null;
    const fromDir = path.dirname(fromFileAbs);

    if (specifier.startsWith('.')) {
        const relativeBase = path.resolve(fromDir, specifier);
        return resolveImportWithSuffixes(relativeBase);
    }

    if (specifier.startsWith('@/')) {
        const aliasBase = path.resolve(sourceRoot, specifier.slice(2));
        return resolveImportWithSuffixes(aliasBase);
    }

    return null;
}

function buildImportGraph({ rootDir, sourceRoot }) {
    const files = walkFiles(rootDir, SOURCE_EXTS);
    const fileSet = new Set(files.map((value) => path.resolve(value)));
    const graph = new Map();

    for (const filePath of fileSet) {
        graph.set(filePath, new Set());
    }

    for (const filePath of fileSet) {
        const source = fs.readFileSync(filePath, 'utf8');
        const imports = extractImportSpecifiers(source);
        const edges = graph.get(filePath);

        for (const specifier of imports) {
            const resolved = resolveLocalImport({
                fromFileAbs: filePath,
                specifier,
                sourceRoot,
            });
            if (!resolved) continue;
            if (!fileSet.has(path.resolve(resolved))) continue;
            edges.add(path.resolve(resolved));
        }
    }

    return { graph, files: [...fileSet] };
}

function traverseReachable(graph, startFile) {
    const visited = new Set();
    if (!graph.has(startFile)) return visited;

    const queue = [startFile];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current)) continue;
        visited.add(current);

        const children = graph.get(current);
        if (!children) continue;
        for (const child of children) {
            if (!visited.has(child)) queue.push(child);
        }
    }

    return visited;
}

function dedupeCalls(calls) {
    const map = new Map();
    for (const call of calls) {
        const key = `${call.method}|${call.path}|${call.source}`;
        if (!map.has(key)) map.set(key, call);
    }
    return [...map.values()];
}

function callSignature(call) {
    return `${call.method}|${call.path}|${call.source}`;
}

function discoverSurfaces({ appRoot, deriveRoute, sourceBaseDir }) {
    const files = walkFiles(appRoot, SOURCE_EXTS);
    const surfaces = [];

    for (const fileAbs of files) {
        const route = deriveRoute(fileAbs);
        if (route == null) continue;
        const rel = path.relative(sourceBaseDir, fileAbs).replace(/\\/g, '/');
        surfaces.push({ route: normalizedPath(route), fileAbs, fileRel: rel });
    }

    return surfaces;
}

function mapSurfacesToCalls({ surfaces, graph, calls }) {
    const callsByFile = new Map();
    for (const call of calls) {
        const current = callsByFile.get(call.sourceAbs) ?? [];
        current.push(call);
        callsByFile.set(call.sourceAbs, current);
    }

    const surfaceMappings = [];
    const usedCallSignatures = new Set();

    for (const surface of surfaces) {
        const reachable = traverseReachable(graph, surface.fileAbs);
        const directCalls = dedupeCalls(callsByFile.get(surface.fileAbs) ?? []).sort((a, b) => {
            const pathSort = a.path.localeCompare(b.path);
            if (pathSort !== 0) return pathSort;
            return a.method.localeCompare(b.method);
        });
        const matchedCalls = [];

        for (const fileAbs of reachable) {
            const fileCalls = callsByFile.get(fileAbs) ?? [];
            matchedCalls.push(...fileCalls);
        }

        const deduped = dedupeCalls(matchedCalls).sort((a, b) => {
            const pathSort = a.path.localeCompare(b.path);
            if (pathSort !== 0) return pathSort;
            return a.method.localeCompare(b.method);
        });

        for (const call of deduped) {
            usedCallSignatures.add(callSignature(call));
        }

        surfaceMappings.push({
            ...surface,
            directCalls,
            calls: deduped,
        });
    }

    return {
        surfaceMappings: surfaceMappings.sort((a, b) => {
            const routeSort = a.route.localeCompare(b.route);
            if (routeSort !== 0) return routeSort;
            return a.fileRel.localeCompare(b.fileRel);
        }),
        usedCallSignatures,
    };
}

function collectReachableCallSignatures({ entryFiles, graph, calls }) {
    const callsByFile = new Map();
    for (const call of calls) {
        const current = callsByFile.get(call.sourceAbs) ?? [];
        current.push(call);
        callsByFile.set(call.sourceAbs, current);
    }

    const signatures = new Set();
    for (const entry of entryFiles) {
        if (!entry) continue;
        const entryAbs = path.resolve(entry);
        if (!graph.has(entryAbs)) continue;
        const reachable = traverseReachable(graph, entryAbs);
        for (const fileAbs of reachable) {
            const fileCalls = callsByFile.get(fileAbs) ?? [];
            for (const call of fileCalls) {
                signatures.add(callSignature(call));
            }
        }
    }
    return signatures;
}

function extractServerRoutes() {
    const appPath = path.join(SERVER_SRC_ROOT, 'app.ts');
    if (!fs.existsSync(appPath)) {
        throw new Error(`Missing server app entry: ${appPath}`);
    }

    const appSource = fs.readFileSync(appPath, 'utf8');
    const routeMounts = new Map();
    for (const match of appSource.matchAll(/apiRoutes\.route\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
        routeMounts.set(match[2], normalizedPath(match[1]));
    }

    const routeVarToFile = new Map();
    for (const routeFile of walkFiles(SERVER_ROUTES_ROOT, ['.ts'])) {
        const source = fs.readFileSync(routeFile, 'utf8');
        const match = source.match(/const\s+([A-Za-z0-9_]+)\s*=\s*new\s+Hono/);
        if (!match) continue;
        routeVarToFile.set(match[1], routeFile);
    }

    const routes = [];
    for (const [routeVar, prefix] of routeMounts.entries()) {
        const routeFile = routeVarToFile.get(routeVar);
        if (!routeFile) continue;
        const source = fs.readFileSync(routeFile, 'utf8');
        const relSource = path.relative(SERVER_ROOT, routeFile).replace(/\\/g, '/');
        const regex = new RegExp(
            routeVar + "\\.(get|post|put|patch|delete|options)\\(\\s*['\"`]([^'\"`]+)['\"`]",
            'g'
        );
        const matches = [];
        for (const match of source.matchAll(regex)) {
            matches.push({
                method: match[1].toUpperCase(),
                suffix: match[2],
                index: match.index ?? 0,
            });
        }

        matches.forEach((entry, idx) => {
            const nextIndex = idx + 1 < matches.length ? matches[idx + 1].index : source.length;
            const slice = source.slice(entry.index, nextIndex);
            const hasOkJson = /c\.json\(\s*\{[\s\S]*?\bok\s*:/.test(slice);
            const fullPath = normalizedPath(entry.suffix === '/' ? prefix : `${prefix}${entry.suffix}`);
            routes.push({
                method: entry.method,
                path: fullPath,
                source: relSource,
                hasOkJson,
            });
        });
    }

    const appRegex = /apiRoutes\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)['"`]/g;
    const appMatches = [];
    for (const match of appSource.matchAll(appRegex)) {
        appMatches.push({
            method: match[1].toUpperCase(),
            path: normalizedPath(match[2]),
            index: match.index ?? 0,
        });
    }
    appMatches.forEach((entry, idx) => {
        const nextIndex = idx + 1 < appMatches.length ? appMatches[idx + 1].index : appSource.length;
        const slice = appSource.slice(entry.index, nextIndex);
        const hasOkJson = /c\.json\(\s*\{[\s\S]*?\bok\s*:/.test(slice);
        routes.push({
            method: entry.method,
            path: entry.path,
            source: path.relative(SERVER_ROOT, appPath).replace(/\\/g, '/'),
            hasOkJson,
        });
    });

    return routes;
}

function compileBackendPattern(pathValue) {
    const escaped = normalizedPath(pathValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const colonReplaced = escaped.replace(/:[A-Za-z0-9_]+/g, '[^/]+');
    const wildcardReplaced = colonReplaced.replace(/\\\*/g, '.+');
    return new RegExp(`^${wildcardReplaced}$`);
}

function buildServerVariants(routes) {
    const variants = [];
    for (const route of routes) {
        const base = normalizedPath(route.path);
        const candidates = new Set([base, normalizedPath(`/api${base}`)]);
        if (base.startsWith('/api/')) {
            const stripped = base.slice('/api'.length);
            candidates.add(stripped.startsWith('/') ? stripped : `/${stripped}`);
        }

        for (const candidate of candidates) {
            variants.push({
                ...route,
                publicPath: candidate,
                pattern: compileBackendPattern(candidate),
            });
        }
    }
    return variants;
}

function extractApiCallsFromSource({
    rootDir,
    platform,
    sourceBaseDir,
    pathNormalizer,
}) {
    const files = walkFiles(rootDir, SOURCE_EXTS);
    const calls = [];

    const apiRegex = new RegExp(
        `\\b(?:api|apiClient)\\.(${CALL_METHODS.join('|')})(?:<[\\s\\S]*?>)?\\s*\\(`,
        'g'
    );
    const fetchRegex = /\bfetch\(\s*/g;
    const fetcherRegex = /\bfetcher\(\s*/g;

    let callIdCounter = 0;

    for (const filePath of files) {
        const source = fs.readFileSync(filePath, 'utf8');
        const sourceRel = path.relative(sourceBaseDir, filePath).replace(/\\/g, '/');

        for (const match of source.matchAll(apiRegex)) {
            const method = String(match[1]).toUpperCase();
            const parsed = parseFirstArgPath(source, (match.index ?? 0) + match[0].length - 1);
            const rawPath = parsed?.raw ?? null;
            const normalized = rawPath ? pathNormalizer(normalizeClientPath(rawPath)) : null;
            if (!normalized) continue;
            calls.push({
                id: `${platform}-${callIdCounter += 1}`,
                platform,
                method,
                path: normalized,
                source: sourceRel,
                sourceAbs: filePath,
            });
        }

        for (const match of source.matchAll(fetchRegex)) {
            const parsed = parseFirstArgPath(source, (match.index ?? 0) + match[0].length - 1);
            const rawPath = parsed?.raw ?? null;
            const normalized = rawPath ? pathNormalizer(normalizeClientPath(rawPath)) : null;
            if (!normalized) continue;
            const method = inferFetchMethod(source, parsed?.nextIndex ?? (match.index ?? 0));
            calls.push({
                id: `${platform}-${callIdCounter += 1}`,
                platform,
                method,
                path: normalized,
                source: sourceRel,
                sourceAbs: filePath,
            });
        }

        for (const match of source.matchAll(fetcherRegex)) {
            const parsed = parseFirstArgPath(source, (match.index ?? 0) + match[0].length - 1);
            const rawPath = parsed?.raw ?? null;
            const normalized = rawPath ? pathNormalizer(normalizeClientPath(rawPath)) : null;
            if (!normalized) continue;
            calls.push({
                id: `${platform}-${callIdCounter += 1}`,
                platform,
                method: 'GET',
                path: normalized,
                source: sourceRel,
                sourceAbs: filePath,
            });
        }
    }

    return calls;
}

function createCallCandidates(callPath) {
    const normalized = normalizedPath(callPath);
    const candidates = new Set([normalized]);
    if (!normalized.startsWith('/api/')) {
        candidates.add(normalizedPath(`/api${normalized}`));
    }
    if (normalized.startsWith('/api/')) {
        const stripped = normalized.slice('/api'.length);
        candidates.add(stripped.startsWith('/') ? stripped : `/${stripped}`);
    }
    return [...candidates];
}

function validateCalls(calls, serverVariants) {
    const issues = [];
    const usage = new Map();

    for (const call of calls) {
        const candidatePaths = createCallCandidates(call.path);
        let matchedByPath = [];
        for (const candidate of candidatePaths) {
            const routeMatches = serverVariants.filter((entry) => entry.pattern.test(candidate));
            matchedByPath = matchedByPath.concat(routeMatches);
        }

        if (matchedByPath.length === 0) {
            issues.push({
                type: 'missing_path',
                message: `${call.source} -> ${call.method} ${call.path} has no matching backend route`,
                call,
            });
            continue;
        }

        const exactMethodMatches = matchedByPath.filter((entry) => entry.method === call.method);
        if (exactMethodMatches.length === 0) {
            const supported = [...new Set(matchedByPath.map((entry) => entry.method))].sort().join(', ');
            issues.push({
                type: 'method_mismatch',
                message: `${call.source} -> ${call.method} ${call.path} method mismatch (supports: ${supported})`,
                call,
            });
            continue;
        }

        for (const match of exactMethodMatches) {
            const usageKey = `${match.method} ${match.path} ${match.source}`;
            usage.set(usageKey, (usage.get(usageKey) ?? 0) + 1);
        }
    }

    return { issues, usage };
}

function renderSurfaceMapping(lines, title, surfaceMappings) {
    lines.push(`## ${title}`);
    lines.push('');

    if (surfaceMappings.length === 0) {
        lines.push('- None');
        lines.push('');
        return;
    }

    for (const surface of surfaceMappings) {
        lines.push(`### ${surface.route}`);
        lines.push('');
        lines.push(`- File: \`${surface.fileRel}\``);
        if (surface.directCalls.length === 0) {
            lines.push('- Direct API calls: none');
        } else {
            lines.push('- Direct API calls:');
            for (const call of surface.directCalls) {
                lines.push(`  - \`${call.method} ${call.path}\` (${call.source})`);
            }
        }

        if (surface.calls.length === 0) {
            lines.push('- Reachable API calls (via imports): none');
            lines.push('');
            continue;
        }

        lines.push('- Reachable API calls (via imports):');
        for (const call of surface.calls) {
            lines.push(`  - \`${call.method} ${call.path}\` (${call.source})`);
        }
        lines.push('');
    }
}

function renderReport({
    serverRoutes,
    mobileCalls,
    adminCalls,
    issues,
    serverRoutesWithoutOkJson,
    serverUnused,
    mobileSurfaceMappings,
    adminSurfaceMappings,
    mobileOrphanCalls,
    adminOrphanCalls,
}) {
    const lines = [];
    lines.push('# Platform Verification Report');
    lines.push('');
    lines.push(`Generated at: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Server routes discovered: ${serverRoutes.length}`);
    lines.push(`- Mobile API calls discovered: ${mobileCalls.length}`);
    lines.push(`- Admin API calls discovered: ${adminCalls.length}`);
    lines.push(`- Contract issues: ${issues.length}`);
    lines.push(`- Server routes missing explicit \`ok\` response shape: ${serverRoutesWithoutOkJson.length}`);
    lines.push(`- Unused server routes (no mobile/admin caller found): ${serverUnused.length}`);
    lines.push(`- Mobile screens discovered: ${mobileSurfaceMappings.length}`);
    lines.push(`- Mobile screens without reachable API calls: ${mobileSurfaceMappings.filter((surface) => surface.calls.length === 0).length}`);
    lines.push(`- Admin pages discovered: ${adminSurfaceMappings.length}`);
    lines.push(`- Admin pages without reachable API calls: ${adminSurfaceMappings.filter((surface) => surface.calls.length === 0).length}`);
    lines.push(`- Mobile orphan API call sites (not reachable from any screen): ${mobileOrphanCalls.length}`);
    lines.push(`- Admin orphan API call sites (not reachable from any page): ${adminOrphanCalls.length}`);
    lines.push('');

    lines.push('## Contract Issues');
    lines.push('');
    if (issues.length === 0) {
        lines.push('- None');
    } else {
        for (const issue of issues.slice(0, 300)) {
            lines.push(`- ${issue.message}`);
        }
        if (issues.length > 300) {
            lines.push(`- ...and ${issues.length - 300} more`);
        }
    }
    lines.push('');

    renderSurfaceMapping(lines, 'Mobile Screen To API Mapping', mobileSurfaceMappings);
    renderSurfaceMapping(lines, 'Admin Page To API Mapping', adminSurfaceMappings);

    lines.push('## Mobile Screens Without API Reachability');
    lines.push('');
    const mobileNoApi = mobileSurfaceMappings.filter((surface) => surface.calls.length === 0);
    if (mobileNoApi.length === 0) {
        lines.push('- None');
    } else {
        for (const surface of mobileNoApi) {
            lines.push(`- \`${surface.route}\` (${surface.fileRel})`);
        }
    }
    lines.push('');

    lines.push('## Admin Pages Without API Reachability');
    lines.push('');
    const adminNoApi = adminSurfaceMappings.filter((surface) => surface.calls.length === 0);
    if (adminNoApi.length === 0) {
        lines.push('- None');
    } else {
        for (const surface of adminNoApi) {
            lines.push(`- \`${surface.route}\` (${surface.fileRel})`);
        }
    }
    lines.push('');

    lines.push('## Orphan API Call Sites');
    lines.push('');
    if (mobileOrphanCalls.length === 0 && adminOrphanCalls.length === 0) {
        lines.push('- None');
    } else {
        if (mobileOrphanCalls.length > 0) {
            lines.push('- Mobile:');
            for (const call of mobileOrphanCalls) {
                lines.push(`  - \`${call.method} ${call.path}\` (${call.source})`);
            }
        }
        if (adminOrphanCalls.length > 0) {
            lines.push('- Admin:');
            for (const call of adminOrphanCalls) {
                lines.push(`  - \`${call.method} ${call.path}\` (${call.source})`);
            }
        }
    }
    lines.push('');

    lines.push('## Server Data Shape Warnings');
    lines.push('');
    if (serverRoutesWithoutOkJson.length === 0) {
        lines.push('- None');
    } else {
        for (const route of serverRoutesWithoutOkJson) {
            lines.push(`- \`${route.method} ${route.path}\` (${route.source})`);
        }
    }
    lines.push('');

    lines.push('## Unused Server Routes');
    lines.push('');
    if (serverUnused.length === 0) {
        lines.push('- None');
    } else {
        for (const route of serverUnused.slice(0, 300)) {
            lines.push(`- \`${route.method} ${route.path}\` (${route.source})`);
        }
        if (serverUnused.length > 300) {
            lines.push(`- ...and ${serverUnused.length - 300} more`);
        }
    }
    lines.push('');

    return `${lines.join('\n')}\n`;
}

function run() {
    if (!fs.existsSync(SERVER_ROOT)) {
        console.error(`[verify-platform-contract] Missing server folder: ${SERVER_ROOT}`);
        process.exit(1);
    }
    if (!fs.existsSync(ADMIN_ROOT)) {
        console.error(`[verify-platform-contract] Missing admin folder: ${ADMIN_ROOT}`);
        process.exit(1);
    }

    const serverRoutes = extractServerRoutes();
    const serverVariants = buildServerVariants(serverRoutes);

    const mobileCalls = extractApiCallsFromSource({
        rootDir: MOBILE_SRC_ROOT,
        platform: 'mobile',
        sourceBaseDir: VAHI_ROOT,
        pathNormalizer: (value) => value,
    });

    const adminCalls = extractApiCallsFromSource({
        rootDir: ADMIN_SRC_ROOT,
        platform: 'admin',
        sourceBaseDir: ADMIN_ROOT,
        pathNormalizer: normalizeAdminCallPath,
    });

    const allCalls = [...mobileCalls, ...adminCalls];
    const { issues, usage } = validateCalls(allCalls, serverVariants);

    const serverRouteUsageKeys = new Set(usage.keys());
    const serverUnused = serverRoutes.filter((route) => {
        const key = `${route.method} ${route.path} ${route.source}`;
        return !serverRouteUsageKeys.has(key);
    });

    const okShapeAllowlist = new Set([
        'GET /health',
        'GET /',
        'OPTIONS /*',
    ]);
    const serverRoutesWithoutOkJson = serverRoutes.filter((route) => {
        if (route.hasOkJson) return false;
        return !okShapeAllowlist.has(`${route.method} ${route.path}`);
    });

    const { graph: mobileGraph } = buildImportGraph({
        rootDir: MOBILE_SRC_ROOT,
        sourceRoot: MOBILE_SRC_ROOT,
    });
    const mobileSurfaces = discoverSurfaces({
        appRoot: MOBILE_APP_ROOT,
        deriveRoute: deriveExpoRouteFromFile,
        sourceBaseDir: VAHI_ROOT,
    });

    const { graph: adminGraph } = buildImportGraph({
        rootDir: ADMIN_SRC_ROOT,
        sourceRoot: ADMIN_SRC_ROOT,
    });
    const adminSurfaces = discoverSurfaces({
        appRoot: ADMIN_APP_ROOT,
        deriveRoute: deriveNextPageRouteFromFile,
        sourceBaseDir: ADMIN_ROOT,
    });

    const mobileSurfaceResult = mapSurfacesToCalls({
        surfaces: mobileSurfaces,
        graph: mobileGraph,
        calls: mobileCalls,
    });

    const adminSurfaceResult = mapSurfacesToCalls({
        surfaces: adminSurfaces,
        graph: adminGraph,
        calls: adminCalls,
    });

    const mobileEntrySignatures = collectReachableCallSignatures({
        entryFiles: [path.join(MOBILE_APP_ROOT, '_layout.tsx')],
        graph: mobileGraph,
        calls: mobileCalls,
    });
    const adminEntrySignatures = collectReachableCallSignatures({
        entryFiles: [path.join(ADMIN_SRC_ROOT, 'lib', 'auth.ts')],
        graph: adminGraph,
        calls: adminCalls,
    });

    const usedMobileSignatures = new Set([
        ...mobileSurfaceResult.usedCallSignatures,
        ...mobileEntrySignatures,
    ]);
    const usedAdminSignatures = new Set([
        ...adminSurfaceResult.usedCallSignatures,
        ...adminEntrySignatures,
    ]);

    const mobileOrphanCalls = dedupeCalls(
        mobileCalls.filter((call) => !usedMobileSignatures.has(callSignature(call)))
    );
    const adminOrphanCalls = dedupeCalls(
        adminCalls.filter((call) => !usedAdminSignatures.has(callSignature(call)))
    );

    const report = renderReport({
        serverRoutes,
        mobileCalls,
        adminCalls,
        issues,
        serverRoutesWithoutOkJson,
        serverUnused,
        mobileSurfaceMappings: mobileSurfaceResult.surfaceMappings,
        adminSurfaceMappings: adminSurfaceResult.surfaceMappings,
        mobileOrphanCalls,
        adminOrphanCalls,
    });

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report, 'utf8');

    if (issues.length > 0) {
        console.error('\n[verify-platform-contract] Contract mismatches found:\n');
        for (const issue of issues.slice(0, 150)) {
            console.error(`- ${issue.message}`);
        }
        if (issues.length > 150) {
            console.error(`- ...and ${issues.length - 150} more`);
        }
        console.error(`\nDetailed report: ${REPORT_PATH}`);
        process.exit(1);
    }

    console.log(
        `[verify-platform-contract] Passed: ${mobileCalls.length} mobile calls + ${adminCalls.length} admin calls validated against ${serverRoutes.length} server routes.`
    );
    console.log(
        `[verify-platform-contract] Coverage: ${mobileSurfaces.length} mobile screens, ${adminSurfaces.length} admin pages, ${mobileOrphanCalls.length + adminOrphanCalls.length} orphan API call sites.`
    );
    console.log(`[verify-platform-contract] Report written: ${REPORT_PATH}`);
}

if (require.main === module) {
    run();
}

module.exports = {
    normalizedPath,
    normalizeClientPath,
    deriveExpoRouteFromFile,
    deriveNextPageRouteFromFile,
    inferFetchMethod,
    compileBackendPattern,
    extractRelativeImports,
    extractImportSpecifiers,
    resolveLocalImport,
};
