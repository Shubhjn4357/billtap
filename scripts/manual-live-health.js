#!/usr/bin/env node

/* global __dirname, Buffer */
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const fs = require('node:fs');

const envPath = path.resolve(__dirname, '..', '.env');
const envRaw = fs.readFileSync(envPath, 'utf8');
const apiLine = envRaw
  .split(/\r?\n/)
  .find((line) => line.startsWith('EXPO_PUBLIC_API_BASE_URL='));

if (!apiLine) {
  console.error('[manual-live-health] EXPO_PUBLIC_API_BASE_URL is not configured in vahi/.env');
  process.exit(1);
}

const apiBaseUrl = apiLine.slice('EXPO_PUBLIC_API_BASE_URL='.length).trim().replace(/\/+$/, '');
const healthUrl = `${apiBaseUrl}/health`;

function request(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(url, (res) => {
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
    req.setTimeout(15000, () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
  });
}

request(healthUrl)
  .then((result) => {
    console.log(JSON.stringify({ url: healthUrl, ...result }, null, 2));
    if (result.statusCode < 200 || result.statusCode >= 300) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('[manual-live-health] failed');
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  });
