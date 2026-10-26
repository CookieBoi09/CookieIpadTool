export const KEY = "lint.web.notes.v1";
export const WIDTH = 1000,
  HEIGHT = 620;
export const COLORS = [
  "#253428",
  "#3565b9",
  "#b34b4b",
  "#577848",
  "#f0ca48",
  "#e9a2bb",
];
export const uid = () => crypto.randomUUID();
export const emptyLibrary = () => ({
  format: "lint-notes",
  version: 1,
  folders: [],
  notes: [],
});
export function makeNote(folderId = null) {
  return {
    id: uid(),
    folderId,
    title: "Untitled note",
    text: "",
    strokes: [],
    created: Date.now(),
    updated: Date.now(),
  };
}
export function validate(value) {
  const fail = () => {
    throw new Error(
      "This is not a valid Lint notes backup. Existing notes have not been replaced.",
    );
  };
  if (
    !value ||
    value.format !== "lint-notes" ||
    value.version !== 1 ||
    !Array.isArray(value.folders) ||
    !Array.isArray(value.notes)
  )
    fail();
  for (const items of [value.folders, value.notes]) {
    if (
      items.some((x) => !x || typeof x.id !== "string" || !x.id) ||
      new Set(items.map((x) => x.id)).size !== items.length
    )
      fail();
  }
  const folders = new Map(value.folders.map((f) => [f.id, f]));
  for (const folder of value.folders) {
    if (typeof folder.name !== "string" || !folder.name.trim()) fail();
    const visited = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent !== null) {
      if (!folders.has(parent) || visited.has(parent)) fail();
      visited.add(parent);
      parent = folders.get(parent).parentId;
    }
  }
  let pointCount = 0;
  for (const note of value.notes) {
    if (
      (note.folderId !== null && !folders.has(note.folderId)) ||
      typeof note.title !== "string" ||
      !note.title.trim() ||
      typeof note.text !== "string" ||
      !Number.isFinite(note.created) ||
      !Number.isFinite(note.updated) ||
      !Array.isArray(note.strokes)
    )
      fail();
    for (const stroke of note.strokes) {
      if (
        !stroke ||
        !["pen", "highlighter"].includes(stroke.tool) ||
        !COLORS.includes(stroke.color) ||
        !Number.isFinite(stroke.width) ||
        stroke.width < 1 ||
        stroke.width > 48 ||
        !Array.isArray(stroke.points) ||
        !stroke.points.length
      )
        fail();
      for (const point of stroke.points) {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          !point.every(Number.isFinite) ||
          point[0] < 0 ||
          point[0] > WIDTH ||
          point[1] < 0 ||
          point[1] > HEIGHT
        )
          fail();
        if (++pointCount > 200000)
          throw new Error(
            "This notes library has too many drawing points. Split it into smaller backups.",
          );
      }
    }
  }
  return value;
}
export function removeFolder(library, id) {
  const parent = library.folders.find((f) => f.id === id)?.parentId ?? null;
  library.folders = library.folders
    .filter((f) => f.id !== id)
    .map((f) => (f.parentId === id ? { ...f, parentId: parent } : f));
  library.notes.forEach((n) => {
    if (n.folderId === id) n.folderId = parent;
  });
}
export function folderPath(library, id) {
  const names = [];
  let folder = library.folders.find((f) => f.id === id);
  while (folder) {
    names.unshift(folder.name);
    folder = library.folders.find((f) => f.id === folder.parentId);
  }
  return names.join(" / ") || "Notes";
}
