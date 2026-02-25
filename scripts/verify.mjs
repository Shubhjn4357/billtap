#!/usr/bin/env node
/**
 * @file verify.mjs
 * @description Production-grade pre-build verification pipeline.
 *
 * Runs every quality gate sequentially, reports per-step timing, detailed errors
 * (with affected file paths), and a final summary table. Exit 0 iff everything passes.
 *
 * Usage:
 *   node ./scripts/verify.mjs
 *   pnpm run verify
 *   npm run verify
 *
 * Steps:
 *  1. TypeScript  — tsc --noEmit
 *  2. Unit Tests  — vitest run (with --reporter=verbose)
 *  3. ESLint      — expo lint (0 errors, 0 warnings)
 *  4. Doctor      — run-doctor.js (Expo project health)
 *  5. Routes      — validate-routes.mjs (client router consistency)
 *  6. API Routes  — validate-api-routes.mjs (client ↔ server contract)
 *  7. Smoke E2E   — smoke-e2e.mjs (live API health)
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── ANSI Colours ───────────────────────────────────────────────────────────────
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    dim:    '\x1b[2m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m',
    cyan:   '\x1b[36m',
    blue:   '\x1b[34m',
    white:  '\x1b[37m',
    bgRed:  '\x1b[41m',
    bgGreen:'\x1b[42m',
};

const c = {
    pass:  (s) => `${C.bold}${C.green}${s}${C.reset}`,
    fail:  (s) => `${C.bold}${C.red}${s}${C.reset}`,
    info:  (s) => `${C.cyan}${s}${C.reset}`,
    dim:   (s) => `${C.dim}${s}${C.reset}`,
    head:  (s) => `${C.bold}${C.white}${s}${C.reset}`,
    warn:  (s) => `${C.yellow}${s}${C.reset}`,
    step:  (s) => `${C.bold}${C.blue}${s}${C.reset}`,
    meta:  (s) => `${C.dim}${C.cyan}${s}${C.reset}`,
};

// ─── Constants ──────────────────────────────────────────────────────────────────

const DIVIDER = `${C.dim}${'─'.repeat(72)}${C.reset}`;
const HEADER   = `${C.bold}${'═'.repeat(72)}${C.reset}`;

const STEPS = [
    {
        id: 'typecheck',
        label: 'TypeScript',
        description: 'Type-checks all source files (no emit)',
        cmd: 'npx tsc --noEmit',
        errorParser: parseTscErrors,
    },
    {
        id: 'test',
        label: 'Unit Tests',
        description: 'Vitest unit test suite',
        cmd: 'npx vitest run --reporter=verbose',
        errorParser: parseVitestErrors,
    },
    {
        id: 'lint',
        label: 'ESLint',
        description: 'Code quality and style (expo lint)',
        cmd: 'npx expo lint',
        errorParser: parseLintErrors,
    },
    {
        id: 'doctor',
        label: 'Expo Doctor',
        description: 'Expo project health (17 checks)',
        cmd: 'node ./scripts/run-doctor.js',
        errorParser: parseDoctorErrors,
    },
    {
        id: 'routes',
        label: 'Router Contracts',
        description: 'Validates Expo Router file ↔ Stack.Screen parity',
        cmd: 'node ./scripts/validate-routes.mjs',
        errorParser: parseRouteErrors,
    },
    {
        id: 'api_routes',
        label: 'API Contracts',
        description: 'Validates client API calls ↔ backend routes',
        cmd: 'node ./scripts/validate-api-routes.mjs',
        errorParser: parseApiRouteErrors,
    },
    {
        id: 'smoke',
        label: 'Smoke E2E',
        description: 'Live API smoke test (auth, billing, reminders)',
        cmd: 'node ./scripts/smoke-e2e.mjs',
        skipInCI: false,
        errorParser: parseSmokeErrors,
    },
];

// ─── Error Parsers ──────────────────────────────────────────────────────────────

/** Parse tsc --noEmit output into items with file + message */
function parseTscErrors(output) {
    const issues = [];
    const regex = /^([^\s(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
    for (const match of output.matchAll(regex)) {
        const [, file, line, col, code, msg] = match;
        issues.push({
            file: path.relative(ROOT, file.replace(/\//g, path.sep)).replace(/\\/g, '/'),
            location: `${line}:${col}`,
            code,
            message: msg.trim(),
        });
    }
    return issues;
}

/** Parse vitest verbose reporter output */
function parseVitestErrors(output) {
    const issues = [];
    const failedSuites = new Set();

    // Capture FAIL lines like "FAIL src/api/__tests__/billService.test.ts"
    for (const match of output.matchAll(/^\s*FAIL\s+(.+\.test\.[jt]sx?)$/gm)) {
        failedSuites.add(match[1].trim());
    }

    // Capture individual test failures
    for (const suite of failedSuites) {
        issues.push({
            file: suite,
            location: '—',
            code: 'TEST_FAIL',
            message: `Test suite failed`,
        });
    }

    // Detailed errors within output
    for (const match of output.matchAll(/^\s+● (.+)$/gm)) {
        const title = match[1].trim();
        const suite = [...failedSuites][0] ?? '(unknown)';
        issues.push({
            file: suite,
            location: '—',
            code: 'ASSERT',
            message: title,
        });
    }

    if (issues.length === 0 && output.includes('FAIL')) {
        issues.push({ file: '(see above)', location: '—', code: 'TEST_FAIL', message: 'One or more tests failed' });
    }

    return issues;
}

/** Parse eslint output */
function parseLintErrors(output) {
    const issues = [];
    let currentFile = '';
    for (const line of output.split('\n')) {
        const fileMatch = line.match(/^([A-Z]:\\|\/\/)?.+\.(ts|tsx|js|jsx)$/);
        if (fileMatch) {
            currentFile = line.trim();
            continue;
        }
        const errorMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(.*)$/);
        if (errorMatch) {
            const [, ln, col, severity, message, rule] = errorMatch;
            issues.push({
                file: path.relative(ROOT, currentFile).replace(/\\/g, '/'),
                location: `${ln}:${col}`,
                code: rule || severity,
                message: message.trim(),
            });
        }
    }
    return issues;
}

/** Parse expo doctor output */
function parseDoctorErrors(output) {
    const issues = [];
    for (const match of output.matchAll(/✖|✗|fail|FAIL[^\n]*/gi)) {
        issues.push({ file: 'expo-doctor', location: '—', code: 'DOCTOR', message: match[0].trim() });
    }
    return issues;
}

/** Parse validate-routes output */
function parseRouteErrors(output) {
    return output.split('\n')
        .filter((l) => l.startsWith('- ') || l.includes('failed'))
        .map((l) => ({ file: 'routes', location: '—', code: 'ROUTE', message: l.replace(/^-\s*/, '').trim() }));
}

/** Parse validate-api-routes output */
function parseApiRouteErrors(output) {
    return output.split('\n')
        .filter((l) => l.startsWith('- '))
        .map((l) => {
            const parts = l.replace('- ', '').split(' uses ');
            return {
                file: parts[0] || '(client)',
                location: '—',
                code: 'API_CONTRACT',
                message: l.replace(/^-\s*/, '').trim(),
            };
        });
}

/** Parse smoke-e2e output */
function parseSmokeErrors(output) {
    return output.split('\n')
        .filter((l) => l.includes('[SMOKE][FAIL]') || l.includes('Error') || l.includes('failed'))
        .map((l) => ({ file: 'smoke-e2e', location: '—', code: 'SMOKE', message: l.trim() }));
}

// ─── Runner ─────────────────────────────────────────────────────────────────────

function runStep(step) {
    const start = Date.now();
    let output = '';
    let exitCode = 0;

    try {
        output = execSync(step.cmd, {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
            maxBuffer: 32 * 1024 * 1024,
        });
    } catch (err) {
        output = (err.stdout ?? '') + (err.stderr ?? '');
        exitCode = err.status ?? 1;
    }

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const passed = exitCode === 0;
    const issues = passed ? [] : step.errorParser(output);

    return { passed, duration, output, issues };
}

// ─── Reporting ──────────────────────────────────────────────────────────────────

function printIssues(issues, output) {
    if (issues.length === 0) {
        // Try to print a snippet of raw output for context
        const lines = output.trim().split('\n').slice(-8);
        for (const line of lines) {
            if (line.trim()) console.log(`  ${c.dim(line)}`);
        }
        return;
    }

    for (const issue of issues.slice(0, 30)) {
        const loc    = issue.location !== '—' ? `:${issue.location}` : '';
        const code   = issue.code ? c.warn(`[${issue.code}]`) : '';
        const file   = c.meta(issue.file + loc);
        const msg    = c.fail(issue.message);
        console.log(`  ${file}  ${code}  ${msg}`);
    }

    if (issues.length > 30) {
        console.log(c.dim(`  … and ${issues.length - 30} more issues (see full output above)`));
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────────

const results = [];
const totalStart = Date.now();

console.log('\n');
console.log(HEADER);
console.log(c.head('  🔬  VAHI PRE-BUILD VERIFICATION PIPELINE'));
console.log(c.dim(`  ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}`));
console.log(HEADER);
console.log('');

for (const step of STEPS) {
    process.stdout.write(`  ${c.step(`[${step.id.toUpperCase().padEnd(12)}]`)}  ${step.description.padEnd(55)}`);

    const result = runStep(step);
    results.push({ step, ...result });

    const badge = result.passed ? c.pass('PASS') : c.fail('FAIL');
    const time  = c.dim(`${result.duration}s`);
    console.log(`${badge}  ${time}`);

    if (!result.passed) {
        console.log('');
        printIssues(result.issues, result.output);
        console.log('');
    }
}

const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(2);
const passed = results.filter((r) => r.passed);
const failed = results.filter((r) => !r.passed);

// ─── Summary Table ────────────────────────────────────────────────────────────

console.log('');
console.log(HEADER);
console.log(c.head('  SUMMARY'));
console.log(DIVIDER);
console.log('');

for (const { step, passed: p, duration, issues } of results) {
    const icon   = p ? c.pass('✔') : c.fail('✗');
    const label  = step.label.padEnd(20);
    const time   = c.dim(`${duration}s`.padStart(7));
    const detail = p
        ? ''
        : c.fail(`  ← ${issues.length} issue${issues.length !== 1 ? 's' : ''}`);
    console.log(`  ${icon}  ${label}  ${time}  ${detail}`);
}

console.log('');
console.log(DIVIDER);

const totLine = `  ${STEPS.length} steps | ${passed.length} passed | ${failed.length} failed | ${totalDuration}s total`;

if (failed.length === 0) {
    console.log(`${C.bgGreen}${C.bold}${totLine.padEnd(73)}${C.reset}`);
    console.log('');
    console.log(`  ${c.pass('✔  All checks passed — safe to build!')}`);
} else {
    console.log(`${C.bgRed}${C.bold}${totLine.padEnd(73)}${C.reset}`);
    console.log('');
    console.log(`  ${c.fail('✗  Verification failed. Fix the issues above before building.')}`);
    console.log('');
    console.log('  Affected checks:');
    for (const { step } of failed) {
        console.log(`    ${c.fail('•')} ${step.label} — ${step.description}`);
    }
}

console.log('');
console.log(HEADER);
console.log('');

process.exit(failed.length > 0 ? 1 : 0);
