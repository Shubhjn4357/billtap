# Vahi Fix Tracker

## P0 Runtime
- [x] Standardize client error parsing to `{ status, code, message, details }`
- [x] Add explicit subscription/plan/staff error codes from server
- [x] Prevent onboarding hard-fail when optional cloud settings writes fail
- [x] Ensure route error responses are structured and user-readable

## P1 Offline
- [x] Enforce queue-first writes for all app mutations (online + offline)
- [x] Apply optimistic local cache updates before cloud sync attempts
- [x] Mark upgrade-blocked sync failures as `blocked_upgrade`
- [x] Keep queue across relaunch and resume sync automatically
- [x] Add queue count/status visibility in sync/settings surfaces
- [x] Add subscription-upgrade prompt only on sync/start for blocked writes

## P2 UX/Nav
- [x] Move search trigger from floating Go button to fixed top-app-bar search icon
- [x] Open search as full-screen bottom modal/sheet
- [x] Replace text save buttons with save icon action in headers
- [x] Convert signature capture modal to full-screen canvas workflow
- [x] Keep single-header pattern (no duplicate navigation headers)
- [x] Add local app preferences screen under More (theme + local UX controls)

## P3 Billing/Inventory
- [x] Ensure stock visibility/linking in sales and POS create flows
- [x] Ensure local-save success message for cloud-failed writes
- [x] Add subscription cycle tabs (Monthly / Yearly / 3-Year) in subscription screen
- [x] Add dashboard announcement/offer banner section
- [x] Add skeleton loading blocks in high-traffic screens
- [x] Keep/validate delete controls for inventory and ledgers where allowed

## P4 Admin/API
- [x] Align admin client payload/types with server contract changes
- [x] Add explicit target business support for admin manual subscription updates
- [x] Ensure app refreshes subscription on launch/foreground/org change
- [x] Verify staff invite request/response path and messages

## P5 Verification
- [x] Keep `lint` + `typecheck` + route/API contract checks in required path
- [x] Keep runtime API smoke verification in required path
- [x] Exclude `smoke:web` from required CI path
- [x] Keep `smoke:web` optional/manual only
