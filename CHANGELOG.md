# Changelog

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
