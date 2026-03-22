#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';
const rootDir = path.resolve(__dirname, '..');
const artifactDir = path.resolve(rootDir, '..', 'output', 'playwright');
const session = 'vahi-manual-qa';
const webPort = 19008;
const baseUrl = `http://localhost:${webPort}`;
const expoLogPath = path.join(artifactDir, 'manual-web-qa-expo.log');
const expoErrPath = path.join(artifactDir, 'manual-web-qa-expo.err.log');
const qaScriptPath = path.join(artifactDir, 'manual-web-qa-run.js');
const stepLogPath = path.join(artifactDir, 'manual-web-qa-steps.log');
const summaryPath = path.join(artifactDir, 'manual-web-qa-summary.json');

const authSnapshot = {
  user: {
    id: 'usr_WmKV712jOT2TWZ8dQY',
    googleSub: 'usr_WmKV712jOT2TWZ8dQY',
    name: 'Shubham Jain',
    email: 'shubh.com.in@gmail.com',
    phone: null,
    photoUrl: null,
    isDisabled: false,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  business: {
    id: 'biz_CeGfHb-5aEeKXTRbSN',
    ownerUserId: 'usr_WmKV712jOT2TWZ8dQY',
    name: 'Shubham Business',
    legalName: null,
    address: null,
    state: null,
    city: null,
    pincode: null,
    gstin: null,
    pan: null,
    booksStartDate: null,
    openingCashInHand: 0,
    openingCashInBank: 0,
    logoUrl: null,
    phone: null,
    email: 'shubh.com.in@gmail.com',
    currency: 'INR',
    category: null,
    code: 'biz_CeGfHb-5aEeKXTRbSN',
    isActive: true,
    settings: {},
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  subscription: {
    id: 'sub_biz_CeGfHb-5aEeKXTRbSN',
    businessId: 'biz_CeGfHb-5aEeKXTRbSN',
    tier: 'FREE',
    billingCycle: null,
    status: 'ACTIVE',
    startDate: '2026-03-10T00:00:00.000Z',
    endDate: null,
    nextRenewalDate: null,
    renewsAt: null,
    graceEndDate: null,
    maxBillsTotal: null,
    maxBillsPerMonth: null,
    maxStaffUsers: null,
    maxBusinesses: null,
    maxDevices: null,
    maxStorageMb: null,
    monthlyInvoiceCount: 0,
    offlineOnly: false,
    cloudSyncAllowed: true,
    webDashboardAllowed: true,
    featureFlagsEnabled: [],
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  organizationRole: 'owner',
};

const routeScreens = [
  ['auth', '/login'],
  ['dashboard', '/'],
  ['billing', '/billing'],
  ['inventory', '/inventory'],
  ['accounts', '/accounts'],
  ['reports', '/reports'],
  ['more', '/more'],
  ['settings', '/more/settings'],
  ['sync', '/more/sync'],
];

fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(stepLogPath, '', 'utf8');

function logStep(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(stepLogPath, line);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCli(args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const result = isWindows
    ? spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          [
            "$ErrorActionPreference = 'Stop'",
            '$cliArgs = @(',
            ['--yes', '--package', '@playwright/cli', 'playwright-cli', ...args]
              .map((arg) => `  '${String(arg).replace(/'/g, "''")}'`)
              .join(",\n"),
            ')',
            `& '${npxCmd.replace(/'/g, "''")}' @cliArgs`,
          ].join('\n'),
        ],
        {
          cwd: rootDir,
          encoding: 'utf8',
          stdio: 'pipe',
          env: process.env,
          shell: false,
          windowsHide: true,
          timeout: timeoutMs,
        }
      )
    : spawnSync(npxCmd, ['--yes', '--package', '@playwright/cli', 'playwright-cli', ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: 'pipe',
        env: process.env,
        shell: false,
        timeout: timeoutMs,
      });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error((result.stderr || result.stdout || `playwright-cli ${args.join(' ')} failed`).trim());
  }

  return (result.stdout || '').trim();
}

async function terminateProcessTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  if (isWindows && child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      encoding: 'utf8',
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
      timeout: 30000,
    });
    return;
  }

  child.kill('SIGTERM');
  await sleep(1000);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Timed out fetching ${url}`));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await httpGet(url);
      if (response.statusCode >= 200 && response.statusCode < 500) {
        return response;
      }
      lastError = new Error(`Unexpected status ${response.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(5000);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function buildQaScriptSource() {
  return `
(async () => {
const base = ${JSON.stringify(baseUrl)};
const screenshotRoot = ${JSON.stringify(artifactDir.replace(/\\\\/g, '/'))};
const snapshot = ${JSON.stringify(authSnapshot)};
const routeScreens = ${JSON.stringify(routeScreens)};

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate((data) => {
  localStorage.removeItem("secure_store_fallback:vahi_auth_token");
  localStorage.setItem("secure_store_fallback:vahi_business_id", data.business.id);
  localStorage.setItem("secure_store_fallback:vahi_auth_snapshot_v1", JSON.stringify(data));
}, snapshot);

for (const scheme of ["light", "dark"]) {
  await page.emulateMedia({ colorScheme: scheme });
  for (const [name, route] of routeScreens) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: screenshotRoot + "/manual-" + name + "-" + scheme + ".png",
      fullPage: true,
    });
  }
}

await page.emulateMedia({ colorScheme: "light" });
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.mouse.click(34, 92);
await page.waitForTimeout(800);
await page.screenshot({
  path: screenshotRoot + "/manual-drawer-open-light.png",
  fullPage: true,
});
await page.locator("text=Navigate faster").waitFor({ state: "visible", timeout: 5000 });
await page.locator("text=Billing").nth(0).click();
await page.waitForTimeout(2000);
const afterDrawerNav = page.url();
await page.goBack();
await page.waitForTimeout(1500);
const afterBack = page.url();
await page.goForward();
await page.waitForTimeout(1500);
const afterForward = page.url();
return JSON.stringify({ afterDrawerNav, afterBack, afterForward });
})()
`;
}

function createQaScriptRunner(filePath) {
  return `eval(require("fs").readFileSync(${JSON.stringify(filePath.replace(/\\\\/g, '/'))},"utf8"))`;
}

async function main() {
  logStep('start');
  const logStream = fs.createWriteStream(expoLogPath, { flags: 'w' });
  const errStream = fs.createWriteStream(expoErrPath, { flags: 'w' });
  const expo = spawn(
    pnpmCmd,
    ['exec', 'expo', 'start', '--web', '--clear', '--port', String(webPort), '--host', 'localhost'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        CI: process.env.CI ?? '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
      windowsHide: true,
    }
  );

  expo.stdout.pipe(logStream);
  expo.stderr.pipe(errStream);

  const shutdown = async () => {
    try {
      runCli([`-s=${session}`, 'close']);
    } catch {}
    await terminateProcessTree(expo);
  };

  const exitHandler = () => {
    void shutdown();
  };
  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);

  try {
    logStep('waiting for expo web server');
    await waitForServer(`${baseUrl}/login`, 8 * 60 * 1000);
    logStep('expo web server ready');

    try {
      logStep('closing previous playwright session');
      runCli([`-s=${session}`, 'close']);
    } catch {}
    try {
      logStep('deleting previous playwright session data');
      runCli([`-s=${session}`, 'delete-data']);
    } catch {}

    fs.writeFileSync(qaScriptPath, buildQaScriptSource(), 'utf8');
    logStep('qa script file written');

    logStep('opening playwright browser session');
    runCli([`-s=${session}`, 'open', `${baseUrl}/login`], { timeoutMs: 5 * 60 * 1000 });
    logStep('playwright browser session opened');
    logStep('running playwright qa script');
    const navJson = runCli([`-s=${session}`, 'run-code', createQaScriptRunner(qaScriptPath)], {
      timeoutMs: 12 * 60 * 1000,
    });
    logStep('playwright qa script finished');
    logStep('collecting browser console warnings');
    const consoleOutput = runCli([`-s=${session}`, 'console', 'warning'], {
      timeoutMs: 60 * 1000,
    });
    logStep('browser console warnings collected');

    fs.writeFileSync(summaryPath, JSON.stringify({
      navigation: navJson,
      consoleWarnings: consoleOutput,
      screenshots: routeScreens.flatMap(([name]) => [
        `manual-${name}-light.png`,
        `manual-${name}-dark.png`,
      ]).concat(['manual-drawer-open-light.png']),
    }, null, 2), 'utf8');

    console.log('Manual web QA screenshots generated in output/playwright/.');
    console.log(navJson);
    if (consoleOutput) {
      console.log('--- Console ---');
      console.log(consoleOutput);
    }
  } finally {
    logStep('shutdown');
    await shutdown();
    process.off('SIGINT', exitHandler);
    process.off('SIGTERM', exitHandler);
    logStream.end();
    errStream.end();
  }
}

main().catch((error) => {
  console.error('[manual-web-qa] failed');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
