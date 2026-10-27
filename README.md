# Lint

Lint is a free static flashcard and notes web app hosted with GitHub Pages:

https://cookieboi09.github.io/CookieIpadTool/

## Restudy a deck

Open any deck and select **Restudy deck** to practice every card, including cards that are not due. Reveal each answer, then use **Next card** or **Finish practice**. This practice mode leaves due dates, intervals, and review history unchanged. It works for math and coding cards; coding attempts start blank for each new session.

The completion screen also offers **Restudy deck**, so you can immediately go through the deck again. Empty decks have the option disabled until a card is added. **Study now** continues to review only due cards and update their schedules normally.

## Coding cards: practice, solution, and explanation

When creating or editing a coding card, enter the saved solution in the code editor and add a separate **Explanation** below it. Both fields are saved in the card and included in flashcard JSON backups; older cards without explanations remain compatible.

During study, **Your answer** is an empty Python/Java editor beneath the question. The saved solution and explanation remain hidden until **Reveal answer**. Revealing preserves your attempt and shows the saved code alongside it, followed by the explanation and a text-comparison summary. **View line-by-line differences** highlights lines unique to each answer. After editing your attempt, use **Compare again** to refresh the result.

Comparison does not execute code or determine functional correctness. Different valid implementations may differ from the saved solution. It normalizes line endings but preserves spaces and indentation. Blank attempts are identified separately, and very large answers skip line-level highlighting to keep the interface responsive. Review attempts are temporary for the current study session and never overwrite the saved solution. The Again/Hard/Good/Easy rating remains your choice.

## Notes

Open **Notes** in the main sidebar (inside the library menu on a phone). Create nested folders and notes; rename folders, move notes with the folder picker, and search notes within a folder or across **All notes**. Removing a folder keeps its notes and subfolders by moving them up one level. Deleting a note requires confirmation.

Notes have a title, a text area, and a bounded drawing area marked with a dotted outline.

- Scroll normally with the mouse wheel or a Mac trackpad's two-finger gesture.
- To draw, move the pointer into the drawing area, **hold Space**, and move the mouse or use the trackpad to move the pointer. You do not need to hold the mouse button. Release Space to stop.
- If you were typing, click the drawing area first to move focus out of the text field. Space still types spaces inside text fields and activates focused buttons normally.
- Choose **Pen** or **Highlighter**, then choose an ink color and width. Highlighter strokes are translucent.
- Drawing is clipped to the dotted boundary. Leaving the boundary ends the current stroke; re-entering starts a separate stroke without joining the two points.
- Undo, redo, and clear apply to drawings. Clearing drawings requires confirmation and preserves note text.
- Stylus contact can also draw; ordinary touch gestures scroll. Window blur, pointer cancellation, or hiding the tab ends the current drawing gesture.

This uses standard browser pointer, keyboard, and wheel events. Browsers do not expose a Mac trackpad as an absolute-position drawing tablet: one-finger pointer motion draws while Space is held; two-finger gestures scroll. No native macOS integration or permissions are needed.

### Storage

Notes autosave to `lint.web.notes.v1` in browser localStorage. Existing flashcards retain `lint.web.library.v1`; adding notes does not reset or migrate them. Notes and flashcards have separate backup buttons and formats. Notes backups include folder relationships, text, and vector strokes. Export a notes backup before clearing browser data. Data does not sync across devices.

Save failures are shown as **Not saved**, keeping the current working copy available for export. Corrupt saved data is preserved instead of overwritten. Another tab changing an open note blocks further writes until the conflict is resolved by export/reload. Notes backups validate folder references and bounds on drawing points.

## Development

```sh
npm ci --cache /workspace/.cache/npm
npm start
```

Serves `site/` on port 5173. On other machines, omit the cache override. This static site has no build step, paid backend, API credentials, or external runtime dependencies. HTTPS is required in production; localhost is suitable for development.

```sh
npm test
npm run test:browser
```

Browser tests use `/usr/bin/chromium` in the cloud workspace. Adapt `playwright.config.js` to an installed browser elsewhere. The test runner uses port 5173, so stop your development server before running tests.

- `site/notes/`: readable notes application source, model/backup validation, input controller, and styling.
- `site/app.js`, `site/app.css`, `site/fonts/`: dependency bundle based on the deployed flashcard build from commit `a7e810fc3216f755924d86564a076d2d11dd8425`. It supports math and Python/Java coding cards. The coding review and explanation changes are applied with guarded patches from readable sources in `src/`. Run `python3 scripts/update-flashcards.py` after changing `src/review.js` or `src/comparison.js`; the script preserves the bundled dependencies. Do not otherwise regenerate or replace this bundle without recovered source and regression tests.
- `site/index.html`: loads both independent application sections. `site/.nojekyll` keeps GitHub Pages from transforming the static files.
- `tests/`: node model tests and browser integration tests.

The cloud workspace was replaced before notes work began. The prior uncommitted native/flashcard source was absent in the replacement environment, so the previously deployed flashcard build was recovered from `origin/gh-pages` and retained. Notes source is served directly as ES modules and preserved with the deployment. This repository contains no newly built native iPad version of the notes feature.

## Validation

Coverage includes normal scroll vs. Space drawing, clipped stroke boundaries, pen/highlighter settings, undo/redo, blur release, Space in text inputs, nested folder operations, reload persistence, backup isolation, corrupt-data preservation, desktop/mobile layout, and the existing flashcard Python/Java selector.

Browser interaction tests run in Linux Chromium. Physical Mac trackpad and Safari behavior still need device testing.
