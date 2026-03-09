# Offline-First Migration Status

Last updated: 2026-03-08

## Scope

- App: `vahi`
- API/server alignment: `server`
- Validation allowed during migration:
  - `pnpm -C vahi typecheck`
  - `pnpm -C vahi lint`
  - `pnpm -C server typecheck`
- Explicitly not used during this migration log:
  - `smoke:web`

## Completed

### Platform and storage foundation

- [x] Switched native key-value storage to Expo SQLite KV store.
- [x] Added web fallback using Expo SQLite local storage install path.
- [x] Added SQLite-backed offline domain database for scoped records/settings/outbox.
- [x] Scoped offline queue/cache state by active business.

### Runtime and bootstrap

- [x] Added app runtime provider for startup/bootstrap/network/sync ownership.
- [x] Centralized sync lifecycle instead of screen-owned listeners.
- [x] Shared sync queue hooks added for diagnostics and app shell state.
- [x] Added offline-capable fallback for business list/current business shell reads.

### API and server stabilization

- [x] Fixed major client/server payload drift for cash-bank and transaction flows.
- [x] Fixed party-filter support on transaction listing.
- [x] Added better API/offline console diagnostics for failures.
- [x] Preserved offline-created IDs on server routes where replay required it.

### Offline-first domain behavior

- [x] Settings save path works local-first and propagates immediately across consumers.
- [x] Billing invoice replay preserves local invoice IDs.
- [x] Invoice builder supports inline party create and godown create/select.
- [x] Cash-bank deposit/withdraw/transfer apply local changes immediately.
- [x] Item/party/expense archive and restore flows work local-first.
- [x] Loan transaction entry works local-first.
- [x] Reports and godown stock have offline-derived fallback data paths.
- [x] Subscription plans/offers and announcements now fall back to cached offline data.

### Shared query and hook cleanup

- [x] Business-scoped query keys added across core domains.
- [x] Moved screen-level ad hoc `useQuery`/`useMutation` logic into shared hooks for core domains.
- [x] Removed the last raw screen-level `useMutation` ownership by moving subscription utility mutations into a shared hook.
- [x] Unified settings query keys and mutation flow.
- [x] Moved organization/bootstrap and sync diagnostics onto shared hooks.
- [x] Removed direct `endpoints.ts` imports from app screens, components, and hooks.
- [x] Removed remaining internal test imports from `endpoints.ts`.
- [x] Added shared auth/business/subscription repositories for shell-domain access.

### Shared form and mapper cleanup

- [x] Added shared legacy auth/business/profile mappers and removed duplicate bootstrap mapping logic.
- [x] Moved auth refresh-time profile/business/subscription shaping onto repositories instead of raw endpoint mapping inside the store.
- [x] Moved initial auth-response bootstrap shaping in `setAuth()` onto the shared auth mapper layer.
- [x] Standardized remaining finance-facing form options for expenses, loans, parties, and staff roles.
- [x] Added shared report/printing option registries and report/accounting selector helpers.
- [x] Moved expense filters, item GST slab selection, report directory cards, printing presets, and ledger-detail filtering onto shared constants/selectors.
- [x] Extracted shell, billing, settings, and inventory option registries from screen files and fixed leftover mojibake UI labels in migrated screens.
- [x] Centralized utility navigation and subscription option registries for More, Screen Directory, and Subscription utility flows.
- [x] Centralized shell navigation shortcuts for the tab bar, side drawer, Go To palette, home quick actions, and cash-bank quick actions.
- [x] Centralized billing document configuration metadata for invoice create flows.
- [x] Removed the last visible mojibake text from the dashboard/shell surfaces touched by the migration.
- [x] Completed the utility/legal presentation pass for More, Subscription, Announcements, and Legal Center using shared utility blocks and richer shared metadata.
- [x] Added shared hub blocks and aligned the main Billing, Accounts, Reports, and Settings landing screens to the same hero/metric/action-card shell pattern.
- [x] Extended the shared hub shell to deeper operational screens including Inventory, Parties, Cash and Bank, and Staff.
- [x] Added shared form blocks and aligned key create/edit forms for Inventory, Parties, Expenses, Loans, and Cash/Bank account setup.
- [x] Extended the shared form shell to transaction flows for deposit, withdraw, transfer, loan payment, and loan interest.
- [x] Aligned key detail screens for Party, Inventory, and Cash/Bank ledger to the shared hero/section/metric pattern.
- [x] Aligned billing create/detail and accounting report detail screens to the shared form, hero, and metric block system.
- [x] Aligned secondary billing flows including Payment In, Payment Out, and POS to the shared billing shell and metric patterns.
- [x] Completed the shared-primitives brand refresh by updating theme tokens plus top bar, input, search, select, hero, metric, and form card styling globally.
- [x] Completed the navigation-shell polish by aligning the drawer container, drawer content, and floating tab bar sheet to the same card-based visual system as the rest of the app.
- [x] Completed the auth-entry polish by aligning login, business selection, and startup splash surfaces with the same branded card-based shell.
- [x] Completed the shared-surface polish for scanner, dialogs, date sheets, and signature capture so secondary runtime surfaces match the main app shell.
- [x] Completed the list-surface polish by standardizing search action treatment and empty-state cards across major billing, inventory, and party list views.
- [x] Completed the chip-control polish by introducing shared chip primitives for tabs, filters, and action pills across billing, inventory, parties, reports, expenses, and settings.
- [x] Extended shared chip primitives to secondary control screens including section settings, role access, sync diagnostics, subscription controls, GST filters, printing controls, inventory sort sheets, and account/party setup flows.

