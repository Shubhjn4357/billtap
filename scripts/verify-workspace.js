#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const isWin = process.platform === 'win32';

function runStep({ name, command, args, cwd }) {
    const pretty = `${command} ${args.join(' ')}`.trim();
    console.log(`\n[${name}] ${pretty}`);

    const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: isWin,
        env: process.env,
    });

    if (result.error) {
        console.error(`[${name}] failed: ${result.error.message}`);
        process.exit(1);
    }

    if ((result.status ?? 1) !== 0) {
        console.error(`[${name}] exited with ${result.status ?? 1}`);
        process.exit(result.status ?? 1);
    }
}

const vahiRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(vahiRoot, '..');
const serverRoot = path.join(workspaceRoot, 'server');
const adminRoot = path.join(workspaceRoot, 'admin');

runStep({
    name: 'vahi:verify:ci',
    command: isWin ? 'pnpm.cmd' : 'pnpm',
    args: ['run', 'verify:ci'],
    cwd: vahiRoot,
});

runStep({
    name: 'server:typecheck',
    command: isWin ? 'npm.cmd' : 'npm',
    args: ['run', 'typecheck'],
    cwd: serverRoot,
});

runStep({
    name: 'admin:verify',
    command: isWin ? 'node.exe' : 'node',
    args: ['./scripts/verify.mjs'],
    cwd: adminRoot,
});

console.log('\n[verify-workspace] All workspace verification checks passed.');
