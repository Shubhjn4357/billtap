# Vahi Billing App

Vahi is a React Native (Expo) app for Indian GST billing, inventory, POS, cash-bank, loans, and business accounting with Cloudflare Workers + Neon backend and a separate admin app.

## Tech Stack

- Mobile app: Expo + React Native + Expo Router + TypeScript
- API: Cloudflare Workers + Hono + Drizzle ORM
- Database: Neon PostgreSQL
- Admin: Next.js (App Router) on Vercel
- Validation and contracts: Zod + shared domain types

## App Modules

- Billing: sales invoice, POS, credit/debit note, estimates, orders
- Inventory: item master, stock, godown support, scan flows
- Accounts: ledgers, expenses, cash and bank, loans, contra
- Reports: GST and financial reports
- Settings: section-wise feature settings
- Legal: terms, privacy, version changelog, app about

## Screen Navigation (High Level)

- Login: `/(auth)/login`
- Main tabs: `/(main)`
- Settings root: `/settings`
- Legal center: `/legal`
- Terms: `/legal/terms`
- Privacy: `/legal/privacy`
- Changelog: `/legal/changelog`
- About: `/legal/about`

The legal screens are linked from:

- Login consent block
- More tab (Legal section)
- Settings root (Legal and Compliance card)

## Docs

- Terms of Service: `docs/TERMS_OF_SERVICE.md`
- Privacy Policy: `docs/PRIVACY_POLICY.md`
- Changelog: `CHANGELOG.md`

## Getting Started

1. Install dependencies

```bash
pnpm install
```

2. Start Expo

```bash
pnpm start
```

3. Run Android dev client

```bash
pnpm android
```

## Quality and Verification

- Doctor: `pnpm doctor`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- API contract verification: `pnpm verify:api-contract`
- Web smoke build test: `pnpm smoke:web`
- CI unified verification (doctor + lint + typecheck + API contract + web smoke): `pnpm verify:ci`
- Pre-push full verification: `pnpm verify:prepush`

## CI/CD Workflows

- Android debug APK: `.github/workflows/android-debug.yml`
- Android dev-track pipeline: `.github/workflows/android-dev-track.yml`
- Android release APK pipeline: `.github/workflows/android-release.yml`

## Android Signing and Release Secrets

Use repository secrets (or local env values) for signing and packaging:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_PACKAGE_NAME`
- `PLAY_SERVICE_ACCOUNT_JSON` (optional if Play upload is not used)

## Local APK Build (No Play Account Required)

You can build and install APK locally without Play Console integration:

```bash
pnpm android
```

For CI signing flows, keep keystore values in `.env` locally and GitHub Actions secrets in CI.
