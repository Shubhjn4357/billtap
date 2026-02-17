# Changelog

## 2.3.0 - 2026-02-17
- Adopted TanStack Query for server-state hooks:
  - migrated `useStock`, `useBills`, `useOffers`, and `useAnalyticsFunnel` to `useQuery` with offline-first defaults.
  - added shared QueryClient + provider wiring in root layout.
- Hardened connectivity and request stability:
  - migrated `httpClient` to Axios with bounded retry/backoff, timeout handling, and fast offline short-circuit.
  - removed noisy retry warning logs that triggered debug popups.
  - improved NetInfo probe logic in `src/utils/network.ts` to reduce online/offline flapping.
- Upgraded offline queue engine:
  - added in-flight flush lock, mutation dedupe/compaction, retry metadata, delayed retries, and auto-sync interval.
  - added silent `onNetworkStateChange` trigger and startup auto-sync lifecycle.
- Reduced network interruption noise:
  - reminder send failures now queue silently when offline in Business Suite cloud mode.
  - added cached-offers fallback path in `marketingService` for offline dashboards.
- UI performance upgrades:
  - `useTransition`-based search updates in stock + billing flows.
  - reducer-driven billing totals recalculation path for cart summary logic.

## 2.2.0 - 2026-02-17
- Added offline local persistence scaffolding with Drizzle + Expo SQLite:
  - new key-value table (`offline_kv`) and typed schema in `src/offline/db/schema.ts`.
  - resilient storage adapter in `src/offline/db/offlineKeyValueStore.ts` with automatic fallback to AsyncStorage.
  - `offlineSyncService` now reads/writes queue and cache data via the storage adapter.
  - added runtime backend introspection (`sqlite-drizzle` or `async-storage`) and surfaced it in Settings.
- UI redesign continuation:
  - refreshed login hero + capability badges + clearer auth-mode state presentation.
  - refined dashboard command-center layout with top KPI strip and updated launch-pad section labels.
- Added `expo-sqlite` config plugin and dependencies to support local SQLite runtime.

## 2.1.1 - 2026-02-17
- Fixed bottom-bar overlap by:
  - filtering hidden/inaccessible tab routes from custom tab rendering,
  - moving Settings access to avatar-only control,
  - tightening center gap/tab spacing for 5-slot layouts.
- Added profile avatar connectivity indicator (green online/red offline dot) and active-state border.
- Removed noisy floating connectivity pill from every screen; network status is now surfaced in the tab-shell avatar.
- Suppressed repetitive network/offline alert dialogs via:
  - global dialog dedupe throttle,
  - connectivity-message filtering in dialog provider.
- Improved offline fallback behavior:
  - added shared error guards (`isNetworkLikeError`, `shouldThrowClientApiError`),
  - prevented `status=0` connectivity failures from being treated as client-validation errors in services.
- Reduced transient network noise in data hooks (`useStock`, `useBills`, `useOffers`) by keeping cached data and avoiding repeated error banners for connectivity-only failures.
- Route integrity cleanup:
  - removed redundant stack route declarations that could cause layout-child mismatch warnings,
  - kept route + API checks green (`routes:check`, `api:routes:check`, `contracts:check`).

## 2.1.0 - 2026-02-16
- Fixed create-item flow for `/item/new` by treating missing route `id` as create mode in `ItemDetailScreen`.
- Added automated route integrity validation (`npm run routes:check`) for:
  - `Stack.Screen` declarations vs existing files.
  - hardcoded `router.push/replace/navigate` targets.
  - duplicate route detection.
- Added client-backend API contract validation (`npm run api:routes:check`) and combined gate (`npm run contracts:check`) to catch endpoint and method mismatches early.
- Hardened API retry behavior to avoid retrying non-idempotent mutations (`POST/PATCH/PUT/DELETE`) and reduce duplicate write risk on unstable networks.
- Upgraded shell UX:
  - glass-style bottom navigation container.
  - centered floating action button.
  - quick-operations drawer (new bill, add item, add party, scan, business suite).
  - profile avatar shortcut.
- Improved connectivity UX:
  - floating offline/online status pill.
  - queued mutation count surfaced when offline.
- Refined visual style toward a lightweight glassmorphism treatment in shared UI surfaces (`AppCard`, `PageHeaderCard`, `LoadingScreen`, login card polish).
- Updated smoke E2E tooling to auto-load local `.env` values so `npm run smoke:e2e` works without manual `SMOKE_*` shell exports.
- Added explicit stack registration for `business-suite`, `item/new`, and `item/[id]` in `app/(main)/_layout.tsx` to keep nested route resolution deterministic.

## 1.0.1 - 2026-02-16
- Added multi-store organization controls with company switching and organization-scoped API context.
- Added Business Suite enhancements for staff permission management, signature controls, and fee reminder tooling.
- Fixed organization membership filtering in backend organization listing to prevent cross-org visibility issues.
