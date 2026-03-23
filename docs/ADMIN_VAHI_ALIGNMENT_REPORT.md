# Admin vs Vahi Alignment Report

Date: 2026-03-23

## Scan Summary

Before this sweep, admin covered platform operations such as plans, subscriptions, inventory, transactions, templates, notifications, and feature flags, but it did not expose the full business-level Vahi settings and customization surface.

## Gaps Found During Comparison

1. Business settings mismatch
- Vahi had a full per-business settings schema across invoicing, inventory, printing, security, backup, and multi-firm.
- Admin only exposed shallow global settings and separate isolated tools.

2. Missing business profile fields
- Admin organization forms did not expose several business fields that Vahi uses directly, including legal name, state, PAN, category, books start date, and logo URL.

3. Module and feature controls were isolated
- Admin had feature flags, but they were not connected to the settings/customization workspace where business owners are usually managed.

4. Navigation fragmentation
- Admin did not provide one clear control center that matched Vahi’s business-centric model.

## Sweep Implemented

1. Added admin-managed business settings schema endpoints in the server
- Admin can now read schema, read all settings, read a single section, update a section, and reset a section for any business.

2. Rebuilt admin settings into a business-aware control center
- Global platform settings remain available.
- A selected business now exposes:
  - business profile editing
  - module access and visibility controls
  - feature flag controls
  - per-section Vahi settings editing grouped by Business, Invoicing, Inventory, and Printing

3. Expanded organization metadata handling
- Organization list/detail/update flows now include legal name, state, PAN, category, books start date, and logo URL.

4. Improved admin navigation linkage
- Organizations now link directly into the control center for a selected business.
- Dashboard and sidebar labels were updated to point toward the rebuilt control center.

## Remaining Minor Gaps

1. Admin still does not have dedicated standalone pages for every Vahi domain
- For example, parties-specific and report-specific admin pages are still represented indirectly through transactions, treasury, inventory, and the control center.

2. Template editing is still more technical than ideal
- The template manager is functional, but it still exposes generic content structures rather than a full no-code designer.

These are lower priority than the business settings and module-control alignment completed in this sweep.