### Repository extraction completed

- [x] `authRepository`
- [x] `businessRepository`
- [x] `settingsRepository`
- [x] `reportRepository`
- [x] `itemRepository`
- [x] `partyRepository`
- [x] `expenseRepository`
- [x] `loanRepository`
- [x] `cashBankRepository`
- [x] `godownRepository`
- [x] `staffRepository`
- [x] `operationsRepository`
- [x] `accountingRepository`
- [x] `invoiceRepository`
- [x] `subscriptionRepository`
- [x] Shell repositories now own their HTTP transport instead of importing `endpoints.ts`

## Current Status

- [x] Core offline-first migration for the current `vahi` + `server` scope is complete.
- [x] Repository extraction, shared hooks, business scoping, offline-first mutation paths, and shell/runtime cleanup are complete.
- [x] Remaining items are optional polish or future feature coverage, not blocking structural migration tasks.

## Optional Follow-Up

### API transport cleanup

- [x] Reduce `src/api/endpoints.ts` to transport compatibility wrappers plus pure mapping.
- [x] Remove remaining local-first orchestration blocks from `src/api/endpoints.ts`.
- [x] Remove obsolete helper duplication after each repository move.
- [x] Prune residual compatibility wrapper surface in `src/api/endpoints.ts` once all callers are verified stable on repositories.
: `endpoints.ts` is now a minimal compatibility facade; app code and tests no longer depend on it.

### Offline-derived data and reporting

- [~] Move more accounting/report derivation behind repositories/selectors instead of endpoint overrides.
: Core GST/P&L/ledger/godown fallback paths are done, and sales trend now has an offline-derived fallback as well. Remaining work is limited to lower-priority summaries and any future derived widgets.
- [~] Add local-first fallback for remaining non-core summaries that still assume live server aggregates.
: Current app-visible utility reads such as subscription plans/offers and business list now have offline cache. Any remaining work here is low-priority future widget coverage rather than a known blocking screen.

### UI and form system

- [~] Replace remaining hardcoded constant inputs with shared option registries.
: Main accounting, inventory, expense, report, printing, shell navigation, and billing document flows are centralized; anything left is dynamic select data or low-risk utility/legal presentation.
- [x] Normalize accounting-oriented inputs across expense, loan, ledger, and account flows.
- [~] Continue simplifying old screens that still mix legacy and new state access patterns.
: Core domain and shell screens are migrated. Remaining cleanup is now limited to optional future visual tweaks rather than known mixed-state screens.

### Structural work still pending

- [x] Push the last direct screen consumption patterns from `endpoints.ts` to repositories/hooks.
- [x] Complete repository extraction for the remaining financial domains.
- [~] Continue reducing duplicate mappers between auth/bootstrap/api/runtime layers.
: Major steady-state and initial sign-in duplication are removed. Remaining overlap is now minor and mostly around optional presentation/bootstrap helpers rather than core transport shaping.
- [~] Do a final design-system pass across non-core utility screens that still carry older presentation patterns.
: Current utility/legal screens and the main landing hubs are on shared utility/hub blocks. Any further work here is optional visual refinement only.

## Validation Baseline

Latest completed validation:

- [x] `pnpm -C vahi typecheck`
- [x] `pnpm -C vahi lint`
- [x] `pnpm -C server typecheck`

## Next Recommended Order

1. Add more offline-derived selectors only if new summary widgets or dashboards are introduced
2. Continue tiny mapper dedup only when touching adjacent auth/bootstrap code again
3. Add another visual pass only if you want a stronger brand/design refresh beyond the current shared utility system
