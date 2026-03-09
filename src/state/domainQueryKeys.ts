import { resolveBusinessQueryScope } from './businessScope';

export const organizationQueryKeys = {
  mine: () => ['viewer', 'organizations', 'mine'] as const,
};

export const syncQueryKeys = {
  all: (businessId?: string | null) =>
    [
      'business',
      resolveBusinessQueryScope(businessId),
      'offline-sync',
    ] as const,
  queue: (businessId?: string | null) =>
    [...syncQueryKeys.all(businessId), 'queue'] as const,
};

export const subscriptionQueryKeys = {
  all: () => ['viewer', 'subscription'] as const,
  plans: () => [...subscriptionQueryKeys.all(), 'plans'] as const,
  offers: () => [...subscriptionQueryKeys.all(), 'offers'] as const,
};

export const invoiceQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'invoices'] as const,
  list: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...invoiceQueryKeys.all(businessId), 'list', filters ?? {}] as const,
  detail: (businessId: string | null | undefined, invoiceId: string) =>
    [...invoiceQueryKeys.all(businessId), 'detail', invoiceId] as const,
};

export const partyQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'parties'] as const,
  list: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...partyQueryKeys.all(businessId), 'list', filters ?? {}] as const,
  detail: (businessId: string | null | undefined, partyId: string) =>
    [...partyQueryKeys.all(businessId), 'detail', partyId] as const,
  recycleBin: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...partyQueryKeys.all(businessId), 'recycle-bin', filters ?? {}] as const,
  invoices: (businessId: string | null | undefined, partyId: string) =>
    [...partyQueryKeys.detail(businessId, partyId), 'invoices'] as const,
};

export const cashBankQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'cash-bank'] as const,
  balances: (businessId?: string | null) =>
    [...cashBankQueryKeys.all(businessId), 'balances'] as const,
  summary: (businessId?: string | null) =>
    [...cashBankQueryKeys.all(businessId), 'summary'] as const,
  ledger: (businessId: string | null | undefined, accountId: string) =>
    [...cashBankQueryKeys.all(businessId), 'ledger', accountId] as const,
};

export const accountingQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'accounting'] as const,
  accounts: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [
      ...accountingQueryKeys.all(businessId),
      'accounts',
      filters ?? {},
    ] as const,
};

export const itemQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'items'] as const,
  list: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...itemQueryKeys.all(businessId), 'list', filters ?? {}] as const,
  detail: (businessId: string | null | undefined, itemId: string) =>
    [...itemQueryKeys.all(businessId), 'detail', itemId] as const,
  recycleBin: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...itemQueryKeys.all(businessId), 'recycle-bin', filters ?? {}] as const,
};

export const expenseQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'expenses'] as const,
  list: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...expenseQueryKeys.all(businessId), 'list', filters ?? {}] as const,
  recycleBin: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [
      ...expenseQueryKeys.all(businessId),
      'recycle-bin',
      filters ?? {},
    ] as const,
};

export const loanQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'loans'] as const,
  list: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...loanQueryKeys.all(businessId), 'list', filters ?? {}] as const,
  detail: (businessId: string | null | undefined, loanId: string) =>
    [...loanQueryKeys.all(businessId), 'detail', loanId] as const,
  transactions: (businessId: string | null | undefined, loanId: string) =>
    [...loanQueryKeys.detail(businessId, loanId), 'transactions'] as const,
};

export const godownQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'godowns'] as const,
  list: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...godownQueryKeys.all(businessId), 'list', filters ?? {}] as const,
  stock: (businessId: string | null | undefined, godownId: string) =>
    [...godownQueryKeys.all(businessId), 'stock', godownId] as const,
};

export const staffQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'staff'] as const,
  directory: (businessId?: string | null) =>
    [...staffQueryKeys.all(businessId), 'directory'] as const,
};

export const operationsQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'operations'] as const,
  controls: (businessId?: string | null) =>
    [...operationsQueryKeys.all(businessId), 'controls'] as const,
  periods: (businessId?: string | null) =>
    [...operationsQueryKeys.all(businessId), 'periods'] as const,
  approvals: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [
      ...operationsQueryKeys.all(businessId),
      'approvals',
      filters ?? {},
    ] as const,
  auditLogs: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [
      ...operationsQueryKeys.all(businessId),
      'audit-logs',
      filters ?? {},
    ] as const,
};

export const reportQueryKeys = {
  all: (businessId?: string | null) =>
    ['business', resolveBusinessQueryScope(businessId), 'reports'] as const,
  summary: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...reportQueryKeys.all(businessId), 'summary', filters ?? {}] as const,
  trialBalance: (
    businessId?: string | null,
    filters?: Record<string, unknown>,
  ) =>
    [
      ...reportQueryKeys.all(businessId),
      'trial-balance',
      filters ?? {},
    ] as const,
  ledgers: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...reportQueryKeys.all(businessId), 'ledgers', filters ?? {}] as const,
  ledgerDetail: (
    businessId: string | null | undefined,
    ledgerId: string,
    filters?: Record<string, unknown>,
  ) =>
    [
      ...reportQueryKeys.all(businessId),
      'ledger-detail',
      ledgerId,
      filters ?? {},
    ] as const,
  gstSummary: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...reportQueryKeys.all(businessId), 'gst-summary', filters ?? {}] as const,
  gstr1: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...reportQueryKeys.all(businessId), 'gstr1', filters ?? {}] as const,
  gstr3b: (businessId?: string | null, filters?: Record<string, unknown>) =>
    [...reportQueryKeys.all(businessId), 'gstr3b', filters ?? {}] as const,
};
