// Live build progress. Each step is appended to the showcase's `log` (so a refresh can replay it)
// and pushed to anyone watching /api/session/<id>/events (server-sent events).
import { EventEmitter } from "node:events";
import { getShowcase, updateShowcase } from "./db.js";

export const bus = new EventEmitter();
bus.setMaxListeners(500);

/** Records one progress line, e.g. progress(id, "test", "Opening it in a browser"). */
export async function progress(id, stage, text) {
  const entry = { t: Date.now(), stage, text };
  const row = await getShowcase(id);
  await updateShowcase(id, { log: [...(row?.log ?? []), entry] });
  bus.emit(id, { type: "progress", ...entry });
}

/** A short-lived line that isn't stored (e.g. "Writing code: 240 lines"), so the log stays readable. */
export function tick(id, stage, text) {
  bus.emit(id, { type: "tick", t: Date.now(), stage, text });
}

export function finished(id, status, extra = {}) {
  bus.emit(id, { type: "status", status, ...extra });
}
