# Vahi Remaining Tasks and Screens Tracker

Last updated: 2026-03-03

This file tracks what is still pending to reach full Vahi scope across `vahi` (mobile), `server` (API), and `admin` (dashboard).

## Current Snapshot

- Mobile route files present in `vahi/src/app`: 65
- `@ts-nocheck` usage in mobile code: 0 files
- Major server route modules present: auth, organizations, items, parties, transactions, pos, accounting, expenses, loans, cash-bank, godowns, operations, staff, settings, subscription, analytics, admin
- Major admin dashboard pages present: analytics, users, subscriptions, discounts, feature-flags, banners, templates, organizations, transactions, inventory, staff, settings, audit-logs

## P0 Critical: Broken Navigation Targets (create these first)

- [x] Create `vahi/src/app/(main)/billing/party-select.tsx` (referenced from `vahi/src/app/(main)/billing/create.tsx:75`)
- [x] Create `vahi/src/app/(main)/accounts/cash-bank/add.tsx` (referenced from `vahi/src/app/(main)/accounts/cash-bank.tsx:44` and `:57`)
- [x] Create `vahi/src/app/(main)/accounts/cash-bank/[id].tsx` (referenced from `vahi/src/app/(main)/accounts/cash-bank.tsx:78`)
- [x] Create `vahi/src/app/(main)/accounts/loans/[id]/payment.tsx` (referenced from `vahi/src/app/(main)/accounts/loans/[id].tsx:71`)
- [x] Create `vahi/src/app/(main)/accounts/loans/[id]/interest.tsx` (referenced from `vahi/src/app/(main)/accounts/loans/[id].tsx:74`)
- [x] Create `vahi/src/app/(main)/more/reports/gstr1.tsx` (referenced from `vahi/src/app/(main)/more/reports/pnl.tsx:98`)
- [x] Create `vahi/src/app/(main)/more/reports/gstr3b.tsx` (referenced from `vahi/src/app/(main)/more/reports/pnl.tsx:99`)

## P1 Mobile Screens Missing vs Canonical Vahi Spec

- [x] Add Business Selection / Creation screen after login (`/(auth)/business-select`) and wire post-auth flow
- [ ] Add dedicated Purchase Bill screen (do not overload generic invoice form)
- [ ] Add dedicated Sale Return (Credit Note) screen
- [ ] Add dedicated Purchase Return (Debit Note) screen
- [ ] Add dedicated Estimate / Quotation screen
- [ ] Add dedicated Sale Order screen
- [ ] Add dedicated Purchase Order screen
- [ ] Add dedicated Delivery Challan screen
- [ ] Add Payment In screen for customer receipts
- [ ] Add Payment Out screen for supplier/vendor payouts
- [ ] Add Reports tab in main navigation (`Home, Billing, Inventory, Accounts, Reports, More`)
- [ ] Add Reports home screen with Sales/GST/Inventory report navigation
- [ ] Add Trial Balance screen in mobile
- [ ] Add Ledger detail drill-down screen with running balance filters
- [ ] Add GST summary report screen with slab wise and period wise filters

## P2 Mobile Feature Gaps (Requested + Old Client Parity)

- [ ] Implement role-aware UI gating (owner/manager/salesman) in mobile navigation and actions
- [ ] Implement subscription feature-flag gating in UI (hide/disable unsupported modules and actions)
- [ ] Add account CRUD UX for Cash/Bank account creation/editing/deactivation
- [ ] Add QR and signature capture setup flow during onboarding/profile setup
- [ ] Add invoice signature image printing support (not only signature text)
- [ ] Add scheduled reminder engine (due reminders, recurring notification schedules)
- [ ] Add WhatsApp/SMS template driven scheduling controls from settings
- [ ] Add bulk actions where missing (bulk update/delete for items/parties/expenses)
- [ ] Add recycle bin beyond expenses (items, parties, and optional invoices with restore policy)
- [ ] Add background sync conflict resolution policy screen and diagnostics
- [ ] Add offline sync queue inspector screen (pending, failed, retry now)
- [ ] Add USB scanner mode behavior toggle wiring (currently camera-first scan UX)
- [ ] Add thermal print profile presets and printer pairing UI
- [ ] Add multi-currency behavior finalization (base currency, formatting, transaction constraints)

## P3 Server/API Gaps Remaining

- [ ] Implement real maker-checker approvals workflow (`/operations/approvals` is currently placeholder)
- [ ] Implement actual approve/reject side effects for pending operational actions
- [ ] Implement e-invoice integration flow (IRN generation/validation) beyond field storage
- [ ] Implement e-way bill integration flow beyond field storage
- [ ] Implement TCS/TDS posting behavior in transactions and accounting entries
- [ ] Implement composite scheme specific posting/reporting behavior
- [ ] Implement notification campaign delivery executor (actual push/SMS/WhatsApp dispatch)
- [ ] Implement API-level route parity checks for mobile route references (similar to API contract verifier)
- [ ] Add high-risk finance/accounting integration tests (double entry, rounding, period lock, reversal)

## P4 Admin Panel Gaps Remaining

- [ ] Add dedicated Notification Templates page (CRUD UI against admin notification template APIs)
- [ ] Add dedicated Notification Campaigns page (create/schedule/trigger/cancel)
- [ ] Add dedicated Notification Deliveries monitor page
- [ ] Implement role-based admin guardrails per role (SUPER_ADMIN, SUPPORT_ADMIN, READ_ONLY_ADMIN) at page and action level
- [ ] Add live updates (SSE/WebSocket) for signups, upgrades, failures, queue spikes
- [ ] Remove or implement empty dashboard sections (`payroll`, `treasury` folders are empty)
- [ ] Add full audit-log filters and drill-down metadata viewer

## P5 Quality, Type Safety, and CI Hardening

- [x] Remove all `@ts-nocheck` from mobile code (26 files currently)
- [x] Add strict typed route validation script to catch missing route files before push
- [x] Extend `verify:ci` to include API contract check in one command (keep fast profile option separately)
- [x] Keep `smoke:web` as final pipeline step after lint/typecheck (already done in workflows; keep enforced)
- [x] Add smoke checks for auth navigation and top-level route accessibility
- [x] Add snapshot/golden tests for invoice HTML (A4 + thermal variants)

## Suggested One-by-One Execution Order

1. Complete all P0 broken route targets.
2. Complete P1 missing mobile screens (at least functional versions).
3. Implement P2 role/subscription gating and core parity items.
4. Implement P3 server placeholders and compliance integrations.
5. Implement P4 admin notification + RBAC completion.
6. Finish P5 cleanup and strict CI hardening.

## Progress Log

- 2026-03-03: Tracker initialized.
- 2026-03-03: Completed all P0 broken navigation targets listed above.
- 2026-03-03: Updated `scripts/smoke-web.js` for CI-safe non-interactive execution and timeout guard.
- 2026-03-03: Added `/(auth)/business-select` and wired login/index redirects to enforce business selection before entering main app.
- 2026-03-03: Completed P5 quality hardening: removed all `@ts-nocheck`, added route validation and route smoke scripts, integrated API contract + invoice snapshot checks into `verify:ci`, and kept `smoke:web` as enforced final check.
- 2026-03-03: Final local verification passed in one run via `pnpm run verify:full` (doctor, lint, typecheck, route checks, API contract, invoice snapshots, web smoke).
  
