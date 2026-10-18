// Main menu (D16, task 5.2, Q99): the home screen, laid over the game page at opening and from
// the rail's Menu button. The game stays in memory behind it: Continue goes back to it. Start
// and Load save ask first when the game has changed since it was last saved (Q94); Save game
// downloads its file. Tools open in a new tab (Q100); in dev, the booklet positions (Q92).
// Escape opens it from the map and goes back from it (main.ts, Q101).
import { BOOKLET_POSITIONS, parseSave, type SaveFile } from "../state/save-file";
import type { GameSession } from "../state/session";
import { t } from "../../i18n/i18n";
import { dynamicKey, type Message } from "../../i18n/message";

export interface MenuActions {
  newGame(): void;
  load(save: SaveFile): Promise<void>;
  /** Downloads the save file; its name. */
  save(): string;
  booklet(id: string): Promise<{ text: string } | { error: Message }>;
}

export function mountMainMenu(root: HTMLElement, session: GameSession, actions: MenuActions) {
  /** A game was started or loaded in this page: Continue and Save game are offered. */
  let hasGame = false;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const continueItem = $("[data-game]"), saveButton = $<HTMLButtonElement>("[data-menu=save]");
  const input = $<HTMLInputElement>("#saveFile"), message = $(".menu-message");
  const confirmBox = $(".menu-confirm"), confirmText = confirmBox.querySelector("p")!, confirmButton = $<HTMLButtonElement>("[data-confirm]");

  if (import.meta.env.DEV) root.querySelectorAll<HTMLElement>("[data-dev]").forEach((el) => (el.hidden = false));
  $(".booklet").innerHTML = BOOKLET_POSITIONS.map((id) => `<li><button type="button" class="entry" data-booklet="${id}">
    <span class="name">${t(dynamicKey(`booklet.${id}.name`))}</span><span>${t(dynamicKey(`booklet.${id}.note`))}</span></button></li>`).join("");

  const say = (text: string, error = false) => {
    message.textContent = text;
    message.classList.toggle("error", error);
    message.hidden = false;
  };
  let pending: (() => void) | null = null;
  const hideConfirm = () => { confirmBox.hidden = true; pending = null; };

  const open = () => {
    continueItem.hidden = !hasGame;
    saveButton.disabled = !hasGame;
    message.hidden = true;
    hideConfirm();
    document.body.classList.add("menu-open");
  };
  const close = () => {
    hideConfirm();
    document.body.classList.remove("menu-open");
  };

  /** Replacing the game in progress: asked first if it changed since it was last saved (Q94). */
  const replace = (what: "start" | "load", action: () => void) => {
    message.hidden = true;
    if (!hasGame || !session.dirty) { action(); return; }
    confirmText.textContent = t(`home.confirm.${what}`);
    confirmButton.textContent = t(`home.confirm.${what}Button`);
    confirmBox.hidden = false;
    pending = action;
    confirmButton.focus();
  };
  const startGame = () => { actions.newGame(); hasGame = true; close(); };
  const loadGame = async (save: SaveFile) => {
    close();
    await actions.load(save);
    hasGame = true;
  };
  /** A file's text read: loaded if it is a save, else why not, in the menu. */
  const loadText = (text: string, name: string) => {
    const parsed = parseSave(text);
    if ("error" in parsed) { say(t("save.error.file", { file: name, reason: t(parsed.error) }), true); return; }
    replace("load", () => void loadGame(parsed.save));
  };
  const openBooklet = async (id: string) => {
    const got = await actions.booklet(id);
    if ("error" in got) { open(); say(t(got.error), true); return; }
    loadText(got.text, `${id}.json`);
  };

  root.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest("[data-confirm]")) { const go = pending; hideConfirm(); go?.(); return; }
    if (target.closest("[data-cancel]")) { hideConfirm(); return; }
    const id = target.closest<HTMLElement>("[data-booklet]")?.dataset.booklet;
    if (id) { void openBooklet(id); return; }
    const what = target.closest<HTMLElement>("[data-menu]")?.dataset.menu;
    if (what === "continue") close();
    else if (what === "start") replace("start", startGame);
    else if (what === "load") { input.value = ""; input.click(); }
    else if (what === "save" && hasGame) say(t("home.saved", { file: actions.save() }));
  });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    let text: string;
    try { text = await file.text(); }
    catch { say(t("save.error.read", { file: file.name }), true); return; }
    loadText(text, file.name);
  });
  return {
    open,
    isOpen: () => document.body.classList.contains("menu-open"),
    /** Escape in the menu (main.ts, Q101): the confirmation first, then back to the game if one is open (not at the page's opening). */
    escape() {
      if (!confirmBox.hidden) hideConfirm();
      else if (hasGame) close();
    },
    /** A booklet position named in the page URL (dev): opened at once, without the menu. */
    openBooklet: (id: string) => { close(); return openBooklet(id); },
  };
}
