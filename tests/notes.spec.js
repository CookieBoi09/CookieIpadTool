import { test, expect } from "@playwright/test";
const saved = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("lint.web.notes.v1")));
async function open(page) {
  await page.getByRole("button", { name: "Notes", exact: true }).click();
}
async function create(page, title = "Lecture one") {
  await open(page);
  await page.locator("#notes-new-note").click();
  await page.getByLabel("Note title", { exact: true }).fill(title);
}
async function board(page) {
  const canvas = page.locator("#note-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  await page.mouse.click(rect.x + rect.width * 0.2, rect.y + rect.height * 0.3);
  return rect;
}
async function stroke(page, rect) {
  await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height * 0.3);
  await page.keyboard.down("Space");
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.6, {
    steps: 12,
  });
  await page.keyboard.up("Space");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("normal pointer movement does not draw; holding Space draws and persists", async ({
  page,
}) => {
  await create(page);
  await page.getByLabel("Note text", { exact: true }).fill("A typed thought.");
  const rect = await board(page);
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.5, {
    steps: 6,
  });
  await expect(page.locator("#note-canvas path")).toHaveCount(0);
  await stroke(page, rect);
  await expect(page.locator('#note-canvas path[data-tool="pen"]')).toHaveCount(
    1,
  );
  await expect(page.locator("#notes-save-state")).toHaveText(
    "Saved on this device",
  );
  let lib = await saved(page);
  expect(lib.notes[0].text).toBe("A typed thought.");
  expect(lib.notes[0].strokes[0].points.length).toBeGreaterThan(5);
  await page.reload();
  await open(page);
  await page
    .getByRole("button", { name: /Lecture one.*A typed thought/ })
    .click();
  await expect(page.locator("#note-canvas path")).toHaveCount(1);
  await expect(page.getByLabel("Note text", { exact: true })).toHaveValue(
    "A typed thought.",
  );
});
test("highlighter, undo, redo, clear confirmation, and scroll work", async ({
  page,
}) => {
  await create(page);
  await page.getByRole("button", { name: "Highlighter", exact: false }).click();
  const rect = await board(page);
  await stroke(page, rect);
  await expect(
    page.locator('#note-canvas path[data-tool="highlighter"]'),
  ).toHaveAttribute("opacity", "0.3");
  expect((await saved(page)).notes[0].strokes[0].width).toBe(24);
  await page.getByRole("button", { name: "Undo drawing" }).click();
  await expect(page.locator("#note-canvas path")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo drawing" }).click();
  await expect(page.locator("#note-canvas path")).toHaveCount(1);
  await page.locator("#note-canvas").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -250);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before);
  await expect(page.locator("#note-canvas path")).toHaveCount(1);
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("#note-canvas path")).toHaveCount(1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("#note-canvas path")).toHaveCount(0);
});
test("leaving the dotted boundary splits strokes; blur releases drawing mode", async ({
  page,
}) => {
  await create(page);
  const r = await board(page);
  await page.keyboard.down("Space");
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.5, {
    steps: 3,
  });
  await page.mouse.move(r.x + r.width + 10, r.y + r.height * 0.5, { steps: 5 });
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.3, {
    steps: 5,
  });
  await page.keyboard.up("Space");
  let lib = await saved(page);
  expect(lib.notes[0].strokes.length).toBe(2);
  expect(
    lib.notes[0].strokes.every((s) =>
      s.points.every(([x, y]) => x >= 0 && x <= 1000 && y >= 0 && y <= 620),
    ),
  ).toBe(true);
  await page.keyboard.down("Space");
  await page.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.4, {
    steps: 3,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#ink-mode")).toHaveText("SCROLL MODE");
  const n = (await saved(page)).notes[0].strokes.length;
  await page.mouse.move(r.x + r.width * 0.6, r.y + r.height * 0.6, {
    steps: 3,
  });
  await page.keyboard.up("Space");
  expect((await saved(page)).notes[0].strokes.length).toBe(n);
});
test("Space types normally in text fields and does not draw", async ({
  page,
}) => {
  await create(page);
  await page.getByLabel("Note text", { exact: true }).fill("Hello");
  await page.keyboard.press("Space");
  await page.keyboard.type("world");
  await expect(page.getByLabel("Note text", { exact: true })).toHaveValue(
    "Hello world",
  );
  await expect(page.locator("#note-canvas path")).toHaveCount(0);
});
test("notes folders nest, notes move, and folder removal preserves notes", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "+ Folder", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Physics");
  await page.getByRole("button", { name: "Create folder" }).click();
  await page
    .getByRole("button", { name: "Manage notes folder Physics" })
    .click();
  await page.getByRole("button", { name: "+ Subfolder" }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Mechanics");
  await page.getByRole("button", { name: "Create folder" }).click();
  await page.locator("#notes-new-note").click();
  await page.getByLabel("Note title", { exact: true }).fill("Momentum");
  await page.getByLabel("Note folder", { exact: true }).selectOption("");
  await expect(page.locator("#notes-save-state")).toHaveText(
    "Saved on this device",
  );
  expect((await saved(page)).notes[0].folderId).toBeNull();
  await page
    .getByRole("button", { name: "Manage notes folder Physics", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove folder", exact: true })
    .click();
  const lib = await saved(page);
  expect(lib.folders[0].parentId).toBeNull();
  expect(lib.notes).toHaveLength(1);
});
test("notes backup export/restore is independent of flashcard data", async ({
  page,
}) => {
  const cards = await page.evaluate(() =>
    localStorage.getItem("lint.web.library.v1"),
  );
  await create(page);
  const rect = await board(page);
  await stroke(page, rect);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export notes backup" }).click();
  expect((await dl).suggestedFilename()).toContain("Lint-notes");
  const lib = await saved(page);
  lib.notes[0].title = "Restored note";
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Restore notes backup" }).click();
  await (
    await chooser
  ).setFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(lib)),
  });
  await expect(
    page.getByRole("button", { name: /Restored note/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("lint.web.library.v1")),
  ).toBe(cards);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make room for what sticks." }),
  ).toBeVisible();
});
test("corrupt note data is preserved and does not break flashcards", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("lint.web.notes.v1", "corrupt notes"),
  );
  await page.reload();
  await open(page);
  await expect(page.locator("#notes-save-state")).toContainText(
    "Original data is preserved",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("lint.web.notes.v1")),
  ).toBe("corrupt notes");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".deck-tile")).toHaveCount(2);
});
test("notes layout fits desktop and mobile; flashcard language options remain Python and Java", async ({
  page,
}) => {
  await create(page, "A page for ideas");
  await page
    .getByLabel("Note text", { exact: true })
    .fill(
      "Write it down. Sketch it out.\n\nA small thought can become something worth remembering.",
    );
  const rect = await board(page);
  await stroke(page, rect);
  await page.screenshot({
    path: "/tmp/lint-notes-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/lint-notes-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Toggle library menu" }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.locator(".deck-tile").filter({ hasText: "Algorithms" }).click();
  await page.getByRole("button", { name: "+ Add card", exact: true }).click();
  await page.getByLabel("Card type", { exact: true }).selectOption("coding");
  await expect(page.locator("#language option:not([disabled])")).toHaveText([
    "Python",
    "Java",
  ]);
});
test('storage failures are visible and do not falsely report a saved note', async ({page}) => {
  await create(page);
  await expect(page.locator('#notes-save-state')).toHaveText('Saved on this device');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'lint.web.notes.v1') throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByLabel('Note text', {exact:true}).fill('Keep this unsaved work');
  await expect(page.locator('#notes-save-state')).toContainText('Not saved');
  await expect(page.getByLabel('Note text', {exact:true})).toHaveValue('Keep this unsaved work');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name:'Export notes backup'}).click();
  expect((await download).suggestedFilename()).toContain('Lint-notes');
});
test('flashcard background refresh preserves the open note and its editor', async ({page}) => {
  await create(page, 'Stay open');
  await page.getByLabel('Note text', {exact:true}).fill('My thoughts stay here');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Note text', {exact:true})).toHaveValue('My thoughts stay here');
  await expect(page.locator('#lint-notes-nav')).toHaveAttribute('aria-current', 'page');
  const rect = await board(page);
  await page.keyboard.down('Space');
  await page.mouse.move(rect.x+rect.width*.5, rect.y+rect.height*.5,{steps:3});
  const before=await page.evaluate(()=>scrollY);
  await page.mouse.wheel(0,-200);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(before);
  await page.keyboard.up('Space');
  await expect(page.locator('#ink-mode')).toHaveText('SCROLL MODE');
});
