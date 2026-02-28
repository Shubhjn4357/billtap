#!/usr/bin/env bash
set -euo pipefail

# Generates an Android keystore non-interactively for CI/CD use.
# Required env vars:
#   ANDROID_KEYSTORE_PASSWORD
#   ANDROID_KEY_ALIAS
#   ANDROID_KEY_PASSWORD
#
# Optional env vars:
#   ANDROID_KEYSTORE_PATH (default: android/app/release.keystore)
#   ANDROID_KEYSTORE_BASE64 (preferred for stable CI signing; base64 of keystore file)
#   ANDROID_KEY_DNAME (default: CN=Vahi,O=Vahi,C=IN)
#   ANDROID_KEY_VALIDITY_DAYS (default: 10000)
#   ANDROID_KEY_SIZE (default: 2048)
#   ANDROID_KEY_ALG (default: RSA)

KEYSTORE_PATH="${ANDROID_KEYSTORE_PATH:-android/app/release.keystore}"
KEY_DNAME="${ANDROID_KEY_DNAME:-CN=Vahi,O=Vahi,C=IN}"
KEY_VALIDITY_DAYS="${ANDROID_KEY_VALIDITY_DAYS:-10000}"
KEY_SIZE="${ANDROID_KEY_SIZE:-2048}"
KEY_ALG="${ANDROID_KEY_ALG:-RSA}"

if [[ -z "${ANDROID_KEYSTORE_PASSWORD:-}" ]]; then
  echo "ANDROID_KEYSTORE_PASSWORD is required" >&2
  exit 1
fi
if [[ -z "${ANDROID_KEY_ALIAS:-}" ]]; then
  echo "ANDROID_KEY_ALIAS is required" >&2
  exit 1
fi
if [[ -z "${ANDROID_KEY_PASSWORD:-}" ]]; then
  echo "ANDROID_KEY_PASSWORD is required" >&2
  exit 1
fi

mkdir -p "$(dirname "$KEYSTORE_PATH")"

# Prefer deterministic keystore restore in CI when provided.
if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
  echo "Decoding keystore from ANDROID_KEYSTORE_BASE64 into $KEYSTORE_PATH"
  echo "$ANDROID_KEYSTORE_BASE64" | tr -d '\r\n ' | base64 --decode > "$KEYSTORE_PATH"
elif [[ -f "$KEYSTORE_PATH" ]]; then
  echo "Keystore already exists at $KEYSTORE_PATH. Reusing it."
else
  echo "No keystore secret found. Generating keystore non-interactively."
  keytool -genkeypair -noprompt \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_PATH" \
    -alias "$ANDROID_KEY_ALIAS" \
    -storepass "$ANDROID_KEYSTORE_PASSWORD" \
    -keypass "$ANDROID_KEY_PASSWORD" \
    -dname "$KEY_DNAME" \
    -keyalg "$KEY_ALG" \
    -keysize "$KEY_SIZE" \
    -validity "$KEY_VALIDITY_DAYS"
fi

SHA1="$(keytool -list -v -keystore "$KEYSTORE_PATH" -storepass "$ANDROID_KEYSTORE_PASSWORD" -alias "$ANDROID_KEY_ALIAS" | awk -F': ' '/SHA1:/{print $2; exit}')"
SHA256="$(keytool -list -v -keystore "$KEYSTORE_PATH" -storepass "$ANDROID_KEYSTORE_PASSWORD" -alias "$ANDROID_KEY_ALIAS" | awk -F': ' '/SHA256:/{print $2; exit}')"

cat <<EOF
Generated/validated keystore:
  path: $KEYSTORE_PATH
  alias: $ANDROID_KEY_ALIAS
  dname: $KEY_DNAME
  sha1: $SHA1
  sha256: $SHA256
EOF

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "keystore_path=$KEYSTORE_PATH"
    echo "sha1=$SHA1"
    echo "sha256=$SHA256"
    if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
      echo "source=secret"
    else
      echo "source=generated_or_existing_file"
    fi
  } >> "$GITHUB_OUTPUT"
fi
