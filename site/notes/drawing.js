import { attachNativeDrawing } from "./native-drawing.js";
import { WIDTH, HEIGHT } from "./model.js";
const NS = "http://www.w3.org/2000/svg";
export function pointInBoard(event, svg) {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
  const pageHeight = svg.viewBox?.baseVal.height || HEIGHT;
  const y = ((event.clientY - rect.top) / rect.height) * pageHeight;
  return x >= 0 && x <= WIDTH && y >= 0 && y <= pageHeight
    ? [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
    : null;
}
export function strokeElement(stroke) {
  const path = document.createElementNS(NS, "path");
  const points = stroke.points;
  // A tiny line makes a stationary pen tap visible with round line caps.
  const d =
    points.length === 1
      ? `M${points[0].join(" ")} l0.01 0`
      : `M${points.map((p) => p.join(" ")).join(" L")}`;
  for (const [name, value] of Object.entries({
    d,
    fill: "none",
    stroke: stroke.color,
    "stroke-width": stroke.width,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    opacity: stroke.tool === "highlighter" ? 0.3 : 1,
    "data-tool": stroke.tool,
  }))
    path.setAttribute(name, String(value));
  return path;
}
export function attachDrawing(
  svg,
  { getNote, getTool, changed, status, active },
) {
  if (window.lintNative?.platform === "macOS") return attachNativeDrawing(svg, {getNote,getTool,changed,status,active,makePath:strokeElement});
  let space = false,
    penPointer = null,
    current = null,
    path = null,
    lastPointer = null;
  const editable = (target) =>
    target instanceof Element &&
    !!target.closest('input,textarea,select,button,a,[contenteditable="true"]');
  function finish() {
    if (current) {
      current = null;
      path = null;
      changed();
    }
  }
  function disarm() {
    space = false;
    penPointer = null;
    lastPointer = null;
    finish();
    svg.classList.remove("writing");
    status(false);
  }
  function add(point) {
    const note = getNote();
    if (!note) return;
    if (!current) {
      current = { ...getTool(), points: [point] };
      note.strokes.push(current);
      path = strokeElement(current);
      svg.append(path);
    } else {
      const previous = current.points.at(-1);
      if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 0.8)
        return;
      current.points.push(point);
      path.setAttribute(
        "d",
        `M${current.points.map((p) => p.join(" ")).join(" L")}`,
      );
    }
  }
  function move(event) {
    if (!active()) return;
    if (event.pointerType === "touch") return; // Native touch scrolling remains available.
    const point = pointInBoard(event, svg);
    lastPointer = point;
    if (!space && event.pointerId !== penPointer) return;
    if (!point) {
      finish();
      return;
    }
    const samples = event.getCoalescedEvents?.() || [];
    for (const sample of samples.length ? samples : [event]) {
      const p = pointInBoard(sample, svg);
      if (p) add(p);
      else finish();
    }
  }
  function keydown(event) {
    if (
      !active() ||
      document.querySelector("dialog[open]") ||
      editable(event.target) ||
      event.code !== "Space" ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    event.preventDefault();
    if (space) return;
    space = true;
    svg.classList.add("writing");
    status(true);
    if (lastPointer) add(lastPointer);
  }
  function keyup(event) {
    if (event.code === "Space") disarm();
  }
  function down(event) {
    if (!active() || event.pointerType === "touch") return;
    if (event.button !== 0) return;
    svg.focus({ preventScroll: true });
    lastPointer = pointInBoard(event, svg);
    if (event.pointerType === "pen") {
      event.preventDefault();
      penPointer = event.pointerId;
      svg.classList.add("writing");
      status(true);
      if (lastPointer) add(lastPointer);
    }
  }
  function up(event) {
    if (event.pointerId === penPointer) disarm();
  }
  function wheel(event) {
    // Never cancel wheel/trackpad scrolling. Break a stroke so scrolling cannot join distant points.
    finish();
    lastPointer = null;
  }
  function visibility() {
    if (document.hidden) disarm();
  }
  function focus(event) {
    if (editable(event.target) || !svg.contains(event.target)) disarm();
  }
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", disarm);
  window.addEventListener("blur", disarm);
  window.addEventListener("wheel", wheel, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("focusin", focus);
  svg.addEventListener("pointerdown", down);
  return {
    finish: disarm,
    destroy() {
      disarm();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", disarm);
      window.removeEventListener("blur", disarm);
      window.removeEventListener("wheel", wheel);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", focus);
      svg.removeEventListener("pointerdown", down);
    },
  };
}
