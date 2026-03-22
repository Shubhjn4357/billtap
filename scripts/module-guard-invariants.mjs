#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const itemsRoute = read('src/routes/items.ts');
assert(itemsRoute.includes("assertModuleEnabled(business, 'inventory')"), 'Items route must use the inventory module guard.');
assert(!itemsRoute.includes("assertModuleEnabled(business, 'stock')"), 'Items route still references the legacy stock module key.');

const accountingRoute = read('src/routes/accounting.ts');
assert(accountingRoute.includes("assertModuleEnabled(business, 'accounts')"), 'Accounting route must use the accounts module guard.');
assert(!accountingRoute.includes("assertModuleEnabled(business, 'accounting')"), 'Accounting route still references the legacy accounting module key.');

const godownsRoute = read('src/routes/godowns.ts');
assert(godownsRoute.includes("'MULTI_GODOWN'"), 'Godowns route must enforce the MULTI_GODOWN feature flag.');
assert(godownsRoute.includes("assertModuleEnabled(business, 'inventory')"), 'Godowns route must use the inventory module guard.');

const operationsRoute = read('src/routes/operations.ts');
assert(operationsRoute.includes("assertModuleEnabled(business, 'operations')"), 'Operations route must use the operations module guard.');
assert(!operationsRoute.includes("assertModuleEnabled(business, 'settings')"), 'Operations route still references the settings module key.');

console.log('[module-guard-invariants] Route/module guard invariants passed.');
