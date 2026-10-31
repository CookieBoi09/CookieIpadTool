# Lint for macOS

Native AppKit + WKWebView app for macOS 13+. It bundles the current Lint website: math/LaTeX and Python/Java cards, answer practice and comparison, explanations, spaced repetition and restudy, flashcard folders and JSON backups. Notes are excluded from the desktop bundle; existing stored note data is not deleted. It has no backend subscription or paid API.

## Build

On a Mac with Xcode Command Line Tools and Node 20+:

```sh
npm ci
bash macos/scripts/build.sh
open macos/build/Lint.app
```

This compiles arm64 and x86_64 binaries, combines them with `lipo`, bundles all offline web assets, generates the icon, and ad-hoc signs the app. Output: `macos/build/Lint-macOS.dmg` (drag Lint to Applications), plus a ZIP alternative and SHA-256 checksums. The disk image is verified with `hdiutil verify`. No paid developer identity is required. Public distribution is not notarized; Gatekeeper may require the user to explicitly allow Lint in System Settings → Privacy & Security. Do not disable Gatekeeper globally.

The `main` and `lint-macos` branches trigger `.github/workflows/macos.yml` on a standard GitHub-hosted macOS runner. Standard runners are free for public repositories under GitHub's service limits. The workflow builds a universal app, runs a native WKWebView smoke test, and publishes the DMG, ZIP, and checksums to `gh-pages/downloads/` on success. Build output/status are published separately so failures can be diagnosed without claiming an app exists.

The native smoke test runs with non-persistent web storage and checks that the bundled UI loads, Notes is absent, and the coding editor opens. It cannot test a physical trackpad, manual file dialogs, or Gatekeeper.

## Data and security boundaries

The app uses WKWebView's persistent local storage. It does not access the Safari/Chrome website's storage automatically. Export flashcards from the website, then restore them in the app. This is manual transfer, not synchronization. Notes are no longer included in the desktop app; existing note data is not erased.

Only bundled local pages can navigate inside the native window. File imports and backup exports use native open/save panels.
