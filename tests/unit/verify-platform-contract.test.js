const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
    normalizedPath,
    normalizeClientPath,
    deriveExpoRouteFromFile,
    deriveNextPageRouteFromFile,
    inferFetchMethod,
    compileBackendPattern,
    getServerRouteClassification,
    extractRelativeImports,
    resolveLocalImport,
} = require('../../scripts/verify-platform-contract');

test('normalizedPath keeps leading slash and removes trailing slash', () => {
    assert.equal(normalizedPath('api/users/me/'), '/api/users/me');
    assert.equal(normalizedPath('/'), '/');
});

test('normalizeClientPath handles absolute URL and template placeholders', () => {
    assert.equal(normalizeClientPath('https://api.vahi.app/api/users/me?x=1'), '/api/users/me');
    assert.equal(normalizeClientPath(':param/auth/google'), '/auth/google');
    assert.equal(normalizeClientPath('/:param/admin/overview'), '/admin/overview');
});

test('deriveExpoRouteFromFile maps expo app files to routes', () => {
    const sample = path.join('D:', 'repo', 'vahi', 'src', 'app', '(main)', 'settings', 'account.tsx');
    assert.equal(deriveExpoRouteFromFile(sample), '/settings/account');

    const root = path.join('D:', 'repo', 'vahi', 'src', 'app', 'index.tsx');
    assert.equal(deriveExpoRouteFromFile(root), '/');
});

test('deriveNextPageRouteFromFile maps next page files to routes', () => {
    const sample = path.join('D:', 'repo', 'admin', 'src', 'app', '(dashboard)', 'analytics', 'expenses', 'page.tsx');
    assert.equal(deriveNextPageRouteFromFile(sample), '/analytics/expenses');

    const root = path.join('D:', 'repo', 'admin', 'src', 'app', 'page.tsx');
    assert.equal(deriveNextPageRouteFromFile(root), '/');
});

test('inferFetchMethod falls back to GET and reads explicit method', () => {
    const source = `fetch('/api/hello', { method: 'POST', headers: {} })`;
    const index = source.indexOf('fetch(') + 'fetch('.length;
    assert.equal(inferFetchMethod(source, index), 'POST');

    const source2 = `fetch('/api/hello')`;
    const index2 = source2.indexOf('fetch(') + 'fetch('.length;
    assert.equal(inferFetchMethod(source2, index2), 'GET');
});

test('compileBackendPattern matches dynamic params', () => {
    const pattern = compileBackendPattern('/api/items/:id');
    assert.equal(pattern.test('/api/items/abc123'), true);
    assert.equal(pattern.test('/api/items'), false);
});

test('getServerRouteClassification marks intentional server-only routes', () => {
    const classified = getServerRouteClassification({
        method: 'POST',
        path: '/subscription/webhook',
    });
    assert.equal(classified?.bucket, 'Subscription');

    const unclassified = getServerRouteClassification({
        method: 'GET',
        path: '/admin/unknown',
    });
    assert.equal(unclassified, null);
});

test('extractRelativeImports returns only local import specifiers', () => {
    const source = `
      import React from 'react';
      import { api } from '../api/client';
      export * from './foo';
      const dynamic = import('./bar');
      const pkg = import('zod');
      const req = require('../utils');
    `;

    assert.deepEqual(extractRelativeImports(source), ['../api/client', './foo', './bar', '../utils']);
});

test('resolveLocalImport resolves direct and index files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-platform-contract-'));
    try {
        const fromDir = path.join(tempRoot, 'src', 'screens');
        const targetDir = path.join(tempRoot, 'src', 'shared');
        fs.mkdirSync(fromDir, { recursive: true });
        fs.mkdirSync(targetDir, { recursive: true });

        const fromFile = path.join(fromDir, 'screen.tsx');
        const directFile = path.join(targetDir, 'client.ts');
        const indexDir = path.join(targetDir, 'theme');
        const indexFile = path.join(indexDir, 'index.ts');

        fs.writeFileSync(fromFile, 'export {};\n', 'utf8');
        fs.writeFileSync(directFile, 'export {};\n', 'utf8');
        fs.mkdirSync(indexDir, { recursive: true });
        fs.writeFileSync(indexFile, 'export {};\n', 'utf8');

        const resolvedDirect = resolveLocalImport(fromFile, '../shared/client');
        const resolvedIndex = resolveLocalImport(fromFile, '../shared/theme');

        assert.equal(path.normalize(resolvedDirect), path.normalize(directFile));
        assert.equal(path.normalize(resolvedIndex), path.normalize(indexFile));
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
