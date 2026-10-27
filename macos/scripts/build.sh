#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Building Lint.app requires macOS and Xcode Command Line Tools.' >&2
  exit 1
fi
output="${LINT_BUILD_DIR:-$PWD/macos/build}"
app_path="$output/Lint.app"
mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources" "$output/bin"
cp macos/Info.plist "$app_path/Contents/Info.plist"
# ditto updates the bundled site without touching user data or any repository source.
node macos/scripts/prepare-site.mjs "$app_path/Contents/Resources"
sdk="$(xcrun --sdk macosx --show-sdk-path)"
for architecture in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -sdk "$sdk" -target "$architecture-apple-macosx13.0" \
    -framework AppKit -framework WebKit macos/Sources/*.swift -o "$output/bin/Lint-$architecture"
done
xcrun lipo -create "$output/bin/Lint-arm64" "$output/bin/Lint-x86_64" -output "$app_path/Contents/MacOS/Lint"
xcrun swift macos/scripts/icon.swift "$output"
cp "$output/Lint.icns" "$app_path/Contents/Resources/Lint.icns"
codesign --force --deep --sign - "$app_path"
codesign --verify --deep --strict "$app_path"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$output/Lint-macOS.zip"
shasum -a 256 "$output/Lint-macOS.zip" > "$output/Lint-macOS.zip.sha256"
echo "Built $output/Lint-macOS.zip"
