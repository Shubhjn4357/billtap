# BillTap

BillTap is an Expo + React Native billing app for small merchants.
It includes inventory management, checkout with atomic stock validation, invoice PDF generation, and sales reporting.

## Stack

- Expo SDK 54 + Expo Router
- React Native 0.81 / React 19
- Firebase Auth + Firestore
- Zustand state management
- React Native Paper UI

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` from `.env.example` and fill Firebase + Google OAuth values.

3. Start the app:

```bash
pnpm start
```

## Environment Variables

Required keys are documented in `.env.example`:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

## Static Text System

All app legal copy, company identity, changelog text, sitemap labels, and Settings static labels are centralized in:

- `src/constants/staticText.ts`
- Date helpers used across app screens/layout are centralized in:
- `src/utils/date.ts`

If you want to change product/company values globally (for example `AutoLoop`, support emails, app legal dates, policy wording), edit:

- `BRAND` object in `src/constants/staticText.ts`

If you want to update policy/legal sections, edit:

- `TERMS_SECTIONS` in `src/constants/staticText.ts`
- `PRIVACY_SECTIONS` in `src/constants/staticText.ts`

If you want to update app UI labels/messages globally, edit:

- `SETTINGS_TEXT`, `COMMON_TEXT`, `AUTH_TEXT`, `ONBOARDING_TEXT`, `BUSINESS_SETUP_TEXT`
- `SUBSCRIPTION_TEXT`, `ADMIN_TEXT`, `BILLING_TEXT`, `REPORTS_TEXT`, `STOCK_TEXT`

## Scripts

- `pnpm start` - start Metro
- `pnpm android` - run Android dev target
- `pnpm ios` - run iOS dev target
- `pnpm web` - run web dev target
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run TypeScript checks
- `pnpm test` - run unit tests
- `pnpm test:watch` - run tests in watch mode
- `pnpm test:coverage` - run tests with coverage
- `pnpm doctor` - run Expo Doctor
- `pnpm build:web` - static web export smoke test

## Current Product Coverage

- Authentication:
  - Google sign-in (env-configured)
  - Phone OTP on native builds
- Inventory:
  - Add/edit/delete items
  - Barcode-assisted search flow
- Billing:
  - Cart-based checkout
  - Currency-aware totals and invoices
  - Atomic stock validation and decrement in Firestore transaction
  - PDF invoice sharing
- Insights:
  - Dashboard summary cards
  - Reports with date-range filters
  - Top product highlights
  - Per-bill PDF sharing
  - Summary report PDF export
- Subscription:
  - Dedicated subscription/payment test screen
  - Four monthly plans
  - Test payment success/failure flows
  - Successful payment writes subscription status + validity dates to user profile
- Admin & Growth:
  - Role-gated admin control panel for user, plans, and offers management
  - Centralized plan pricing (Firestore `plans`) used by subscription screen
  - Marketing offer banners (Firestore `offers`) with audience targeting
  - Automated subscription expiry handling based on validity date
  - Funnel analytics block in admin panel (last 30 days)

## Payment + Automation Stack (Scaffolded)

- Client payment flow:
  - `subscription` screen now supports `Start Live Payment (Scaffold)` via backend endpoint.
  - Secure activation path is webhook-driven (client no longer trusted for real payments).
- Cloud Functions backend (`functions/`):
  - `createSubscriptionCheckout` - creates payment intent scaffold.
  - `paymentWebhook` - verifies payment result and activates subscription on success.
  - `paymentIntentStatus` - checks payment intent status.
  - `seedDefaultPlans` - seeds starter/growth/pro/enterprise plans.
- Scheduled automation:
  - `expireSubscriptionsDaily`
  - `syncOffersBySchedule`
  - `createRenewalTasksDaily`
  - `aggregateFunnelDaily`

## Analytics Events

Tracked events are saved in Firestore collection `analytics_events`:

- `offer_impression`
- `offer_click`
- `subscription_screen_view`
- `plan_selected`
- `checkout_started`
- `checkout_redirected`
- `payment_success`
- `payment_failed`

Admin panel computes funnel conversion rates from these events.

## CI

GitHub Actions (`.github/workflows/android_build.yml`) now runs:

1. `expo-doctor`
2. `lint`
3. `typecheck`
4. `test`
5. `build:web` smoke test
6. Android build + artifact upload

## Firestore Security

This repo includes:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

Deploy with Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The bundled rules include ownership checks plus schema/type validation for `users`, `items`, `orders`, `plans`, `offers`, `payment_intents`, and `analytics_events`.

## Cloud Functions Deploy

1. Install function deps:

```bash
cd functions
pnpm install
```

2. Deploy functions:

```bash
firebase deploy --only functions
```

3. Set app env for payment API base URL:

```bash
EXPO_PUBLIC_PAYMENT_API_BASE_URL=https://us-central1-<your-project-id>.cloudfunctions.net
```

## Important Production TODOs

- In `functions/index.js`, replace placeholder payment order/session logic with real provider SDK calls.
- Verify webhook signatures before trusting webhook payloads.
- Prefer setting `admin=true` custom claims for trusted admin identities.
