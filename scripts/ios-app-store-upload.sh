#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
BUILD_DIR="$IOS_DIR/build/AppStore"
BUILD_ID="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_PATH="$BUILD_DIR/DokanApp-$BUILD_ID.xcarchive"
EXPORT_PATH="$BUILD_DIR/upload-$BUILD_ID"
EXPORT_OPTIONS="$IOS_DIR/ExportOptionsAppStoreUpload.plist"

ASC_KEY_ID="${ASC_KEY_ID:-1503K6JNYFOC}"
if [[ -z "${ASC_KEY_PATH:-}" ]]; then
  if [[ -f "/Users/nour/Downloads/ApiKey_${ASC_KEY_ID}.p8" ]]; then
    ASC_KEY_PATH="/Users/nour/Downloads/ApiKey_${ASC_KEY_ID}.p8"
  else
    ASC_KEY_PATH="/Users/nour/Downloads/AuthKey_${ASC_KEY_ID}.p8"
  fi
fi
ASC_ISSUER_ID="${ASC_ISSUER_ID:-}"

if [[ -z "$ASC_ISSUER_ID" ]]; then
  echo "Missing ASC_ISSUER_ID. Find it in App Store Connect > Users and Access > Integrations > App Store Connect API." >&2
  exit 2
fi

if [[ ! -f "$ASC_KEY_PATH" ]]; then
  echo "Missing App Store Connect key at: $ASC_KEY_PATH" >&2
  exit 2
fi

mkdir -p "$BUILD_DIR" "$EXPORT_PATH"

xcodebuild \
  -workspace "$IOS_DIR/DokanApp.xcworkspace" \
  -scheme DokanApp \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  CODE_SIGNING_ALLOWED=NO

xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"
