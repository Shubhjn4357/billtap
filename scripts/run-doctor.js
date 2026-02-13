#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

// These pnpm-injected vars can cause expo-doctor's dependency check to fail
// with npm config warnings even when dependencies are valid.
delete process.env.npm_config_npm_globalconfig;
delete process.env.npm_config_verify_deps_before_run;
delete process.env.npm_config__jsr_registry;
// Silence npm warn-level noise (e.g. pnpm-only .npmrc keys) that can
// make expo-doctor report false negatives for dependency checks.
process.env.npm_config_loglevel = 'error';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['expo-doctor', '--verbose'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
