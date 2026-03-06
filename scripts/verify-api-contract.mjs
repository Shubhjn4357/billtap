import fs from "node:fs";
import path from "node:path";

const ADMIN_ROOT = process.cwd();
const SERVER_ADMIN_ROUTE_FILE = path.resolve(ADMIN_ROOT, "../server/src/routes/admin.ts");
const ADMIN_SRC_ROOT = path.resolve(ADMIN_ROOT, "src");

const readIfExists = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
};

const normalizeClientPath = (raw) => (
    raw
        .replace(/\$\{[^}]+\}/g, ":param")
        .replace(/\?.*$/, "")
        .replace(/\/+/g, "/")
);

const routePatternToRegex = (route) => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withParams = escaped.replace(/:[A-Za-z0-9_]+/g, "[^/]+");
    return new RegExp(`^${withParams}$`);
};

const collectFiles = (dir) => {
    const files = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(absolute);
                continue;
            }
            if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(absolute);
        }
    }
    return files;
};

const extractServerRoutes = (source) => {
    const routes = [];
    const matcher = /adminRoute\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,/g;
    for (const match of source.matchAll(matcher)) {
        const method = match[1].toUpperCase();
        const subPath = match[2];
        routes.push({
            method,
            path: `/admin${subPath}`,
            regex: routePatternToRegex(`/admin${subPath}`),
        });
    }
    return routes;
};

const extractClientRoutes = (source, filePath) => {
    const routes = [];
    const matcher = /api\.(get|post|put|patch|delete)(?:<[\s\S]*?>)?\(\s*(`[^`]+`|'[^']+'|"[^"]+")/g;
    for (const match of source.matchAll(matcher)) {
        const method = match[1].toUpperCase();
        const rawLiteral = match[2];
        const literal = rawLiteral.slice(1, -1);
        if (!literal.startsWith("/admin/")) continue;
        routes.push({
            method,
            path: normalizeClientPath(literal),
            filePath,
        });
    }
    return routes;
};

const serverSource = readIfExists(SERVER_ADMIN_ROUTE_FILE);
if (!serverSource) {
    console.log("[verify-api-contract] server admin route file not found, skipping.");
    process.exit(0);
}

const serverRoutes = extractServerRoutes(serverSource);
const appFiles = collectFiles(ADMIN_SRC_ROOT);
const clientRoutes = appFiles.flatMap((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    return extractClientRoutes(content, path.relative(ADMIN_ROOT, filePath));
});

const missing = [];
for (const clientRoute of clientRoutes) {
    const matched = serverRoutes.some((serverRoute) => (
        serverRoute.method === clientRoute.method
        && serverRoute.regex.test(clientRoute.path)
    ));
    if (!matched) {
        missing.push(clientRoute);
    }
}

if (missing.length > 0) {
    console.error("[verify-api-contract] Missing server routes for admin client calls:");
    for (const entry of missing) {
        console.error(`  - ${entry.method} ${entry.path} (${entry.filePath})`);
    }
    process.exit(1);
}

console.log(`[verify-api-contract] PASS (${clientRoutes.length} client routes matched).`);
