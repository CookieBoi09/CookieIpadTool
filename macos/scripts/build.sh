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
    -framework AppKit -framework WebKit -framework Security macos/Sources/*.swift -o "$output/bin/Lint-$architecture"
done
xcrun lipo -create "$output/bin/Lint-arm64" "$output/bin/Lint-x86_64" -output "$app_path/Contents/MacOS/Lint"
xcrun swift macos/scripts/icon.swift "$output"
cp "$output/Lint.icns" "$app_path/Contents/Resources/Lint.icns"
codesign --force --deep --sign - "$app_path"
codesign --verify --deep --strict "$app_path"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$output/Lint-macOS.zip"
shasum -a 256 "$output/Lint-macOS.zip" > "$output/Lint-macOS.zip.sha256"
# Build a drag-to-Applications disk image using macOS's verified disk-image tools.
dmg_stage="$(mktemp -d "$output/dmg-stage.XXXXXX")"
trap 'rm -rf "$dmg_stage"' EXIT
ditto "$app_path" "$dmg_stage/Lint.app"
ln -s /Applications "$dmg_stage/Applications"
hdiutil create -volname Lint -srcfolder "$dmg_stage" -ov -format UDZO "$output/Lint-macOS.dmg"
hdiutil verify "$output/Lint-macOS.dmg"
(cd "$output" && shasum -a 256 Lint-macOS.dmg > Lint-macOS.dmg.sha256)
echo "Built $output/Lint-macOS.dmg and $output/Lint-macOS.zip"
