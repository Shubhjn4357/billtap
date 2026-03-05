#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const shouldRun =
    process.env.RUNTIME_SMOKE_REQUIRED === 'true'
    || Boolean(process.env.SMOKE_BASE_URL)
    || Boolean(process.env.SMOKE_BEARER_TOKEN);

if (!shouldRun) {
    console.log('[verify:runtime] Skipped (set RUNTIME_SMOKE_REQUIRED=true or SMOKE_BASE_URL to enable).');
    process.exit(0);
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(command, ['run', 'test:runtime:all'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
});

if (result.error) {
    console.error(result.error);
    process.exit(1);
}

process.exit(result.status ?? 1);
