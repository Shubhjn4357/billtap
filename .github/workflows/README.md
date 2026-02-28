# Vahi Mobile CI/CD

This folder contains fully automated Android and mobile quality workflows.

## Workflows

- `mobile-ci.yml`
  - Triggers: PR/push on `dev` and `main`, manual dispatch.
  - Runs: `doctor`, `lint`, `typecheck`, and web smoke build.

- `android-dev-track.yml`
  - Triggers: push on `dev` (automatic), manual dispatch.
  - Default behavior on `dev` push:
    - Validate code quality.
    - Generate Android release keystore non-interactively.
    - Build both debug and release `.apk`.
    - Upload both APK artifacts and signing metadata artifact.
    - Build-only by default (no Play upload).
    - Play upload only when `skip_play_upload=false`.

- `android-release.yml`
  - Triggers: tag push matching `v*`, manual dispatch.
  - Builds both debug and release `.apk`, exports signing/release metadata.
  - Build-only by default; publishes to Play only when `skip_play_upload=false`.

- `android-debug.yml`
  - Triggers: push/PR on `dev` and `main`, manual dispatch.
  - Validates code quality and builds debug `.apk` artifact only.

## Required GitHub secrets

- `ANDROID_KEYSTORE_BASE64` (recommended and required for Play uploads in CI)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_DNAME` (optional; default also handled by script)
- `ANDROID_PACKAGE_NAME`
- `PLAY_SERVICE_ACCOUNT_JSON`
- `EXPO_PUBLIC_API_BASE_URL` (or repo variable fallback)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (secret or variable)
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (secret or variable)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (secret or variable)

If you are running build-only mode (`skip_play_upload=true`), Play secrets are not required.

## Keystore automation

The script `scripts/generate-android-keystore.sh` is non-interactive (`keytool -noprompt`) and outputs:

- `sha1`
- `sha256`
- `keystore_path`
- `source` (`secret` when restored from `ANDROID_KEYSTORE_BASE64`, otherwise generated/reused local file)

Those values are exported into workflow outputs and build metadata artifacts.

### Recommended signing setup

1. Generate your keystore once (local secure machine).
2. Base64-encode it and store as `ANDROID_KEYSTORE_BASE64` secret.
3. Keep alias/password secrets matching that keystore.

This keeps all dev/release uploads fully automated and stable across runs.
