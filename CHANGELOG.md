# Changelog

All notable changes to Vahi are documented in this file.

## 4.2.0 - 2026-03-23

- Reworked Vahi with the new minimal shell, cleaner navigation, calmer surfaces, and stronger route/back-flow handling.
- Fixed subscription gating, invoice draft preservation, GST behavior, POS stock clamping, and module access alignment across app, admin, and server.
- Removed SMS and WhatsApp as active product channels, keeping notifications and announcements only.
- Added admin follow-up for banners and announcements with route-targeted CTA selection, schedule fields, and live app redirect support.

## 4.1.0 - 2026-02-28

- Expanded accounting modules with cash and bank operations, loan workflows, and godown support.
- Improved POS and billing flows with scan integration and invoice share improvements.
- Added API contract verification and stronger CI/CD verification steps.
- Added in-app legal center with dedicated Terms, Privacy Policy, About, and Changelog screens.

## 4.0.0 - 2026-02-20

- Introduced the new Vahi React Native architecture with typed routing and API layer.
- Integrated Cloudflare Worker APIs with Neon PostgreSQL backend foundation.
- Added subscription and feature-flag based capability gating.
