import {
  KEY,
  WIDTH,
  HEIGHT,
  COLORS,
  uid,
  emptyLibrary,
  makeNote,
  validate,
  removeFolder,
  folderPath,
} from "./model.js";
import { attachDrawing, strokeElement } from "./drawing.js";

const root = document.createElement("section");
root.id = "notes-root";
root.hidden = true;
document.body.append(root);
const dialog = document.createElement("dialog");
dialog.id = "notes-dialog";
document.body.append(dialog);
let library = emptyLibrary(),
  savedRaw = null,
  blocked = false,
  dirty = false,
  conflict = false;
let opened = false,
  selectedFolder = null,
  selectedNote = null,
  query = "",
  drawing,
  saveTimer;
let tool = "pen",
  color = COLORS[0],
  width = 3,
  redo = [],
  penColor = COLORS[0],
  markerColor = COLORS[4];
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const note = () => library.notes.find((n) => n.id === selectedNote);
try {
  savedRaw = localStorage.getItem(KEY);
  if (savedRaw) library = validate(JSON.parse(savedRaw));
} catch {
  blocked = true;
}
function message(text, error = false) {
  const host = root.querySelector("#notes-save-state");
  if (host) {
    host.textContent = text;
    host.classList.toggle("error", error);
  }
}
function persist() {
  clearTimeout(saveTimer);
  if (!dirty) return !blocked;
  try {
    if (blocked || conflict)
      throw new Error(
        conflict
          ? "Notes changed in another tab. Export your unsaved notes, then reload to use the other version."
          : "Saved notes could not be loaded. Restore a valid notes backup to continue.",
      );
    if (localStorage.getItem(KEY) !== savedRaw) {
      conflict = true;
      throw new Error(
        "Notes changed in another tab. Export your unsaved notes, then reload.",
      );
    }
    validate(library);
    const raw = JSON.stringify(library);
    localStorage.setItem(KEY, raw);
    savedRaw = raw;
    dirty = false;
    message("Saved on this device");
    return true;
  } catch (error) {
    message(
      `Not saved · ${error.message} Export a backup to keep your work.`,
      true,
    );
    return false;
  }
}
function changed(immediate = false) {
  if (note()) note().updated = Date.now();
  dirty = true;
  message("Saving…");
  clearTimeout(saveTimer);
  if (immediate) persist();
  else saveTimer = setTimeout(persist, 400);
}
function stopDrawing() {
  drawing?.destroy();
  drawing = null;
}
function selectNote(id) {
  stopDrawing();
  persist();
  selectedNote = id;
  redo = [];
  render();
}
function selectFolder(id) {
  stopDrawing();
  persist();
  selectedFolder = id;
  selectedNote = null;
  query = "";
  redo = [];
  render();
}
function openNotes() {
  opened = true;
  root.hidden = false;
  document.body.classList.add("notes-open");
  render();
  bridge();
}
function closeNotes() {
  stopDrawing();
  if (
    !persist() &&
    dirty &&
    !confirm(
      "Some notes have not saved. Leave notes anyway? Export a backup first to keep them.",
    )
  )
    return false;
  opened = false;
  root.hidden = true;
  document.body.classList.remove("notes-open");
  return true;
}
function bridge() {
  const nav = document.querySelector("#app .sidebar nav");
  if (!nav) return;
  let button = nav.querySelector("#lint-notes-nav");
  if (!button) {
    button = document.createElement("button");
    button.id = "lint-notes-nav";
    button.className = "nav-item";
    button.innerHTML =
      '<span class="icon" aria-hidden="true">▧</span><span>Notes</span>';
    nav.insertBefore(button, nav.querySelector(".nav-heading"));
  }
  button.classList.toggle("active", opened);
  button.setAttribute("aria-current", opened ? "page" : "false");
  if (opened)
    nav
      .querySelectorAll(".nav-item.active:not(#lint-notes-nav)")
      .forEach((el) => el.classList.remove("active"));
}
// Keep the independent notes workspace intact when the original flashcard UI refreshes.
new MutationObserver(bridge).observe(document.querySelector("#app"), {
  childList: true,
  subtree: true,
});
document.querySelector("#app").addEventListener(
  "click",
  (event) => {
    if (event.target.closest("#lint-notes-nav")) {
      event.preventDefault();
      event.stopPropagation();
      openNotes();
      return;
    }
    if (
      opened &&
      event.target.closest(
        "[data-page],[data-deck],.brand,#new-folder,#new-deck,#export,#import,[data-folder]",
      ) &&
      !closeNotes()
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);
bridge();
function folderTree(parent = null) {
  return library.folders
    .filter((f) => f.parentId === parent)
    .map(
      (f) =>
        `<div class="notes-folder-row"><button data-nfolder="${esc(f.id)}" class="${selectedFolder === f.id ? "chosen" : ""}"><span aria-hidden="true">▱</span><span>${esc(f.name)}</span></button><button data-manage-folder="${esc(f.id)}" aria-label="Manage notes folder ${esc(f.name)}">···</button></div><div class="notes-subfolders">${folderTree(f.id)}</div>`,
    )
    .join("");
}
function visibleNotes() {
  return library.notes
    .filter(
      (n) =>
        (selectedFolder === "all" || n.folderId === selectedFolder) &&
        (!query ||
          `${n.title} ${n.text}`.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) => b.updated - a.updated);
}
function render() {
  stopDrawing();
  const current = note();
  root.innerHTML = `<header class="notes-topbar"><span>Workspace <span>/</span> <strong>Notes</strong></span><span class="notes-local-label">A SPACE TO THINK ON PAPER</span></header><div class="notes-page"><div class="notes-heading"><div><div class="eyebrow">MAKE YOURSELF SOME ROOM</div><h1>Your thoughts,<br><em>in good company.</em></h1><p>Write it down. Sketch it out. Make it yours.</p></div><div class="notes-heading-actions"><button class="outline" id="notes-new-folder" ${blocked ? "disabled" : ""}>+ Folder</button><button class="primary" id="notes-new-note" ${blocked ? "disabled" : ""}>+ New note</button></div></div><div id="notes-save-state" class="notes-save-state ${blocked || conflict ? "error" : ""}" role="status">${blocked ? "Saved notes could not be loaded. Original data is preserved. Restore a valid notes backup." : conflict ? "Notes changed in another tab. Export your changes before reloading." : dirty ? "Unsaved changes" : "Saved on this device"}</div><div class="notes-layout"><aside class="notes-library" aria-label="Notes folders"><div class="notes-library-title">NOTEBOOKS <span>${library.notes.length}</span></div><button class="notes-root-folder ${selectedFolder === "all" ? "chosen" : ""}" data-nfolder="all">All notes <span>${library.notes.length}</span></button><button class="notes-root-folder ${selectedFolder === null ? "chosen" : ""}" data-nfolder="root">Unfiled notes</button><div class="notes-folder-tree">${folderTree()}</div><div class="notes-backup"><button id="notes-export">Export notes backup</button><button id="notes-import">Restore notes backup</button></div></aside><section class="notes-browser"><div class="notes-browser-heading"><div><h2>${current ? esc(current.title) : selectedFolder === "all" ? "All notes" : esc(folderPath(library, selectedFolder))}</h2><p>${current ? "A little space for a bigger idea." : "Choose a note, or start with a blank page."}</p></div>${current ? '<button class="outline" id="notes-back">← Notes list</button>' : ""}</div>${current ? editorMarkup(current) : '<input id="notes-search" type="search" aria-label="Search notes in this folder" placeholder="Search these notes…"><div id="notes-list" class="notes-list"></div>'}</section></div></div>`;
  root
    .querySelectorAll("[data-nfolder]")
    .forEach(
      (el) =>
        (el.onclick = () =>
          selectFolder(
            el.dataset.nfolder === "root" ? null : el.dataset.nfolder,
          )),
    );
  root
    .querySelectorAll("[data-manage-folder]")
    .forEach(
      (el) => (el.onclick = () => folderDialog(el.dataset.manageFolder)),
    );
  root.querySelector("#notes-new-folder").onclick = () => createFolder();
  root.querySelector("#notes-new-note").onclick = () => {
    const created = makeNote(selectedFolder === "all" ? null : selectedFolder);
    library.notes.push(created);
    selectedNote = created.id;
    changed(true);
    render();
    root.querySelector("#note-title").select();
  };
  root.querySelector("#notes-export").onclick = exportNotes;
  root.querySelector("#notes-import").onclick = importNotes;
  if (current) bindEditor(current);
  else {
    const input = root.querySelector("#notes-search");
    input.value = query;
    input.oninput = () => {
      query = input.value;
      renderList();
    };
    renderList();
  }
}
function renderList() {
  const items = visibleNotes();
  root.querySelector("#notes-list").innerHTML = items.length
    ? items
        .map(
          (n) =>
            `<button class="note-tile" data-note="${esc(n.id)}"><span class="note-tile-icon" aria-hidden="true">▧</span><strong>${esc(n.title)}</strong><span class="note-excerpt">${esc(n.text.slice(0, 100) || (n.strokes.length ? "A thought, drawn by hand." : "A blank page, full of possibility."))}</span><span class="note-tile-footer">${esc(folderPath(library, n.folderId))}<span>${new Date(n.updated).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span></button>`,
        )
        .join("")
    : `<div class="notes-empty"><span aria-hidden="true">✧</span><h3>${query ? "No matching notes" : "Start with a little thought."}</h3><p>${query ? "Try another search." : "Create your first note, then add words and drawings."}</p><button class="primary" id="notes-empty-new">+ New note</button></div>`;
  root
    .querySelectorAll("[data-note]")
    .forEach((el) => (el.onclick = () => selectNote(el.dataset.note)));
  root
    .querySelector("#notes-empty-new")
    ?.addEventListener("click", () =>
      root.querySelector("#notes-new-note").click(),
    );
}
function editorMarkup(current) {
  return `<div class="note-editor"><div class="note-actions"><label>Folder<select id="note-folder" aria-label="Note folder">${folderOptions(current.folderId)}</select></label><button class="notes-delete" id="note-delete">Delete note</button></div><div class="note-paper"><label class="sr-only" for="note-title">Note title</label><input id="note-title" class="note-title" maxlength="200" value="${esc(current.title)}" placeholder="Untitled note"><div class="note-date">${new Date(current.created).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} <span>•</span> YOUR SPACE TO THINK</div><label class="sr-only" for="note-text">Note text</label><textarea id="note-text" class="note-text" placeholder="Start writing here…">${esc(current.text)}</textarea><div class="notes-ink-toolbar" role="toolbar" aria-label="Drawing tools"><div class="ink-tools"><button data-ink="pen" aria-pressed="${tool === "pen"}">✎ Pen</button><button data-ink="highlighter" aria-pressed="${tool === "highlighter"}">▰ Highlighter</button></div><div class="ink-colors" aria-label="Ink color">${COLORS.map((c, i) => `<button class="ink-color ${c === color ? "selected" : ""}" style="--ink:${c}" data-color="${c}" aria-label="${["Graphite", "Blue", "Red", "Green", "Yellow", "Pink"][i]} ink" aria-pressed="${c === color}"></button>`).join("")}</div><label class="ink-size-label">Size<input id="ink-size" aria-label="Stroke size" type="range" min="${tool === "pen" ? 1 : 12}" max="${tool === "pen" ? 10 : 40}" value="${width}"><output id="ink-size-value">${width}</output></label><div class="ink-history"><button id="ink-undo" aria-label="Undo drawing" ${!current.strokes.length ? "disabled" : ""}>↶</button><button id="ink-redo" aria-label="Redo drawing" ${!redo.length ? "disabled" : ""}>↷</button><button id="ink-clear" ${!current.strokes.length ? "disabled" : ""}>Clear</button></div></div><div class="ink-instruction"><span id="ink-mode">SCROLL MODE</span><span>Hold <kbd>Space</kbd> + move to draw. Release to scroll.</span></div><div class="note-artboard" id="note-artboard"><svg id="note-canvas" viewBox="0 0 ${WIDTH} ${current.pageHeight || HEIGHT}" style="aspect-ratio:${WIDTH}/${current.pageHeight || HEIGHT}" tabindex="0" role="img" aria-label="Bounded drawing area. Hold Space and move your pointer to draw." xmlns="http://www.w3.org/2000/svg"><defs><pattern id="note-dot-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="12.5" cy="12.5" r="1" fill="#b8c3ac" opacity="0.4"/></pattern></defs><rect width="${WIDTH}" height="${current.pageHeight || HEIGHT}" fill="url(#note-dot-grid)"/></svg><span class="artboard-caption">YOUR DRAWING SPACE</span></div><p class="note-paper-hint">Drawing stays inside the dotted outline. Click the drawing area to leave the text editor, then hold Space. Pen/stylus contact also draws; touch gestures scroll.</p></div></div>`;
}
function bindEditor(current) {
  root.querySelector("#notes-back").onclick = () => selectNote(null);
  root.querySelector("#note-title").oninput = (event) => {
    current.title = event.target.value.trim() || "Untitled note";
    changed();
    root.querySelector(".notes-browser-heading h2").textContent = current.title;
  };
  root.querySelector("#note-text").oninput = (event) => {
    current.text = event.target.value;
    changed();
  };
  root.querySelector("#note-folder").onchange = (event) => {
    current.folderId = event.target.value || null;
    changed(true);
  };
  root.querySelector("#note-delete").onclick = () => {
    if (!confirm(`Delete “${current.title}” and its drawings?`)) return;
    stopDrawing();
    library.notes = library.notes.filter((n) => n.id !== current.id);
    selectedNote = null;
    dirty = true;
    persist();
    render();
  };
  const svg = root.querySelector("#note-canvas");
  current.strokes.forEach((s) => svg.append(strokeElement(s)));
  function buttons() {
    root.querySelector("#ink-undo").disabled = !current.strokes.length;
    root.querySelector("#ink-redo").disabled = !redo.length;
    root.querySelector("#ink-clear").disabled = !current.strokes.length;
  }
  function redraw() {
    svg.querySelectorAll("path[data-tool]").forEach((p) => p.remove());
    current.strokes.forEach((s) => svg.append(strokeElement(s)));
    buttons();
  }
  drawing = attachDrawing(svg, {
    getNote: () => current,
    getTool: () => ({ tool, color, width }),
    active: () =>
      opened &&
      selectedNote === current.id &&
      !dialog.open &&
      !document.querySelector("#modal[open]"),
    changed: () => {
      redo = [];
      changed(true);
      buttons();
    },
    status: (writing) => {
      const label = root.querySelector("#ink-mode");
      if (label) {
        label.textContent = writing
          ? "DRAWING · RELEASE SPACE TO STOP"
          : "SCROLL MODE";
        label.classList.toggle("armed", writing);
      }
    },
  });
  root.querySelectorAll("[data-ink]").forEach(
    (el) =>
      (el.onclick = () => {
        drawing.finish();
        tool = el.dataset.ink;
        color = tool === "pen" ? penColor : markerColor;
        width = tool === "pen" ? 3 : 24;
        root
          .querySelectorAll("[data-ink]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
        root.querySelectorAll("[data-color]").forEach((b) => {
          b.classList.toggle("selected", b.dataset.color === color);
          b.setAttribute("aria-pressed", String(b.dataset.color === color));
        });
        const range = root.querySelector("#ink-size");
        range.min = tool === "pen" ? 1 : 12;
        range.max = tool === "pen" ? 10 : 40;
        range.value = width;
        root.querySelector("#ink-size-value").textContent = width;
      }),
  );
  root.querySelectorAll("[data-color]").forEach(
    (el) =>
      (el.onclick = () => {
        drawing.finish();
        color = el.dataset.color;
        if (tool === "pen") penColor = color;
        else markerColor = color;
        root.querySelectorAll("[data-color]").forEach((b) => {
          b.classList.toggle("selected", b === el);
          b.setAttribute("aria-pressed", String(b === el));
        });
      }),
  );
  root.querySelector("#ink-size").oninput = (event) => {
    drawing.finish();
    width = Number(event.target.value);
    root.querySelector("#ink-size-value").textContent = width;
  };
  root.querySelector("#ink-undo").onclick = () => {
    drawing.finish();
    if (current.strokes.length) redo.push(current.strokes.pop());
    changed(true);
    redraw();
  };
  root.querySelector("#ink-redo").onclick = () => {
    drawing.finish();
    if (redo.length) current.strokes.push(redo.pop());
    changed(true);
    redraw();
  };
  root.querySelector("#ink-clear").onclick = () => {
    if (confirm("Clear all drawings on this note? Text will stay unchanged.")) {
      drawing.finish();
      current.strokes = [];
      redo = [];
      changed(true);
      redraw();
    }
  };
}
function folderOptions(selected) {
  return `<option value="">Unfiled notes</option>${library.folders.map((f) => `<option value="${esc(f.id)}" ${selected === f.id ? "selected" : ""}>${esc(folderPath(library, f.id))}</option>`).join("")}`;
}
function showDialog(html) {
  drawing?.finish();
  dialog.innerHTML = html;
  dialog
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => dialog.close()));
  if (!dialog.open) dialog.showModal();
}
function createFolder(
  parent = selectedFolder === "all" ? null : selectedFolder,
) {
  showDialog(
    `<form><h2>New notes folder</h2><label>Name<input name="name" required maxlength="100" autofocus placeholder="e.g. Lecture notes"></label><label>Parent folder<select name="parent" aria-label="Parent notes folder">${folderOptions(parent)}</select></label><div class="dialog-actions"><button type="button" class="outline" data-close>Cancel</button><button class="primary">Create folder</button></div></form>`,
  );
  dialog.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const name = data.get("name").trim();
    if (!name) return;
    const folder = { id: uid(), name, parentId: data.get("parent") || null };
    library.folders.push(folder);
    dirty = true;
    persist();
    dialog.close();
    selectFolder(folder.id);
  };
}
function folderDialog(id) {
  const folder = library.folders.find((f) => f.id === id);
  showDialog(
    `<form><h2>Folder settings</h2><label>Name<input name="name" required maxlength="100" value="${esc(folder.name)}"></label><div class="dialog-actions"><button type="button" class="outline" id="notes-subfolder">+ Subfolder</button><button class="primary">Save folder</button><button type="button" class="outline" data-close>Cancel</button></div></form><div class="danger-zone"><p>Removing a folder moves its notes and subfolders up one level.</p><button class="danger" id="notes-remove-folder">Remove folder</button></div>`,
  );
  dialog.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    const name = new FormData(event.target).get("name").trim();
    if (!name) return;
    folder.name = name;
    dirty = true;
    persist();
    dialog.close();
    render();
  };
  dialog.querySelector("#notes-subfolder").onclick = () => createFolder(id);
  dialog.querySelector("#notes-remove-folder").onclick = () => {
    removeFolder(library, id);
    dirty = true;
    persist();
    dialog.close();
    selectFolder(folder.parentId);
  };
}
function exportNotes() {
  drawing?.finish();
  if (blocked) {
    message(
      "Original notes could not be loaded; refusing to export an empty replacement.",
      true,
    );
    return;
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `Lint-notes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importNotes() {
  drawing?.finish();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.hidden = true;
  document.body.append(input);
  input.oncancel = () => input.remove();
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024)
        throw new Error("Notes backups must be smaller than 15 MB.");
      const next = validate(JSON.parse(await file.text()));
      if (
        !confirm(
          `Replace all notes and notes folders with ${next.notes.length} notes from this backup? Flashcards are unaffected.`,
        )
      )
        return;
      const raw = JSON.stringify(next);
      localStorage.setItem(KEY, raw);
      library = next;
      savedRaw = raw;
      dirty = false;
      blocked = false;
      conflict = false;
      selectedNote = null;
      selectedFolder = "all";
      render();
    } catch (error) {
      message(error.message, true);
    } finally {
      input.remove();
    }
  };
  input.click();
}
window.addEventListener("beforeunload", (event) => {
  drawing?.finish();
  if (!persist() && dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("pagehide", () => {
  drawing?.finish();
  persist();
});
window.addEventListener("storage", (event) => {
  if (event.key !== KEY) return;
  if (dirty || (opened && selectedNote)) {
    conflict = true;
    message(
      "Notes changed in another tab. Export your version before reloading.",
      true,
    );
    return;
  }
  try {
    library = event.newValue
      ? validate(JSON.parse(event.newValue))
      : emptyLibrary();
    savedRaw = event.newValue;
    blocked = false;
    if (opened) render();
  } catch {
    blocked = true;
    if (opened) render();
  }
});
