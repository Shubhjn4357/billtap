#!/usr/bin/env node

/* global __dirname, Buffer */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const isWin = process.platform === 'win32';
const pnpmCmd = isWin ? 'pnpm.cmd' : 'pnpm';
const smokeTimeoutMs = Number(process.env.SMOKE_WEB_TIMEOUT_MS ?? 15 * 60 * 1000);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWin,
    timeout: smokeTimeoutMs,
    env: {
      ...process.env,
      CI: process.env.CI ?? '1',
    },
  });

  if (result.error) {
    console.error('[smoke:web] Failed to execute command:', result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertFileExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    console.error(`[smoke:web] ${message}: ${filePath}`);
    process.exit(1);
  }
}

function runSmokeWeb() {
  console.log('[smoke:web] Building Expo web bundle...');
  run(pnpmCmd, ['exec', 'expo', 'export', '--platform', 'web', '--clear']);

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  assertFileExists(distDir, 'Missing dist output directory');
  assertFileExists(indexHtmlPath, 'Missing index.html output');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  if (!indexHtml.includes('<!DOCTYPE html>')) {
    console.error('[smoke:web] Generated index.html does not look valid.');
    process.exit(1);
  }

  const topLevelFiles = fs.readdirSync(distDir);
  const hasExpoAssetDir = topLevelFiles.some((entry) => entry.startsWith('_expo'));
  if (!hasExpoAssetDir) {
    console.error('[smoke:web] Missing _expo assets directory in web export.');
    process.exit(1);
  }

  console.log('[smoke:web] Passed: web export generated successfully.');
}

runSmokeWeb();
