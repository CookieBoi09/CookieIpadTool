# Connect Lint for Mac to Notion

Lint 1.1.0 adds two-way, on-demand flashcard sync through the **Notion** menu in the Mac menu bar. Choose **Sync Now** whenever you want to exchange changes. It is not continuous background sync, and the website does not connect to Notion.

## 1. Create a Notion connection

1. Visit https://www.notion.so/profile/integrations and create an **internal integration** in your workspace, named `Lint`.
2. Enable **Read content**, **Update content**, and **Insert content**. No user information access is needed.
3. Copy its integration token. Enter it only in Lint's connection dialog—not in chat, a flashcard, or your repository.

Notion's official setup documentation: https://developers.notion.com/docs/create-a-notion-integration.

## 2. Prepare your database

Create a full-page table database with these exact property names and types:

| Property | Notion type | Contents |
| --- | --- | --- |
| Front | Title | The question; rename the existing title column |
| Back | Text | The answer |
| Deck | Text | Deck name; a blank value imports into `Notion` |
| Kind | Select | `math` or `coding`; blank defaults to `math` |
| Language | Select | `python`, `java`, `javascript`, or `swift`; blank defaults to `python` |
| Explanation | Text | Optional explanation |
| Lint ID | Text | Leave empty for new Notion cards; Lint fills it automatically |

For an existing Lint library, starting with an empty Notion database avoids importing copies of the same cards. Otherwise each existing row is treated as a new card. Front and Back must both be nonempty. Page-body blocks, attachments, rich-text styling, and formulas are not imported; the table properties are the source of card content. LaTeX and code can be entered as plain text. Each text field supports up to 2,000 characters.

In the database's **••• → Connections**, add your `Lint` integration. Depending on your Notion UI, this may be labeled **Add connections**. Copy the database's link. Use a database with one data source, or provide the specific data source ID for a database with multiple sources.

## 3. Connect and sync in Lint

1. Export a flashcard backup before the first sync.
2. Open **Notion → Connect Notion…** in the Mac menu bar.
3. Paste the database link and token, then save. The token is stored in macOS Keychain; it is never passed to the embedded web page or included in backups.
4. Close any card editor and choose **Notion → Sync Now…**. Confirm the transfer of your flashcard content to the connected database.
5. Edit cards in either app. Choose **Sync Now…** again to exchange the changes. Keep Lint open until it finishes.

A blank token field in Connect Notion preserves the saved token. **Disconnect…** removes the token and connection without deleting any flashcards or Notion rows.

## Sync rules

- All local flashcards participate. Questions, answers, explanations, type, language, and deck names sync in both directions.
- Due dates, intervals, review history, and folder nesting stay local. Matching deck names refer to the same deck when importing. Renaming a Notion card's Deck moves it into that local deck; an unused old deck may remain.
- **Keep Lint ID unchanged.** It matches the same card across syncs. Do not copy it into another row.
- If both copies changed since the last successful sync, neither overwrites the other. The summary lists the conflicts. Edit both copies to match the version you want, then sync again.
- Deletions and archiving do **not** propagate. A previously synced card deleted in one app is not automatically recreated there. Remove unwanted cards on both sides yourself.
- New Notion rows need nonempty Front and Back values. A malformed row or missing property stops sync with an explanation.
- Completed rows are saved if a later request fails. Sync again after fixing the problem. Timed-out creates are reconciled using Lint ID rather than blindly retried.
- Sync is limited to 10,000 Notion rows. Notion's rate limits are respected. Keep other editors of the same database idle during sync: the API does not provide atomic compare-and-swap updates, so an edit made at the exact moment of a write can still race with it.
- Matching information is stored separately from flashcard backups on this Mac. Restoring a backup on another Mac may require resolving divergent copies on first sync. It does not sync scheduling between Macs.

## Verification and privacy

Requests go directly from the Mac to `https://api.notion.com` using native HTTPS. Lint has no sync server. Notion stores the content you send under your workspace's access settings. The app cannot verify a private database until you supply its connection locally. Automated tests use mock Notion responses and exercise conflict handling, pagination, repeatability, review-history preservation, and interrupted operations; they do not certify access to your workspace.
