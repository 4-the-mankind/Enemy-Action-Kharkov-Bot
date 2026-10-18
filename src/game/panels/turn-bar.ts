// Turn bar (§3bis A, task 4.6b) over the map: game-turn / 14 and its dates, the Soviet impulse,
// the VP chip with the outcome label "if the VPs stay so" (18.35, Q85: grey when no check would
// end the game, the levels in a slip on click, Q89), Kharkov's owner (slip on click), then Undo, "Run bot impulse" (ends your
// German impulse, D14) and "Next turn" / "End the game".
// Under it, the tags bar (§3bis H, Q86): the state tags of the moment, and "Add event", the
// German events only the app can play (Q77, Q87: moved here from the Bot tab).
import type { GameState, GermanEventId, Outlook } from "../../engine/types";
import { LAST_TURN } from "../../engine/victory";
import { sideName } from "../../engine/names";
import type { CalendarTurn } from "../data/game-data";
import type { MovePlayer } from "../playback/move-player";
import type { GameSession } from "../state/session";
import { resultName } from "./log-panel";
import { infoAttrs, mountInfoPop } from "./info-pop";
import { infoSlip, tagChip } from "./tag-chip";
import { msg, t } from "../../i18n/i18n";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Q77: the German events that act on what only the app holds; Air Interdiction names its marker. */
const EVENTS: { id: GermanEventId; turns?: string }[] = [{ id: "stavkaConfused", turns: "5-6" }, { id: "okwExpedites", turns: "4" }, { id: "airInterdiction" }];

