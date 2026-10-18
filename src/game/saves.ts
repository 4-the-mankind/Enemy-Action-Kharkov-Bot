// New game, save and load (D16, task 5.2) on the game page: the main menu (Q99) calls these.
// The game lives in this page only: nothing is kept by the browser.
import { emptyState } from "../engine/types";
import { t } from "../i18n/i18n";
import { dynamicKey, msg, type Message } from "../i18n/message";
import type { mountLoadScreen } from "./panels/load-screen";
import type { mountLogPanel } from "./panels/log-panel";
import { appName, makeSave, replay, saveName, type SaveFile } from "./state/save-file";
import type { GameSession } from "./state/session";

type Log = ReturnType<typeof mountLogPanel>;

/** The booklet position the game started from, kept in its later saves (its note in the log). */
let booklet: string | undefined;

/** The booklet position named in the page URL (`/?save=p17`), in dev only. */
export function bookletInUrl(): string | null {
  return import.meta.env.DEV ? new URLSearchParams(location.search).get("save") : null;
}

/** A booklet position's file (Q92, dev only): data/saves/<id>.json. */
export async function fetchBooklet(id: string): Promise<{ text: string } | { error: Message }> {
  const res = await fetch(`/data/saves/${encodeURIComponent(id)}.json`, { cache: "no-store" }).catch(() => null);
  // The dev server answers a missing file with the page itself: only JSON is a position.
  const found = res?.ok && res.headers.get("content-type")?.includes("json");
  return found ? { text: await res.text() } : { error: msg("save.error.booklet", { id }) };
}

/** Start: an empty game, set-up to do, its log begun again. */
export function newGame(session: GameSession, log: Log) {
  booklet = undefined;
  log.onLoad(t("log.newGame"), []);
  session.restore(emptyState(), [], emptyState());
}

/** Save game: downloads the JSON file of the game, which counts as saved from then on. Returns the file name. */
export function downloadSave(session: GameSession, log: Log): string {
  const file = makeSave(__APP_VERSION__, session.start, session.commandsSince(0), session.state, booklet);
  const name = saveName(session.state);
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  session.markSaved();
  log.note(t("save.log.saved", { file: name }));
  return name;
}

/**
 * Loads a save (Q91): its commands replayed under the loading screen (Q97), the log written
 * again. If the replay does not reach the state saved (a save of another version of the
 * app), the state saved is loaded alone, without log nor Undo before it.
 */
export async function loadSave(session: GameSession, save: SaveFile, screen: ReturnType<typeof mountLoadScreen>, log: Log) {
  screen.show(save.commands.length);
  const r = await replay(session.engine, save, (done, state) => screen.progress(done, state.turn));
  booklet = save.booklet;
  const intro = save.booklet
    ? t("save.log.booklet", { name: t(dynamicKey(`booklet.${save.booklet}.name`)), note: t(dynamicKey(`booklet.${save.booklet}.note`)) })
    : t("log.newGame");
  const date = save.savedAt.slice(0, 16).replace("T", " "), notes: string[] = [];
  if (!r.same) {
    // The log is newest first: the refused command shows under the warning.
    if (r.refused) notes.push(t("save.log.refused", { n: r.refused.index, command: r.refused.command.type, reason: t(r.refused.reason) }));
    notes.push(t("save.log.differs", { date, app: appName(save.app), current: appName(__APP_VERSION__) }));
  } else if (save.commands.length) notes.push(t("save.log.loaded", { turn: r.state.turn, count: r.steps.length, date, app: appName(save.app) }));
  log.onLoad(intro, notes);
  if (r.same) session.restore(save.start, r.steps, r.state);
  else session.restore(save.state, [], save.state);
  screen.hide();
}
