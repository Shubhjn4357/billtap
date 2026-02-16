# BillTap Client

Expo app for billing, inventory, accounting, staff, and admin modules.

## Local Setup

```bash
cd client
cp .env.example .env
pnpm install
pnpm start
```

## Required Env

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

Optional:

- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_ENABLE_LIVE_PAYMENTS`
- `EXPO_PUBLIC_WHATSAPP_DELIVERY_MODE` (`device` or `cloud`)

## Quality Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm doctor
pnpm smoke:e2e
```

Smoke E2E requires:

- `SMOKE_API_BASE_URL`
- `SMOKE_PHONE_NUMBER`

Optional:

- `SMOKE_OTP_CODE`
- `SMOKE_CREATE_SECOND_STORE`
- `SMOKE_REMINDER_RECIPIENT`

APK helper scripts:

```bash
pnpm apk:build:preview
pnpm apk:build:production
```

## Android CI/CD

Workflow: `.github/workflows/android_release_build.yaml`

Triggers on `dev` branch push/PR and builds:

- debug APK
- release APK
- signing fingerprints artifact

## Local SHA + Keystore Utility

```bash
pnpm run android:signing-info
```

With release keystore/base64:

```bash
pnpm run android:signing-info -- \
  --release-keystore android/app/release.keystore \
  --release-alias <alias> \
  --release-store-pass <store_password> \
  --release-key-pass <key_password> \
  --base64
```

## GitHub Secrets (for signed release APK)

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `SMOKE_API_BASE_URL`
- `SMOKE_PHONE_NUMBER`

Optional smoke secrets:

- `SMOKE_OTP_CODE`
- `SMOKE_CREATE_SECOND_STORE`
- `SMOKE_REMINDER_RECIPIENT`

## Google OAuth Console Values

- Android package: `com.autoloop.billtap`
- Native redirect scheme: `billtap://oauthredirect`
- Web redirects: `/oauthredirect` on your web origin(s)