export function mountTurnBar(bar: HTMLElement, tagsBar: HTMLElement, session: GameSession, player: MovePlayer, calendar: CalendarTurn[]) {
  const engine = session.engine;
  mountInfoPop();
  bar.innerHTML = `<div class="tb-turn"></div>
    <div class="tb-vp"></div>
    <div class="tb-owner"></div>
    <div class="tb-actions">
      <button type="button" class="btn switch" data-action="undo" aria-keyshortcuts="Control+Z" title="${esc(t("page.undoHint"))}">${t("page.undo")} <span class="keys"><kbd>Ctrl</kbd> + <kbd>Z</kbd></span></button>
      <button type="button" class="btn ink" data-action="impulse">${t("bot.runImpulse")}</button>
      <button type="button" class="btn switch" data-action="next-turn">${t("bot.nextTurn")}</button>
    </div>
    <p class="tb-reason" role="status"></p>`;
  const turn = bar.querySelector<HTMLElement>(".tb-turn")!, vp = bar.querySelector<HTMLElement>(".tb-vp")!;
  const kharkov = bar.querySelector<HTMLElement>(".tb-owner")!, reason = bar.querySelector<HTMLElement>(".tb-reason")!;
  const undo = bar.querySelector<HTMLButtonElement>("[data-action=undo]")!;
  const runButton = bar.querySelector<HTMLButtonElement>("[data-action=impulse]")!;
  const nextButton = bar.querySelector<HTMLButtonElement>("[data-action=next-turn]")!;

  tagsBar.innerHTML = `<ul class="tags" aria-label="${esc(t("tag.title"))}"></ul>
    <div class="add-event"><button type="button" class="btn switch" aria-expanded="false" aria-haspopup="true">${t("tag.addEvent")} <span aria-hidden="true">▾</span></button>
    <div class="event-pop" role="dialog" aria-label="${esc(t("bot.events.title"))}" hidden><h2>${t("bot.events.title")}</h2><div class="event-list"></div></div></div>`;
  const tagList = tagsBar.querySelector<HTMLElement>(".tags")!;
  const addButton = tagsBar.querySelector<HTMLButtonElement>(".add-event > button")!;
  const pop = tagsBar.querySelector<HTMLElement>(".event-pop")!, eventList = pop.querySelector<HTMLElement>(".event-list")!;

  const send = (command: Parameters<GameSession["dispatch"]>[0]) => {
    const refused = session.dispatch(command).find((e) => e.type === "CommandRejected");
    reason.textContent = refused ? t(refused.reason) : "";
    return !refused;
  };
  bar.addEventListener("click", (e) => {
    const action = (e.target as Element).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "undo") { reason.textContent = ""; session.undo(); }
    else if (action === "impulse") send({ type: "RunBotImpulse" });
    else if (action === "next-turn") send({ type: "NextTurn" });
  });

  // ---- "Add event": a pop-up list under the button, closed by a click elsewhere or Escape.
  const openPop = (open: boolean) => {
    pop.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    if (open) renderEvents(session.state);
  };
  addButton.addEventListener("click", () => openPop(pop.hidden !== false));
  document.addEventListener("pointerdown", (e) => { if (!pop.hidden && !(e.target as Element).closest(".add-event")) openPop(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { e.preventDefault(); openPop(false); } });
  pop.addEventListener("click", (e) => {
    const event = (e.target as Element).closest<HTMLElement>("[data-event]");
    if (!event) return;
    if (send({ type: "GermanEvent", event: event.dataset.event as GermanEventId, ...(event.dataset.hex ? { hex: event.dataset.hex } : {}) })) openPop(false);
  });

  function renderEvents(state: GameState) {
    eventList.innerHTML = EVENTS.map(({ id, turns }) => {
      const badge = turns ? `<span class="gt">${turns}</span>` : "";
      const head = `<div class="event-name">${badge}<b>${t(`bot.events.${id}.name`)}</b><span>${t(`bot.events.${id}.text`)}</span></div>`;
      const markers = id === "airInterdiction" ? state.forwardSupport ?? [] : [];
      const buttons = (markers.length ? markers : [null]).map((hex) => {
        const why = engine.whyNotGermanEvent(state, id, hex ?? undefined);
        const label = hex ? t("bot.events.removeAt", { hex }) : t("bot.events.play");
        return `<button type="button" class="btn switch" data-event="${id}"${hex ? ` data-hex="${hex}"` : ""}${why ? ` disabled title="${esc(t(why))}"` : ""}>${label}</button>`;
      }).join("");
      return `<div class="event">${head}<div class="event-actions">${buttons}</div></div>`;
    }).join("");
  }

  // ---- The outcome label (Q85): green victory, red defeat, amber draw, grey otherwise.
  const levels = (o: Extract<Outlook, { check: true }>) => t("turnBar.outlook.levels", {
    below: o.victory.below, victoryLevel: msg(`turnBar.level.${o.victory.level}`),
    defeat: o.defeat.atLeast !== undefined ? msg("log.victory.atLeast", { vp: o.defeat.atLeast }) : msg("log.victory.above", { vp: o.defeat.above! }),
    defeatLevel: msg(`turnBar.level.${o.defeat.level}`),
  });
  function outlookLabel(state: GameState): string {
    const label = (cls: string, name: string, text: string, foot = "") =>
      `<span class="outlook ${cls}"${infoAttrs(infoSlip("", name, text, foot))}>${esc(name)}</span>`;
    if (state.result) return label(`${state.result.outcome} final`, t(resultName(state.result)), t("turnBar.outlook.over"));
    const o = engine.outlook(state);
    if (!o.check) return label("none", t(`turnBar.outlook.${o.why}`), t(`turnBar.outlook.${o.why}Title`));
    const name = o.outcome === "goesOn" ? t("turnBar.outlook.goesOn") : t(resultName({ outcome: o.outcome, level: o.level }));
    return label(o.outcome, name, t(state.turn >= LAST_TURN ? "turnBar.outlook.ifLast" : "turnBar.outlook.if", { turn: state.turn }), levels(o));
  }

  function render(state: GameState) {
    const space = calendar.find((c) => c.turn === state.turn);
    const impulses = state.sovietImpulses ?? 0;
    const phase = !state.started ? t("turnBar.beforeStart") : state.result ? t("turnBar.over")
      : impulses ? t("turnBar.afterImpulse", { impulse: impulses }) : t("turnBar.noImpulse");
    turn.innerHTML = `<b>${t("turnBar.turn", { turn: state.turn, last: LAST_TURN })}</b>` +
      (space ? `<small>${esc(space.dates)}</small>` : "") + `<span class="tb-phase">${phase}</span>`;
    vp.innerHTML = `<span class="vp-chip" title="${esc(t("turnBar.vpTitle"))}">${t("turnBar.vp", { vp: state.vp })}</span>${outlookLabel(state)}`;
    const owner = engine.kharkov(state);
    const marker = `<img src="/assets/counters/others/${owner === "soviet" ? "marker-sovietownership26.png" : "marker-germanownership.png"}" alt="">`;
    const name = t("turnBar.kharkov", { side: sideName(owner) });
    kharkov.innerHTML = `<span class="tb-kharkov ${owner}"${infoAttrs(infoSlip(marker, name, t("turnBar.kharkovTitle")))}>${marker}${esc(name)}</span>`;

    undo.disabled = !session.canUndo();
    const lock = engine.locked(state);
    const pile = state.sovietCards?.drawPile.length ?? 0;
    // A Soviet impulse paused on a combat (4.5a): it goes on from the Combat tab.
    const paused = !!state.botImpulse;
    runButton.disabled = !!lock || !state.sovietCards || !pile || player.playing || paused;
    runButton.title = lock ? t(lock) : t(!pile && state.started ? "bot.runTitle.pileEmpty" : "bot.runTitle.endsImpulse");
    nextButton.disabled = !!lock || !state.sovietCards || pile > 0 || player.playing || paused;
    // The last turn ends the game (18.35).
    nextButton.textContent = t(state.turn >= LAST_TURN ? "bot.endGame" : "bot.nextTurn");
    nextButton.title = pile ? t("bot.nextTitle.waitPile", { count: pile }) : t(state.turn >= LAST_TURN ? "bot.nextTitle.endGame" : "bot.nextTitle.ready");

    const tags = state.started ? engine.tags(state) : [];
    tagList.innerHTML = tags.length ? tags.map(tagChip).join("") : `<li class="tags-none">${t(state.started ? "tag.none" : "tag.beforeStart")}</li>`;
    if (!pop.hidden) renderEvents(state);
  }

  session.subscribe((state, _events, undone) => { if (undone) reason.textContent = ""; render(state); });
  player.onPlaying(() => render(session.state));
  render(session.state);
}
