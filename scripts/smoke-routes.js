#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appDir = path.join(projectRoot, 'src', 'app');

const normalize = (value) => value.replace(/\\/g, '/');

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
    const rel = normalize(path.relative(appDir, filePath));
    const noExt = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
    const parts = noExt.split('/').filter(Boolean);
    if (parts.at(-1) === '_layout') return null;
    const cleaned = parts.filter((part) => !/^\(.*\)$/.test(part));
    if (cleaned.at(-1) === 'index') cleaned.pop();
    return cleaned.length ? `/${cleaned.join('/')}` : '/';
}

const files = walkFiles(appDir);
const routes = new Set(
    files
        .map((filePath) => toRoutePath(filePath))
        .filter(Boolean)
);

const requiredRoutes = [
    '/',
    '/login',
    '/business-select',
    '/billing',
    '/inventory',
    '/accounts',
    '/reports',
    '/settings',
    '/legal',
    '/legal/privacy',
    '/legal/terms',
    '/legal/changelog',
];

const issues = [];
for (const route of requiredRoutes) {
    if (!routes.has(route)) {
        issues.push(`Missing required route: ${route}`);
    }
}

const mainLayoutPath = path.join(appDir, '(main)', '_layout.tsx');
if (fs.existsSync(mainLayoutPath)) {
    const mainLayout = fs.readFileSync(mainLayoutPath, 'utf8');
    const expectedMainTabs = ['index', 'billing', 'inventory', 'accounts', 'reports', 'settings'];
    for (const tab of expectedMainTabs) {
        if (!new RegExp(`<Tabs\\.Screen\\s+name="${tab}"`).test(mainLayout)) {
            issues.push(`Main tabs layout missing Tabs.Screen "${tab}".`);
        }
    }
} else {
    issues.push('Missing main tabs layout: src/app/(main)/_layout.tsx');
}

const authLayoutPath = path.join(appDir, '(auth)', '_layout.tsx');
if (fs.existsSync(authLayoutPath)) {
    const authLayout = fs.readFileSync(authLayoutPath, 'utf8');
    const expectedAuthScreens = ['login', 'business-select'];
    for (const screen of expectedAuthScreens) {
        if (!new RegExp(`<Stack\\.Screen\\s+name="${screen}"`).test(authLayout)) {
            issues.push(`Auth layout missing Stack.Screen "${screen}".`);
        }
    }
} else {
    issues.push('Missing auth layout: src/app/(auth)/_layout.tsx');
}

const rootIndexPath = path.join(appDir, 'index.tsx');
if (fs.existsSync(rootIndexPath)) {
    const rootIndexSource = fs.readFileSync(rootIndexPath, 'utf8');
    const expectedRedirectTargets = ['/(auth)/login', '/(auth)/business-select', '/(main)'];
    for (const target of expectedRedirectTargets) {
        if (!rootIndexSource.includes(target)) {
            issues.push(`Root index does not reference expected target "${target}".`);
        }
    }
} else {
    issues.push('Missing root index route: src/app/index.tsx');
}

if (issues.length > 0) {
    console.error('\nRoute smoke failed:\n');
    for (const issue of issues) {
        console.error(`- ${issue}`);
    }
    process.exit(1);
}

console.log(`Route smoke passed (${requiredRoutes.length} required routes + auth/main navigation checks).`);
