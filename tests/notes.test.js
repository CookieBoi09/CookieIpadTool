import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyLibrary,
  makeNote,
  validate,
  removeFolder,
} from "../site/notes/model.js";
import { pointInBoard } from "../site/notes/drawing.js";
test("notes with pen/highlighter drawings survive backup round trip", () => {
  const lib = emptyLibrary(),
    note = makeNote();
  lib.notes.push(note);
  note.strokes = [
    {
      tool: "pen",
      color: "#253428",
      width: 3,
      points: [
        [0, 0],
        [1000, 620],
      ],
    },
    {
      tool: "highlighter",
      color: "#f0ca48",
      width: 24,
      points: [
        [20, 20],
        [100, 100],
      ],
    },
  ];
  assert.deepEqual(validate(JSON.parse(JSON.stringify(lib))), lib);
});
test("rejects cycles, orphan notes, invalid tools, and points outside the drawing space", () => {
  const cases = [
    (l) => (l.notes[0].folderId = "missing"),
    (l) => {
      l.folders = [{ id: "x", name: "Cycle", parentId: "x" }];
    },
    (l) =>
      l.notes[0].strokes.push({
        tool: "eraser",
        color: "#253428",
        width: 3,
        points: [[10, 10]],
      }),
    (l) =>
      l.notes[0].strokes.push({
        tool: "pen",
        color: "#253428",
        width: 3,
        points: [[1001, 10]],
      }),
  ];
  for (const change of cases) {
    const lib = emptyLibrary();
    lib.notes.push(makeNote());
    change(lib);
    assert.throws(() => validate(lib));
  }
});
test("removing a folder keeps child notes and folders", () => {
  const lib = emptyLibrary();
  lib.folders = [
    { id: "a", name: "Course", parentId: null },
    { id: "b", name: "Lecture", parentId: "a" },
  ];
  lib.notes = [makeNote("a")];
  removeFolder(lib, "a");
  validate(lib);
  assert.equal(lib.notes[0].folderId, null);
  assert.equal(lib.folders[0].parentId, null);
});
test("scaled pointer coordinates are bounded and independent of viewport size", () => {
  const svg = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 200,
      width: 500,
      height: 310,
    }),
  };
  assert.deepEqual(
    pointInBoard({ clientX: 350, clientY: 355 }, svg),
    [500, 310],
  );
  assert.equal(pointInBoard({ clientX: 99, clientY: 355 }, svg), null);
  assert.equal(pointInBoard({ clientX: 350, clientY: 511 }, svg), null);
});
