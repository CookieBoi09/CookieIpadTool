# Lint for macOS

Native AppKit + WKWebView app for macOS 13+. It bundles the current Lint website: math/LaTeX and Python/Java cards, answer practice and comparison, explanations, spaced repetition and restudy, nested folders, notes, pen/highlighter, and separate backups. It has no backend subscription or paid API.

## Trackpad integration

This uses public AppKit APIs: `NSView.allowedTouchTypes`, `NSTouch.normalizedPosition`, `NSEvent.touches(matching:in:)`, and the standard touch responder methods. The normalized position is available for indirect touches in Lint's own window. It does not use a private MultitouchSupport framework, a global input tap, a browser extension, or Accessibility/Input Monitoring permissions.

1. Create a new note. Native notes use a 1000 × 1400 logical drawing page; existing notes retain their original size.
2. Move the cursor over the page to position the dotted 400 × 250 rectangle. Click the page if focus is still in a text editor.
3. Hold Space, then place one finger on the trackpad. The rectangle locks, and normalized finger coordinates map inside it. This is absolute positioning, independent of cursor acceleration.
4. Lift your finger between strokes. Release Space to stop drawing and move the rectangle or scroll normally.

Only one active, non-resting indirect touch draws. A second finger ends the stroke. Scroll events remain available; window blur, key release, touch cancellation, or closing the note ends drawing. The OS cursor is not globally hidden or constrained. Raw input is accepted only while Lint is the key window and Space has armed the overlay.

Some devices/OS versions may not begin a touch sequence until you lift and replace your finger after arming. If there is no touch input, an inline message explains this. Turn **Trackpad positioning** off for cursor-based drawing in the same rectangle. A mouse can use that fallback. Physical hardware testing is still required; simulated browser events validate mapping and persistence, not delivery of real NSTouch events.

Apple API references:
- https://developer.apple.com/documentation/appkit/nstouch/normalizedposition
- https://developer.apple.com/documentation/appkit/nsview/allowedtouchtypes

## Build

On a Mac with Xcode Command Line Tools and Node 20+:

```sh
npm ci
bash macos/scripts/build.sh
open macos/build/Lint.app
```

This compiles arm64 and x86_64 binaries, combines them with `lipo`, bundles all offline web assets, generates the icon, and ad-hoc signs the app. Output: `macos/build/Lint-macOS.zip` and SHA-256 checksum. No paid developer identity is required. Public distribution is not notarized; Gatekeeper may require the user to explicitly allow Lint in System Settings → Privacy & Security. Do not disable Gatekeeper globally.

The `lint-macos` branch triggers `.github/workflows/macos.yml` on a standard GitHub-hosted macOS runner. Standard runners are free for public repositories under GitHub's service limits. The workflow builds a universal app, runs a native WKWebView smoke test, and publishes the zip and checksum to `gh-pages/downloads/` on success. Build output/status are published separately so failures can be diagnosed without claiming an app exists.

The native smoke test runs with non-persistent web storage and checks that the bundled UI loads, a large note saves, trackpad controls appear, and the coding editor opens. It cannot test a physical trackpad, manual file dialogs, or Gatekeeper.

## Data and security boundaries

The app uses WKWebView's persistent local storage. It does not access the Safari/Chrome website's storage automatically. Export flashcards and notes separately from the website, then restore them using the matching controls in the app. This is manual transfer, not synchronization. The updated website understands large-page note backups.

Only bundled local pages can navigate inside the native window. The native message handler accepts main-frame messages from its bundled site path and only supports enable/arm controls. Touch messages carry normalized coordinates and gesture state; no shell, arbitrary filesystem, or network API is exposed to page JavaScript. File imports and backup exports use native open/save panels.

The native notes script is bundled into a classic script for WKWebView file loading; it does not depend on file-origin ES-module imports. The existing flashcard bundle remains shared with the website.
