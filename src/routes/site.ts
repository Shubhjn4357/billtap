import { Hono } from 'hono';
import type { AppEnv } from '../middleware/auth';

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ApiAccess = 'Public' | 'Bearer Token' | 'Developer Admin' | 'Admin' | 'Cron Secret';

type ApiEndpoint = {
    group: string;
    method: ApiMethod;
    path: string;
    access: ApiAccess;
    description: string;
    sampleBody?: Record<string, unknown>;
};

type EndpointPathInfo = {
    normalizedPath: string;
    queryKeys: string[];
};

const API_ENDPOINTS: ApiEndpoint[] = [
    { group: 'System', method: 'GET', path: '/api', access: 'Public', description: 'Health and service metadata.' },
    { group: 'Auth', method: 'POST', path: '/api/auth/google', access: 'Public', description: 'Google sign in.', sampleBody: { idToken: '<google_id_token>' } },
  { group: 'Auth', method: 'POST', path: '/api/auth/firebase', access: 'Public', description: 'Verify Firebase token and get session token.', sampleBody: { idToken: '<firebase_id_token>' } },
    { group: 'Auth', method: 'GET', path: '/api/auth/me', access: 'Bearer Token', description: 'Current authenticated profile.' },
    { group: 'Auth', method: 'PATCH', path: '/api/auth/me', access: 'Bearer Token', description: 'Update own profile.', sampleBody: { displayName: 'New Name' } },
    { group: 'Auth', method: 'POST', path: '/api/auth/logout', access: 'Bearer Token', description: 'Logout current user.' },

    { group: 'Users', method: 'GET', path: '/api/users/me', access: 'Bearer Token', description: 'Current user details.' },
  { group: 'Users', method: 'PATCH', path: '/api/users/me', access: 'Bearer Token', description: 'Update current user.', sampleBody: { businessName: 'Vahi Mart', gstEnabled: true } },

    { group: 'Items', method: 'GET', path: '/api/items?q=&limit=', access: 'Bearer Token', description: 'List items with optional search.' },
    { group: 'Items', method: 'GET', path: '/api/items/{id}', access: 'Bearer Token', description: 'Get item by id.' },
    { group: 'Items', method: 'POST', path: '/api/items', access: 'Bearer Token', description: 'Create item.', sampleBody: { name: 'Item A', price: 100, stock: 10, gstPercentage: 18 } },
    { group: 'Items', method: 'PATCH', path: '/api/items/{id}', access: 'Bearer Token', description: 'Update item.', sampleBody: { stock: 12, autoDeleteEnabled: false } },
    { group: 'Items', method: 'DELETE', path: '/api/items/{id}', access: 'Bearer Token', description: 'Delete item.' },

    { group: 'Parties', method: 'GET', path: '/api/parties?type=&q=', access: 'Bearer Token', description: 'List parties.' },
    { group: 'Parties', method: 'POST', path: '/api/parties', access: 'Bearer Token', description: 'Create party.', sampleBody: { name: 'ABC Traders', type: 'customer', phone: '+919999999999' } },
    { group: 'Parties', method: 'PATCH', path: '/api/parties/{id}', access: 'Bearer Token', description: 'Update party.', sampleBody: { address: 'Delhi' } },

    { group: 'Transactions', method: 'GET', path: '/api/transactions?type=&paymentStatus=&start=&end=&limit=', access: 'Bearer Token', description: 'List sales/purchases.' },
    { group: 'Transactions', method: 'POST', path: '/api/transactions', access: 'Bearer Token', description: 'Create sale/purchase with stock update.', sampleBody: { type: 'SALE', items: [{ id: '<item_id>', name: 'Item A', quantity: 1, price: 100, tax: 18, total: 118 }], totalAmount: 118, paymentMode: 'CREDIT', paidAmount: 0, reminderEnabled: true } },
    { group: 'Transactions', method: 'PATCH', path: '/api/transactions/{id}/payment', access: 'Bearer Token', description: 'Update payment status/reminder.', sampleBody: { paidAmount: 50, reminderEnabled: true, reminderFrequencyDays: 3 } },
    { group: 'Transactions', method: 'GET', path: '/api/transactions/pending-reminders?dueBefore=', access: 'Bearer Token', description: 'Pending reminder candidates.' },

    { group: 'Staff', method: 'POST', path: '/api/staff', access: 'Bearer Token', description: 'Invite/create staff relation.', sampleBody: { phoneNumber: '+919999999999', role: 'staff' } },
    { group: 'Staff', method: 'GET', path: '/api/staff', access: 'Bearer Token', description: 'List staff/invites.' },
    { group: 'Staff', method: 'GET', path: '/api/staff/{uid}', access: 'Bearer Token', description: 'Get staff member.' },
    { group: 'Staff', method: 'PATCH', path: '/api/staff/{uid}', access: 'Bearer Token', description: 'Update staff permissions.', sampleBody: { role: 'staff' } },
    { group: 'Staff', method: 'DELETE', path: '/api/staff/invite/{id}', access: 'Bearer Token', description: 'Delete pending invite.' },
    { group: 'Staff', method: 'DELETE', path: '/api/staff/{uid}', access: 'Bearer Token', description: 'Remove staff member.' },

    { group: 'Subscription', method: 'GET', path: '/api/subscription/plans?includeInactive=', access: 'Public', description: 'Get plans for app.' },
    { group: 'Subscription', method: 'GET', path: '/api/subscription/offers/active', access: 'Public', description: 'Get active offers.' },
    { group: 'Subscription', method: 'POST', path: '/api/subscription/checkout', access: 'Bearer Token', description: 'Create payment intent/checkout.', sampleBody: { planId: 'growth' } },
    { group: 'Subscription', method: 'GET', path: '/api/subscription/intents/{intentId}/status', access: 'Bearer Token', description: 'Get checkout status.' },
    { group: 'Subscription', method: 'POST', path: '/api/subscription/webhook', access: 'Public', description: 'Provider webhook endpoint.' },

    { group: 'Reporting', method: 'GET', path: '/api/reporting/pnl?start=&end=', access: 'Bearer Token', description: 'Profit and loss.' },
    { group: 'Reporting', method: 'GET', path: '/api/reporting/stock-valuation', access: 'Bearer Token', description: 'Inventory valuation.' },
    { group: 'Reporting', method: 'GET', path: '/api/reporting/balance-sheet', access: 'Bearer Token', description: 'Basic balance sheet snapshot.' },
    { group: 'Reporting', method: 'GET', path: '/api/reporting/export/transactions?format=json|csv&type=&start=&end=', access: 'Bearer Token', description: 'Export transactions.' },

    { group: 'Accounting', method: 'GET', path: '/api/accounting/accounts?type=', access: 'Bearer Token', description: 'Chart of accounts.' },
    { group: 'Accounting', method: 'POST', path: '/api/accounting/accounts', access: 'Bearer Token', description: 'Create account.', sampleBody: { code: '7000', name: 'Other Income', type: 'INCOME' } },
    { group: 'Accounting', method: 'POST', path: '/api/accounting/accounts/seed-default', access: 'Bearer Token', description: 'Seed default system accounts.' },
    { group: 'Accounting', method: 'POST', path: '/api/accounting/journals', access: 'Bearer Token', description: 'Post manual journal.', sampleBody: { lines: [{ accountId: '<id>', debit: 100, credit: 0 }, { accountId: '<id2>', debit: 0, credit: 100 }] } },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/trial-balance?start=&end=', access: 'Bearer Token', description: 'Trial balance.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/gst/summary?start=&end=', access: 'Bearer Token', description: 'GST summary by HSN.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/profit-loss?start=&end=', access: 'Bearer Token', description: 'Detailed P&L from journals.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/balance-sheet?asOf=', access: 'Bearer Token', description: 'Detailed balance sheet.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/inventory/valuation', access: 'Bearer Token', description: 'Inventory valuation report.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/inventory/reorder-suggestions', access: 'Bearer Token', description: 'Reorder suggestions.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/inventory/stock-aging', access: 'Bearer Token', description: 'Stock aging buckets.' },
    { group: 'Accounting', method: 'GET', path: '/api/accounting/stock-ledger/{itemId}?limit=', access: 'Bearer Token', description: 'Item stock ledger.' },

    { group: 'Operations', method: 'GET', path: '/api/operations/access-matrix', access: 'Bearer Token', description: 'Role-based access matrix by module.' },
    { group: 'Operations', method: 'GET', path: '/api/operations/controls', access: 'Bearer Token', description: 'Get maker-checker and period lock controls.' },
    { group: 'Operations', method: 'PUT', path: '/api/operations/controls', access: 'Bearer Token', description: 'Update controls (owner/admin).', sampleBody: { makerCheckerEnabled: true, periodLockEnabled: true } },
    { group: 'Operations', method: 'GET', path: '/api/operations/approvals?status=&module=&limit=', access: 'Bearer Token', description: 'List pending/processed approval requests.' },
    { group: 'Operations', method: 'POST', path: '/api/operations/approvals/{id}/approve', access: 'Bearer Token', description: 'Approve maker-checker request.', sampleBody: { note: 'Approved after review' } },
    { group: 'Operations', method: 'POST', path: '/api/operations/approvals/{id}/reject', access: 'Bearer Token', description: 'Reject maker-checker request.', sampleBody: { note: 'Rejected due to mismatch' } },
    { group: 'Operations', method: 'GET', path: '/api/operations/audit-logs?module=&action=&actorUid=&start=&end=&limit=', access: 'Bearer Token', description: 'Audit log explorer.' },
    { group: 'Operations', method: 'GET', path: '/api/operations/periods?limit=', access: 'Bearer Token', description: 'List accounting periods with status.' },
    { group: 'Operations', method: 'POST', path: '/api/operations/periods/lock', access: 'Bearer Token', description: 'Lock accounting period.', sampleBody: { periodStart: '2026-01-01', periodEnd: '2026-01-31', notes: 'January close prep' } },
    { group: 'Operations', method: 'POST', path: '/api/operations/periods/{id}/close', access: 'Bearer Token', description: 'Close locked accounting period.' },
    { group: 'Operations', method: 'POST', path: '/api/operations/periods/{id}/reopen', access: 'Bearer Token', description: 'Reopen closed/locked accounting period.' },

    { group: 'Payroll', method: 'POST', path: '/api/payroll/attendance/check-in', access: 'Bearer Token', description: 'Check-in attendance for staff/user.', sampleBody: { staffUid: '<staff_uid>', branchId: '<branch_id>', shiftName: 'Morning' } },
    { group: 'Payroll', method: 'POST', path: '/api/payroll/attendance/{id}/check-out', access: 'Bearer Token', description: 'Check-out attendance record.', sampleBody: { overtimeMinutes: 45, status: 'present' } },
    { group: 'Payroll', method: 'GET', path: '/api/payroll/attendance?start=&end=&staffUid=&limit=', access: 'Bearer Token', description: 'List attendance records.' },
    { group: 'Payroll', method: 'GET', path: '/api/payroll/components', access: 'Bearer Token', description: 'List payroll components.' },
    { group: 'Payroll', method: 'POST', path: '/api/payroll/components', access: 'Bearer Token', description: 'Create payroll component.', sampleBody: { code: 'PF', name: 'Provident Fund', category: 'deduction', amountType: 'percent', value: 12 } },
    { group: 'Payroll', method: 'POST', path: '/api/payroll/salary-runs/generate', access: 'Bearer Token', description: 'Generate salary run draft.' },
    { group: 'Payroll', method: 'GET', path: '/api/payroll/salary-runs?limit=', access: 'Bearer Token', description: 'List salary runs.' },
    { group: 'Payroll', method: 'GET', path: '/api/payroll/salary-runs/{id}', access: 'Bearer Token', description: 'Get salary run details with staff lines.' },
    { group: 'Payroll', method: 'POST', path: '/api/payroll/salary-runs/{id}/finalize', access: 'Bearer Token', description: 'Finalize salary run and post payroll journal.' },
    { group: 'Payroll', method: 'GET', path: '/api/payroll/salary-runs/{id}/payslip/{staffUid}', access: 'Bearer Token', description: 'Generate payslip payload for a staff member.' },

    { group: 'Treasury', method: 'GET', path: '/api/treasury/bank-accounts', access: 'Bearer Token', description: 'List bank accounts.' },
    { group: 'Treasury', method: 'POST', path: '/api/treasury/bank-accounts', access: 'Bearer Token', description: 'Create bank account.' },
    { group: 'Treasury', method: 'PATCH', path: '/api/treasury/bank-accounts/{id}', access: 'Bearer Token', description: 'Patch bank account.' },
    { group: 'Treasury', method: 'GET', path: '/api/treasury/bank-accounts/{id}/ledger?start=&end=&limit=', access: 'Bearer Token', description: 'Bank ledger entries for account.' },
    { group: 'Treasury', method: 'GET', path: '/api/treasury/vouchers?type=&start=&end=&limit=', access: 'Bearer Token', description: 'List receipt/payment vouchers.' },
    { group: 'Treasury', method: 'POST', path: '/api/treasury/vouchers', access: 'Bearer Token', description: 'Create receipt/payment voucher.' },
    { group: 'Treasury', method: 'GET', path: '/api/treasury/reconciliations?bankAccountId=&limit=', access: 'Bearer Token', description: 'List bank reconciliations.' },
    { group: 'Treasury', method: 'POST', path: '/api/treasury/reconciliations', access: 'Bearer Token', description: 'Create bank reconciliation run.' },
    { group: 'Treasury', method: 'GET', path: '/api/treasury/aging?asOf=', access: 'Bearer Token', description: 'Receivables/payables aging report.' },
    { group: 'Treasury', method: 'GET', path: '/api/treasury/cash-flow?start=&end=', access: 'Bearer Token', description: 'Cash flow statement (vouchers + operating).' },

    { group: 'Organizations', method: 'GET', path: '/api/organizations/mine', access: 'Bearer Token', description: 'List organizations available to current user for company switch.' },
    { group: 'Organizations', method: 'GET', path: '/api/organizations/current?organizationId=', access: 'Bearer Token', description: 'Resolve and return active organization context.' },
    { group: 'Organizations', method: 'POST', path: '/api/organizations', access: 'Bearer Token', description: 'Create store/organization (subscription limits apply).' },
    { group: 'Organizations', method: 'PATCH', path: '/api/organizations/{id}', access: 'Bearer Token', description: 'Patch organization profile details.' },
    { group: 'Organizations', method: 'GET', path: '/api/organizations/settings/current?organizationId=', access: 'Bearer Token', description: 'Get organization-level settings JSON.' },
    { group: 'Organizations', method: 'PUT', path: '/api/organizations/settings/current?organizationId=', access: 'Bearer Token', description: 'Update organization-level settings JSON.' },
    { group: 'Organizations', method: 'GET', path: '/api/organizations/members/current?organizationId=', access: 'Bearer Token', description: 'List organization members and permissions.' },
    { group: 'Organizations', method: 'POST', path: '/api/organizations/members/current?organizationId=', access: 'Bearer Token', description: 'Add staff (creates/links shadow user by phone).' },
    { group: 'Organizations', method: 'PATCH', path: '/api/organizations/members/current/{memberId}?organizationId=', access: 'Bearer Token', description: 'Patch member role/permission toggles.' },
    { group: 'Organizations', method: 'DELETE', path: '/api/organizations/members/current/{memberId}?organizationId=', access: 'Bearer Token', description: 'Deactivate member access.' },
    { group: 'Organizations', method: 'GET', path: '/api/organizations/templates/current?organizationId=', access: 'Bearer Token', description: 'List bill templates.' },
    { group: 'Organizations', method: 'POST', path: '/api/organizations/templates/current?organizationId=', access: 'Bearer Token', description: 'Create bill template.' },
    { group: 'Organizations', method: 'GET', path: '/api/organizations/print-profiles/current?organizationId=', access: 'Bearer Token', description: 'List print profiles.' },
    { group: 'Organizations', method: 'POST', path: '/api/organizations/print-profiles/current?organizationId=', access: 'Bearer Token', description: 'Create print profile.' },
    { group: 'Organizations', method: 'GET', path: '/api/organizations/signatures/current?organizationId=', access: 'Bearer Token', description: 'List uploaded/drawn signatures.' },
    { group: 'Organizations', method: 'POST', path: '/api/organizations/signatures/current?organizationId=', access: 'Bearer Token', description: 'Upload or draw signature.' },
    { group: 'Organizations', method: 'POST', path: '/api/organizations/signatures/current/{id}/default?organizationId=', access: 'Bearer Token', description: 'Set default bill signature.' },
    { group: 'Media', method: 'POST', path: '/api/media/upload-url?organizationId=', access: 'Bearer Token', description: 'Create short-lived upload URL for media assets.' },
    { group: 'Media', method: 'PUT', path: '/api/media/upload?token=', access: 'Public', description: 'Upload binary data using signed upload token.' },
    { group: 'Media', method: 'GET', path: '/api/media/assets?organizationId=&assetType=&entityType=&entityId=&limit=', access: 'Bearer Token', description: 'List media assets for current organization.' },
    { group: 'Media', method: 'GET', path: '/api/media/files/{key}', access: 'Public', description: 'Serve media object from R2 (when public base URL is not configured).' },

    { group: 'Finance Ops', method: 'GET', path: '/api/finance/party-ledger/{partyId}?organizationId=&limit=', access: 'Bearer Token', description: 'Party ledger with running balance.' },
    { group: 'Finance Ops', method: 'GET', path: '/api/finance/party-balances?organizationId=', access: 'Bearer Token', description: 'Party balances with red/green semantics.' },
    { group: 'Finance Ops', method: 'GET', path: '/api/finance/payments?organizationId=&partyId=&start=&end=&limit=', access: 'Bearer Token', description: 'List payment in/out entries.' },
    { group: 'Finance Ops', method: 'POST', path: '/api/finance/payments?organizationId=', access: 'Bearer Token', description: 'Create payment in/out settlement entry.' },
    { group: 'Finance Ops', method: 'POST', path: '/api/finance/party-ledger/adjust?organizationId=', access: 'Bearer Token', description: 'Manual ledger adjustment.' },
    { group: 'Finance Ops', method: 'GET', path: '/api/finance/expenses?organizationId=&start=&end=&category=&limit=', access: 'Bearer Token', description: 'List expenses.' },
    { group: 'Finance Ops', method: 'POST', path: '/api/finance/expenses?organizationId=', access: 'Bearer Token', description: 'Create expense entry.' },

    { group: 'Analytics', method: 'POST', path: '/api/analytics/events', access: 'Bearer Token', description: 'Track analytics event.', sampleBody: { eventType: 'subscription_screen_view', source: 'app' } },
    { group: 'Analytics', method: 'GET', path: '/api/analytics/events?days=', access: 'Admin', description: 'Read analytics event stream.' },

    { group: 'Admin', method: 'GET', path: '/api/admin/access', access: 'Bearer Token', description: 'Check admin access for current principal.' },
    { group: 'Admin', method: 'GET', path: '/api/admin/users?limit=', access: 'Developer Admin', description: 'List users.' },
    { group: 'Admin', method: 'GET', path: '/api/admin/users/{uid}', access: 'Developer Admin', description: 'Get user details.' },
    { group: 'Admin', method: 'PATCH', path: '/api/admin/users/{uid}', access: 'Developer Admin', description: 'Patch user.', sampleBody: { subscriptionStatus: 'active' } },
    { group: 'Admin', method: 'PUT', path: '/api/admin/users/{uid}', access: 'Developer Admin', description: 'Replace user fields.', sampleBody: { role: 'owner' } },
    { group: 'Admin', method: 'PATCH', path: '/api/admin/users/{uid}/role', access: 'Developer Admin', description: 'Set role.', sampleBody: { role: 'admin' } },
    { group: 'Admin', method: 'POST', path: '/api/admin/users/{uid}/subscription', access: 'Developer Admin', description: 'Assign subscription.', sampleBody: { planId: 'growth', status: 'active', durationDays: 30 } },
    { group: 'Admin', method: 'DELETE', path: '/api/admin/users/{uid}', access: 'Developer Admin', description: 'Delete user.' },
    { group: 'Admin', method: 'GET', path: '/api/admin/plans?includeInactive=', access: 'Developer Admin', description: 'List plans.' },
    { group: 'Admin', method: 'GET', path: '/api/admin/plans/{id}', access: 'Developer Admin', description: 'Get plan.' },
    { group: 'Admin', method: 'POST', path: '/api/admin/plans', access: 'Developer Admin', description: 'Create plan.' },
    { group: 'Admin', method: 'PUT', path: '/api/admin/plans/{id}', access: 'Developer Admin', description: 'Upsert plan.' },
    { group: 'Admin', method: 'PATCH', path: '/api/admin/plans/{id}', access: 'Developer Admin', description: 'Patch plan.' },
    { group: 'Admin', method: 'DELETE', path: '/api/admin/plans/{id}', access: 'Developer Admin', description: 'Delete plan.' },
    { group: 'Admin', method: 'GET', path: '/api/admin/offers?includeInactive=', access: 'Developer Admin', description: 'List offers.' },
    { group: 'Admin', method: 'GET', path: '/api/admin/offers/{id}', access: 'Developer Admin', description: 'Get offer.' },
    { group: 'Admin', method: 'POST', path: '/api/admin/offers', access: 'Developer Admin', description: 'Create offer.' },
    { group: 'Admin', method: 'PUT', path: '/api/admin/offers/{id}', access: 'Developer Admin', description: 'Upsert offer.' },
    { group: 'Admin', method: 'PATCH', path: '/api/admin/offers/{id}/active', access: 'Developer Admin', description: 'Toggle active state.', sampleBody: { isActive: true } },
    { group: 'Admin', method: 'PATCH', path: '/api/admin/offers/{id}', access: 'Developer Admin', description: 'Patch offer.' },
    { group: 'Admin', method: 'DELETE', path: '/api/admin/offers/{id}', access: 'Developer Admin', description: 'Delete offer.' },
    { group: 'Admin', method: 'POST', path: '/api/admin/seed/default-plans', access: 'Developer Admin', description: 'Seed default plans.' },

    { group: 'Jobs', method: 'POST', path: '/api/jobs/run-all', access: 'Cron Secret', description: 'Run scheduler tasks manually/cron.' },
];

