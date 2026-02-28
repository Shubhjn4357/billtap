#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const invokedScriptPath = process.argv[1]
    ? path.resolve(process.argv[1])
    : path.resolve(process.cwd(), 'scripts', 'generate-base64.js');
const scriptDir = path.dirname(invokedScriptPath);
const projectRoot = path.resolve(scriptDir, '..');
const envFilePath = path.join(projectRoot, '.env');
const defaultKeystorePath = path.join(projectRoot, 'android', 'app', 'release.keystore');

function exitWithError(message) {
    console.error(`\n[generate-base64] ${message}`);
    process.exit(1);
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        stdio: 'pipe',
        shell: false,
        encoding: 'utf8',
        ...options,
    });

    if (result.error) {
        throw result.error;
    }
    if ((result.status ?? 1) !== 0) {
        const stderr = (result.stderr || '').trim();
        const stdout = (result.stdout || '').trim();
        throw new Error(stderr || stdout || `${command} exited with code ${result.status}`);
    }

    return result;
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
        const value = rawValue.replace(/^['"]|['"]$/g, '');
        output[key] = value;
    }

    return output;
}

function upsertEnvVar(content, key, value) {
    const safeValue = String(value).replace(/"/g, '\\"');
    const line = `${key}="${safeValue}"`;
    const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');

    if (pattern.test(content)) {
        return content.replace(pattern, line);
    }

    const suffix = content.endsWith('\n') ? '' : '\n';
    return `${content}${suffix}${line}\n`;
}

function getConfig(envMap, key, fallback = '') {
    return process.env[key] || envMap[key] || fallback;
}

function copyToClipboard(value) {
    const platforms = [
        {
            condition: process.platform === 'win32',
            command: 'clip',
            args: [],
        },
        {
            condition: process.platform === 'darwin',
            command: 'pbcopy',
            args: [],
        },
        {
            condition: process.platform === 'linux',
            command: 'xclip',
            args: ['-selection', 'clipboard'],
        },
        {
            condition: process.platform === 'linux',
            command: 'wl-copy',
            args: [],
        },
    ];

    for (const tool of platforms) {
        if (!tool.condition) continue;
        try {
            run(tool.command, tool.args, { input: value });
            return true;
        } catch (_) {
            // Try next clipboard tool.
        }
    }

    return false;
}

if (!fs.existsSync(envFilePath)) {
    exitWithError(`.env not found at ${envFilePath}`);
}

const envText = fs.readFileSync(envFilePath, 'utf8');
const envMap = parseEnvFile(envText);

const keystorePassword = getConfig(envMap, 'ANDROID_KEYSTORE_PASSWORD');
const keyAlias = getConfig(envMap, 'ANDROID_KEY_ALIAS');
const keyPassword = getConfig(envMap, 'ANDROID_KEY_PASSWORD');
const keyDname = getConfig(envMap, 'ANDROID_KEY_DNAME', 'CN=Vahi,O=Vahi,C=IN');
const keyAlg = getConfig(envMap, 'ANDROID_KEY_ALG', 'RSA');
const keySize = getConfig(envMap, 'ANDROID_KEY_SIZE', '2048');
const keyValidity = getConfig(envMap, 'ANDROID_KEY_VALIDITY_DAYS', '10000');
const keystorePath = path.resolve(projectRoot, getConfig(envMap, 'ANDROID_KEYSTORE_PATH', defaultKeystorePath));

if (!keystorePassword) exitWithError('ANDROID_KEYSTORE_PASSWORD is required in .env');
if (!keyAlias) exitWithError('ANDROID_KEY_ALIAS is required in .env');
if (!keyPassword) exitWithError('ANDROID_KEY_PASSWORD is required in .env');

fs.mkdirSync(path.dirname(keystorePath), { recursive: true });

const keystoreExists = fs.existsSync(keystorePath);
if (!keystoreExists) {
    console.log('[generate-base64] Keystore not found. Generating non-interactive keystore...');
    try {
        run('keytool', [
            '-genkeypair',
            '-noprompt',
            '-storetype',
            'PKCS12',
            '-keystore',
            keystorePath,
            '-alias',
            keyAlias,
            '-storepass',
            keystorePassword,
            '-keypass',
            keyPassword,
            '-dname',
            keyDname,
            '-keyalg',
            keyAlg,
            '-keysize',
            String(keySize),
            '-validity',
            String(keyValidity),
        ]);
    } catch (error) {
        exitWithError(`Keystore generation failed: ${error.message}`);
    }
} else {
    console.log(`[generate-base64] Reusing existing keystore at ${keystorePath}`);
}

if (!fs.existsSync(keystorePath)) {
    exitWithError(`Keystore file missing after generation step: ${keystorePath}`);
}

const base64Value = fs.readFileSync(keystorePath).toString('base64');
const updatedEnv = upsertEnvVar(envText, 'ANDROID_KEYSTORE_BASE64', base64Value);
fs.writeFileSync(envFilePath, updatedEnv, 'utf8');
process.env.ANDROID_KEYSTORE_BASE64 = base64Value;

let sha1 = '';
let sha256 = '';
try {
    const listResult = run('keytool', [
        '-list',
        '-v',
        '-keystore',
        keystorePath,
        '-storepass',
        keystorePassword,
        '-alias',
        keyAlias,
    ]);
    const output = `${listResult.stdout}\n${listResult.stderr}`;
    const sha1Match = output.match(/SHA1:\s*([A-F0-9:]+)/i);
    const sha256Match = output.match(/SHA256:\s*([A-F0-9:]+)/i);
    sha1 = sha1Match ? sha1Match[1] : '';
    sha256 = sha256Match ? sha256Match[1] : '';
} catch (_) {
    // Non-fatal: base64 flow succeeded.
}

const copied = copyToClipboard(base64Value);

console.log('\n[generate-base64] Success');
console.log(`- .env updated with ANDROID_KEYSTORE_BASE64 (length: ${base64Value.length})`);
console.log(`- keystore: ${keystorePath}`);
if (sha1) console.log(`- SHA1: ${sha1}`);
if (sha256) console.log(`- SHA256: ${sha256}`);
console.log(copied ? '- base64 copied to clipboard' : '- clipboard copy skipped (no clipboard tool found)');
