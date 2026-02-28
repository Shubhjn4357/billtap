#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_SECRET_KEYS = [
    'ANDROID_KEYSTORE_BASE64',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
    'ANDROID_PACKAGE_NAME',
    'PLAY_SERVICE_ACCOUNT_JSON',
    'EXPO_PUBLIC_API_BASE_URL',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
];

function parseArgs(argv) {
    const options = {
        includeEmpty: false,
        dryRun: false,
        repo: '',
        keys: [...DEFAULT_SECRET_KEYS],
    };

    for (const arg of argv) {
        if (arg === '--include-empty') {
            options.includeEmpty = true;
            continue;
        }
        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (arg.startsWith('--repo=')) {
            options.repo = arg.slice('--repo='.length).trim();
            continue;
        }
        if (arg.startsWith('--keys=')) {
            const rawKeys = arg.slice('--keys='.length).trim();
            if (rawKeys) {
                options.keys = rawKeys.split(',').map((entry) => entry.trim()).filter(Boolean);
            }
            continue;
        }
    }

    return options;
}

function parseEnvFile(content) {
    const output = {};
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;

        const key = match[1];
        const rawValue = match[2] || '';
        output[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }

    return output;
}

function run(command, args, opts = {}) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        shell: false,
        ...opts,
    });
    return result;
}

function ensureGhReady() {
    const ghVersion = run('gh', ['--version'], { stdio: 'pipe' });
    if (ghVersion.error || (ghVersion.status ?? 1) !== 0) {
        throw new Error('GitHub CLI (gh) is not installed or not in PATH.');
    }

    const authStatus = run('gh', ['auth', 'status'], { stdio: 'pipe' });
    if ((authStatus.status ?? 1) !== 0) {
        throw new Error('gh is not authenticated. Run: gh auth login');
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const invokedScriptPath = process.argv[1]
        ? path.resolve(process.argv[1])
        : path.resolve(process.cwd(), 'scripts', 'push-gh-secrets.js');
    const scriptDir = path.dirname(invokedScriptPath);
    const projectRoot = path.resolve(scriptDir, '..');
    const envPath = path.join(projectRoot, '.env');

    if (!fs.existsSync(envPath)) {
        console.error(`[push-gh-secrets] .env not found at ${envPath}`);
        process.exit(1);
    }

    const envText = fs.readFileSync(envPath, 'utf8');
    const envMap = parseEnvFile(envText);

    if (!args.dryRun) {
        try {
            ensureGhReady();
        } catch (error) {
            console.error(`[push-gh-secrets] ${error.message}`);
            process.exit(1);
        }
    }

    let pushed = 0;
    let skipped = 0;
    let failed = 0;

    for (const key of args.keys) {
        const value = process.env[key] ?? envMap[key] ?? '';
        if (!value && !args.includeEmpty) {
            skipped += 1;
            console.log(`[push-gh-secrets] skip ${key} (empty)`);
            continue;
        }

        if (args.dryRun) {
            pushed += 1;
            console.log(`[push-gh-secrets] dry-run set ${key} (length=${value.length})`);
            continue;
        }

        const commandArgs = ['secret', 'set', key];
        if (args.repo) {
            commandArgs.push('--repo', args.repo);
        }

        const result = run('gh', commandArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            input: value,
        });

        if ((result.status ?? 1) !== 0) {
            failed += 1;
            const stderr = (result.stderr || '').trim();
            console.error(`[push-gh-secrets] failed ${key}: ${stderr || `exit ${result.status}`}`);
        } else {
            pushed += 1;
            console.log(`[push-gh-secrets] set ${key} (length=${value.length})`);
        }
    }

    console.log('\n[push-gh-secrets] summary');
    console.log(`- pushed: ${pushed}`);
    console.log(`- skipped: ${skipped}`);
    console.log(`- failed: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

main();