const splitPathInfo = (path: string): EndpointPathInfo => {
    const [rawPath, rawQuery] = path.split('?');
    if (!rawQuery) {
        return { normalizedPath: rawPath, queryKeys: [] };
    }

    const queryKeys = rawQuery
        .split('&')
        .map((token) => token.split('=')[0]?.trim())
        .filter((key): key is string => Boolean(key));

    return { normalizedPath: rawPath, queryKeys };
};

const accessToSecurity = (access: ApiAccess): Array<Record<string, unknown>> => {
    if (access === 'Public') return [];
    if (access === 'Cron Secret') return [{ cronSecret: [] }];
    return [{ bearerAuth: [] }];
};

const inferRequestBodySchema = (sampleBody?: Record<string, unknown>): Record<string, unknown> => {
    if (!sampleBody) {
        return {
            type: 'object',
            additionalProperties: true,
        };
    }

    return {
        type: 'object',
        example: sampleBody,
        additionalProperties: true,
    };
};

const buildOpenApiSpec = () => {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const entry of API_ENDPOINTS) {
        const { normalizedPath, queryKeys } = splitPathInfo(entry.path);
        const method = entry.method.toLowerCase();
        const existingPath = paths[normalizedPath] ?? {};

        const pathParams = [...normalizedPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
        const parameters = [
            ...pathParams.map((name) => ({
                name,
                in: 'path',
                required: true,
                schema: { type: 'string' },
            })),
            ...queryKeys.map((name) => ({
                name,
                in: 'query',
                required: false,
                schema: { type: 'string' },
            })),
        ];

        const operation: Record<string, unknown> = {
            tags: [entry.group],
            summary: entry.description,
            description: `${entry.description} Access: ${entry.access}.`,
            operationId: `${entry.group}_${entry.method}_${normalizedPath}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            security: accessToSecurity(entry.access),
            responses: {
                200: { description: 'Success' },
                400: { description: 'Bad Request' },
                401: { description: 'Unauthorized' },
                403: { description: 'Forbidden' },
                404: { description: 'Not Found' },
                500: { description: 'Internal Server Error' },
            },
        };

        if (parameters.length > 0) {
            operation.parameters = parameters;
        }

        if (['post', 'put', 'patch'].includes(method)) {
            operation.requestBody = {
                required: false,
                content: {
                    'application/json': {
                        schema: inferRequestBodySchema(entry.sampleBody),
                    },
                },
            };
        }

        existingPath[method] = operation;
        paths[normalizedPath] = existingPath;
    }

    return {
        openapi: '3.0.3',
        info: {
          title: 'Vahi API',
            version: '1.0.0',
          description: 'Vahi business suite API for billing, inventory, staff, accounting and admin operations.',
        },
        servers: [
            { url: '/', description: 'Current deployment' },
        ],
        security: [],
        tags: [...new Set(API_ENDPOINTS.map((entry) => entry.group))].map((name) => ({ name })),
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                cronSecret: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-Cron-Secret',
                },
            },
        },
        paths,
    };
};

const siteRoute = new Hono<AppEnv>();

const toSafeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

const buildLayout = (title: string, content: string, extraScript = '') => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --card: #ffffff;
      --text: #11203a;
      --muted: #60708f;
      --line: #d8dfec;
      --primary: #0b57d0;
      --primary-2: #dce8ff;
      --ok: #1f6f46;
      --warn: #7b5d0a;
      --danger: #8e1d1d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top right, #e9f0ff 0%, var(--bg) 42%);
      color: var(--text);
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 28px 20px 40px;
    }
    .topbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .btn, a.btn {
      display: inline-block;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--text);
      text-decoration: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 14px;
    }
    .btn.primary {
      border-color: var(--primary);
      background: var(--primary);
      color: #fff;
    }
    .btn.secondary {
      background: var(--primary-2);
      border-color: #c6d7fd;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 22px;
      margin-bottom: 16px;
    }
    h1, h2 {
      margin: 0 0 10px;
      line-height: 1.2;
    }
    p { margin: 0 0 10px; color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }
    .kpi {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
    }
    .muted { color: var(--muted); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 10px;
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }
    th { background: #eef3ff; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; }
    tr:last-child td { border-bottom: 0; }
    .pill {
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 700;
      display: inline-block;
      border: 1px solid var(--line);
      background: #f8faff;
    }
    .method-GET { color: #125d34; border-color: #94d6ae; background: #ecfff4; }
    .method-POST { color: #1f3f8f; border-color: #9db7ff; background: #eef3ff; }
    .method-PUT { color: #5a2d91; border-color: #c8a7ff; background: #f7f0ff; }
    .method-PATCH { color: #8a4f05; border-color: #f4ca8b; background: #fff6e7; }
    .method-DELETE { color: #8e1d1d; border-color: #efb4b4; background: #fff0f0; }
    .form-row { display: grid; gap: 8px; margin-bottom: 10px; }
    label { font-weight: 600; font-size: 13px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      font-size: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #fff;
      color: #162846;
    }
    textarea { min-height: 110px; resize: vertical; }
    pre {
      margin: 0;
      padding: 12px;
      border-radius: 10px;
      overflow: auto;
      border: 1px solid var(--line);
      background: #f6f8fe;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status-ok { color: var(--ok); font-weight: 700; }
    .status-warn { color: var(--warn); font-weight: 700; }
    .status-err { color: var(--danger); font-weight: 700; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <a class="btn" href="/">Home</a>
      <a class="btn" href="/docs">Docs</a>
      <a class="btn" href="/playground">Playground</a>
      <a class="btn" href="/docs/swagger">Swagger UI</a>
      <a class="btn" href="/docs/catalog.json">Catalog JSON</a>
      <a class="btn" href="/docs/openapi.json">OpenAPI JSON</a>
      <a class="btn secondary" href="/api" target="_blank" rel="noreferrer">API Health</a>
    </div>
    ${content}
  </div>
  ${extraScript}
</body>
</html>`;

const methodBadge = (method: ApiMethod): string =>
    `<span class="pill method-${method}">${method}</span>`;

const homeContent = () => {
    const endpointCount = API_ENDPOINTS.length;
    const groupCount = new Set(API_ENDPOINTS.map((entry) => entry.group)).size;
    const protectedCount = API_ENDPOINTS.filter((entry) => entry.access !== 'Public').length;

    return `
      <section class="hero">
        <h1>Vahi API Console</h1>
        <p>Cloudflare-optimized server homepage for API docs, interactive testing, and quick integration checks.</p>
        <div class="actions">
          <a class="btn primary" href="/docs">Open API Docs</a>
          <a class="btn secondary" href="/playground">Open Playground</a>
          <a class="btn" href="/docs/swagger">Open Swagger UI</a>
        </div>
      </section>
      <section class="grid">
        <div class="card"><div class="kpi">${endpointCount}</div><p>Total documented endpoints</p></div>
        <div class="card"><div class="kpi">${groupCount}</div><p>Endpoint groups</p></div>
        <div class="card"><div class="kpi">${protectedCount}</div><p>Protected endpoints</p></div>
      </section>
      <section class="card" style="margin-top:12px;">
        <h2>Quick Links</h2>
        <p class="muted">Use these direct links during development and deployment checks.</p>
        <div class="actions">
          <a class="btn" href="/api/auth/me">/api/auth/me</a>
          <a class="btn" href="/api/reporting/pnl">/api/reporting/pnl</a>
          <a class="btn" href="/api/accounting/trial-balance">/api/accounting/trial-balance</a>
          <a class="btn" href="/api/admin/access">/api/admin/access</a>
        </div>
      </section>
    `;
};

const docsContent = () => {
    const rows = API_ENDPOINTS.map((entry) => {
        const playgroundLink = `/playground?method=${encodeURIComponent(entry.method)}&path=${encodeURIComponent(entry.path)}`;
        return `
          <tr data-search="${entry.group} ${entry.method} ${entry.path} ${entry.description} ${entry.access}">
            <td>${methodBadge(entry.method)}</td>
            <td><code>${entry.path}</code></td>
            <td>${entry.group}</td>
            <td>${entry.access}</td>
            <td>${entry.description}</td>
            <td><a class="btn" href="${playgroundLink}">Try</a></td>
          </tr>
        `;
    }).join('');

    return `
      <section class="hero">
        <h1>API Documentation</h1>
        <p>Browse endpoint catalog and launch any endpoint in the built-in playground.</p>
        <div class="form-row">
          <label for="docs-search">Search endpoints</label>
          <input id="docs-search" placeholder="Search by path, method, group, access..." />
        </div>
      </section>
      <table id="docs-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Group</th>
            <th>Access</th>
            <th>Description</th>
            <th>Test</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
};

const playgroundContent = () => `
  <section class="hero">
    <h1>API Playground</h1>
    <p>Test endpoints directly from the server. Bearer token is optional for public routes.</p>
  </section>
  <section class="grid">
    <div class="card">
      <div class="form-row">
        <label for="endpoint-select">Endpoint</label>
        <select id="endpoint-select"></select>
      </div>
      <div class="form-row">
        <label for="method">Method</label>
        <select id="method">
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>PATCH</option>
          <option>DELETE</option>
        </select>
      </div>
      <div class="form-row">
        <label for="path">Path or URL</label>
        <input id="path" placeholder="/api..." />
      </div>
      <div class="form-row">
        <label for="token">Bearer token (without "Bearer ")</label>
        <input id="token" placeholder="eyJ..." />
      </div>
      <div class="form-row">
        <label for="headers">Extra headers (JSON object)</label>
        <textarea id="headers" placeholder='{"X-Cron-Secret":"..."}'></textarea>
      </div>
      <div class="form-row">
        <label for="body">JSON body</label>
        <textarea id="body" placeholder='{"key":"value"}'></textarea>
      </div>
      <div class="actions">
        <button class="btn primary" id="run-request" type="button">Run Request</button>
        <button class="btn" id="copy-curl" type="button">Copy cURL</button>
      </div>
    </div>
    <div class="card">
      <h2>Result</h2>
      <p id="status" class="muted">No request executed yet.</p>
      <p class="muted">cURL Preview</p>
      <pre id="curl-preview"></pre>
      <p class="muted" style="margin-top:10px;">Response</p>
      <pre id="response-preview"></pre>
    </div>
  </section>
`;

const swaggerContent = () => `
  <section class="hero">
    <h1>Swagger UI</h1>
    <p>Interactive OpenAPI explorer generated from Vahi endpoint catalog.</p>
  </section>
  <section class="card">
    <div id="swagger-ui"></div>
  </section>
`;

const docsSearchScript = `
<script>
  const input = document.getElementById('docs-search');
  const rows = Array.from(document.querySelectorAll('#docs-table tbody tr'));
  input?.addEventListener('input', function () {
    const query = (input.value || '').trim().toLowerCase();
    rows.forEach(function (row) {
      const hay = (row.getAttribute('data-search') || '').toLowerCase();
      row.style.display = !query || hay.includes(query) ? '' : 'none';
    });
  });
</script>`;

const playgroundScript = `
<script>
  const endpoints = ${toSafeJson(API_ENDPOINTS)};
  const selectEl = document.getElementById('endpoint-select');
  const methodEl = document.getElementById('method');
  const pathEl = document.getElementById('path');
  const tokenEl = document.getElementById('token');
  const headersEl = document.getElementById('headers');
  const bodyEl = document.getElementById('body');
  const runEl = document.getElementById('run-request');
  const copyCurlEl = document.getElementById('copy-curl');
  const statusEl = document.getElementById('status');
  const curlEl = document.getElementById('curl-preview');
  const responseEl = document.getElementById('response-preview');

  const params = new URLSearchParams(window.location.search);
  const queryMethod = (params.get('method') || '').toUpperCase();
  const queryPath = params.get('path') || '';

  function parseHeaders() {
    const raw = (headersEl.value || '').trim();
    if (!raw) return {};
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
      throw new Error('Headers must be a JSON object.');
    } catch (err) {
      throw new Error('Invalid headers JSON: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function prettyJson(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {
      return text;
    }
  }

  function shellEscape(value) {
    return String(value).replace(/'/g, "'\\\\''");
  }

  function buildCurl(method, url, headers, body) {
    const parts = ['curl -X ' + method + ' \"' + url + '\"'];
    Object.entries(headers).forEach(([key, value]) => {
      parts.push('-H \"' + key + ': ' + String(value).replace(/\"/g, '\\\\\"') + '\"');
    });
    if (body) {
      parts.push(\"--data '\" + shellEscape(body) + \"'\");
    }
    return parts.join(' \\\\\\n  ');
  }

  function setFromEndpoint(index) {
    const endpoint = endpoints[index];
    if (!endpoint) return;
    methodEl.value = endpoint.method;
    pathEl.value = endpoint.path;
    bodyEl.value = endpoint.sampleBody ? JSON.stringify(endpoint.sampleBody, null, 2) : '';
  }

  endpoints.forEach((endpoint, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = '[' + endpoint.method + '] ' + endpoint.path + ' (' + endpoint.group + ')';
    selectEl.appendChild(option);
  });

  selectEl.addEventListener('change', () => setFromEndpoint(Number(selectEl.value)));

  if (queryPath || queryMethod) {
    const idx = endpoints.findIndex((entry) => entry.path === queryPath && entry.method === queryMethod);
    if (idx >= 0) {
      selectEl.value = String(idx);
      setFromEndpoint(idx);
    } else {
      methodEl.value = queryMethod || 'GET';
      pathEl.value = queryPath || '/api';
    }
  } else {
    selectEl.value = '0';
    setFromEndpoint(0);
  }

  async function runRequest() {
    const method = methodEl.value.toUpperCase();
    const rawPath = (pathEl.value || '').trim() || '/api';
    const token = (tokenEl.value || '').trim();
    const parsedHeaders = parseHeaders();
    const url = rawPath.startsWith('http://') || rawPath.startsWith('https://')
      ? rawPath
      : new URL(rawPath.startsWith('/') ? rawPath : '/' + rawPath, window.location.origin).toString();

    const headers = { ...parsedHeaders };
    if (token) headers.Authorization = 'Bearer ' + token;

    const rawBody = (bodyEl.value || '').trim();
    const canHaveBody = !['GET', 'HEAD'].includes(method);
    const body = canHaveBody && rawBody ? rawBody : undefined;
    if (body && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    const curl = buildCurl(method, url, headers, body);
    curlEl.textContent = curl;

    statusEl.className = 'muted';
    statusEl.textContent = 'Sending request...';
    responseEl.textContent = '';

    const started = Date.now();
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
      });
      const elapsed = Date.now() - started;
      const text = await res.text();
      responseEl.textContent = prettyJson(text);
      statusEl.textContent = 'Status ' + res.status + ' in ' + elapsed + 'ms';
      statusEl.className = res.ok ? 'status-ok' : (res.status < 500 ? 'status-warn' : 'status-err');
    } catch (error) {
      statusEl.textContent = 'Request failed: ' + (error instanceof Error ? error.message : String(error));
      statusEl.className = 'status-err';
      responseEl.textContent = '';
    }
  }

  runEl.addEventListener('click', () => { runRequest().catch((err) => {
    statusEl.textContent = String(err);
    statusEl.className = 'status-err';
  }); });

  copyCurlEl.addEventListener('click', async () => {
    const value = curlEl.textContent || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      copyCurlEl.textContent = 'Copied';
      setTimeout(() => { copyCurlEl.textContent = 'Copy cURL'; }, 1200);
    } catch (_) {
      copyCurlEl.textContent = 'Copy failed';
      setTimeout(() => { copyCurlEl.textContent = 'Copy cURL'; }, 1200);
    }
  });
</script>`;

const swaggerScript = `
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  window.onload = function () {
    SwaggerUIBundle({
      url: '/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      layout: 'BaseLayout',
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      persistAuthorization: true,
    });
  };
</script>`;

siteRoute.use('*', async (c, next) => {
    await next();
    if (c.res.headers.get('content-type')?.includes('text/html')) {
        c.header('X-Content-Type-Options', 'nosniff');
        c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
});

siteRoute.get('/', (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=120');
  return c.html(buildLayout('Vahi API Console', homeContent()));
});

siteRoute.get('/docs', (c) => {
    c.header('Cache-Control', 'public, max-age=120, s-maxage=300');
  return c.html(buildLayout('Vahi API Docs', docsContent(), docsSearchScript));
});

siteRoute.get('/docs/swagger', (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=120');
  return c.html(buildLayout('Vahi Swagger UI', swaggerContent(), swaggerScript));
});

siteRoute.get('/playground', (c) => {
    c.header('Cache-Control', 'no-store');
  return c.html(buildLayout('Vahi API Playground', playgroundContent(), playgroundScript));
});

siteRoute.get('/docs/openapi.json', (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=120');
    return c.json(buildOpenApiSpec());
});

siteRoute.get('/docs/catalog.json', (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=120');
    return c.json({
        ok: true,
      service: 'vahi-api-docs',
        endpointCount: API_ENDPOINTS.length,
        generatedAt: new Date().toISOString(),
        endpoints: API_ENDPOINTS,
    });
});

export default siteRoute;
