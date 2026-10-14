// Bot tab of the rail (§3bis D): the Soviet cards on the deck, "Run bot impulse" and "Next
// turn", how the bot read the cards of its last impulse (8.1), the activations being played
// (each formation, its units in the order the bot moved them, the current one lit), playback
// controls under the impulse buttons (speed, replay, skip, clear trails), and the "Why this
// move" slip below. Plus the Soviet state kept so far.
import type { CardCommand } from "../../core/soviet-cards";
import { adjustmentName, armyName, frontName } from "../../engine/names";
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import { isHex, SOVIET_CARDS, type GameEvent, type GameState } from "../../engine/types";
import { faceImage } from "../data/game-data";
import { readActivation, walks, type Activation, type Decision } from "../playback/activation";
import type { MovePlayer, Speed } from "../playback/move-player";
import type { GameSession } from "../state/session";
import { CARD_BACK, cardImage } from "./card-zoom";
import { objectiveChange, objectiveName } from "./objective-text";
import type { mountWhyPanel } from "./why-panel";
import { t } from "../../i18n/i18n";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

interface Parts { deck: HTMLElement; activate: HTMLElement; reading: HTMLElement; orders: HTMLElement; status: HTMLElement }

type Checked = Extract<GameEvent, { type: "SovietCommandChecked" }>;

/** The cards of an impulse as the bot read them, in play order. */
type Fate = "discarded" | "returned" | "removed";

interface Reading {
  depth: number;
  drawn: Extract<GameEvent, { type: "SovietCardsDrawn" }>;
  /** One block per card read: the auxiliary card's event check, then each command card. */
  blocks: { card: string; role: "auxiliary" | "command" | "second"; checks: Checked[]; fate: Fate | null }[];
}

/**
 * The cards of an impulse as read so far: from its first step (the cards drawn), or `before`
 * carried on by a later step of the same impulse (ContinueBotImpulse after a combat, 4.5a).
 */
function readImpulse(events: GameEvent[], depth: number, before?: Reading): Reading | null {
  const drawn = events.find((e): e is Reading["drawn"] => e.type === "SovietCardsDrawn") ?? before?.drawn;
  if (!drawn) return null;
  const blocks: Reading["blocks"] = before?.blocks.map((b) => ({ ...b, checks: [...b.checks] })) ?? [];
  const block = (card: string, role: Reading["blocks"][number]["role"]) => {
    const b = { card, role, checks: [] as Checked[], fate: null as Fate | null };
    blocks.push(b);
    return b;
  };
  let cur: Reading["blocks"][number] | null = blocks.at(-1) ?? null;
  for (const e of events) {
    if (e.type === "SovietCommandCard") cur = block(e.card, e.second ? "second" : "command");
    else if (e.type === "SovietCommandChecked") {
      if (e.role === "auxiliary" && cur?.card !== e.card) cur = block(e.card, "auxiliary");
      cur!.checks.push(e);
    } else if (cur && e.type === "SovietCardDiscarded" && e.card === cur.card) cur.fate = "discarded";
    else if (cur && e.type === "SovietCardReturned" && e.card === cur.card) cur.fate = "returned";
    else if (cur && e.type === "SovietCardRemoved" && e.card === cur.card) cur.fate = "removed";
  }
  return { depth, drawn, blocks };
}

export function mountBotPanel(parts: Parts, session: GameSession, player: MovePlayer, why: ReturnType<typeof mountWhyPanel>, dev = false) {
  const engine = session.engine;
  const cards = engine.sovietCards;
  /** The activation on show, and the undo depth that takes it back. */
  let current: { activation: Activation; depth: number; lit: number } | null = null;
  /** The reading after each step of the impulse (an impulse may pause on its combats), the last one shown. */
  let readings: Reading[] = [];
  let reading: Reading | null = null;
  /** A decision the player picked: the slip stays on it while the play goes on. */
  let picked = false;
  let shownCard: string | null = null;

  // ---- Deck: the cards of the last impulse face up on the edges of the cards left.
  const initial = cards ? SOVIET_CARDS.filter((c) => cards.card(c)?.entryTurn === null) : [];
  /** Before Start, the initial cards the set-up adjustment did not discard (§3). */
  const pileSize = (state: GameState) => state.sovietCards?.drawPile.length ?? initial.filter((c) => !state.sovietDiscard.includes(c)).length;

  const renderDeck = (state: GameState) => {
    const drawn = state.sovietCards?.lastDrawn ?? [];
    const left = pileSize(state);
    const edges = Array.from({ length: left }, (_, i) => `<i style="--k:${i}"></i>`).join("");
    const [command, drawnAux] = drawn;
    const fresh = !!command && command !== shownCard;
    // The auxiliary card shows only while it is drawn: it turns over, then fades off at once.
    // The command card stays face up until the next impulse.
    const aux = fresh && !matchMedia("(prefers-reduced-motion: reduce)").matches ? drawnAux : undefined;
    // A drawn card leaves the pile face down, then turns over (two faces, card-back.png behind).
    const flip = (id: string, role: "bot.deck.auxiliary" | "bot.deck.command", extra: string) =>
      `<div class="card flip${extra}${fresh ? " drawn" : ""}" role="img" aria-label="${t(role, { card: id.toUpperCase() })}" data-card="${id}" tabindex="0">` +
      `<img class="back" src="${CARD_BACK}" alt=""><img class="face" src="${cardImage(id)}" alt=""></div>`;
    const face = command
      ? (aux ? flip(aux, "bot.deck.auxiliary", " aux") : "") + flip(command, "bot.deck.command", "")
      : left
        ? `<img class="card" src="${CARD_BACK}" alt="${t("bot.deck.faceDown")}">`
        : `<div class="card empty">${t("bot.deck.noCardLeft")}</div>`;
    parts.deck.innerHTML = `<div class="deck${aux ? " pair" : ""}" style="--left:${left}"><div class="edges">${edges}</div>${face}</div>` +
      `<p class="deck-count">${t("bot.deck.left", { count: left })}</p>` +
      `<p class="deck-note">${t(command ? "bot.deck.readHint" : "bot.deck.drawHint")}</p>`;
    shownCard = command ?? null;
  };

  // ---- Controls: the bot's impulse, the next turn.
  parts.activate.innerHTML = `<p class="turn-line"></p>
    <div class="impulse-row">
      <button type="button" class="btn ink" data-action="impulse">${t("bot.runImpulse")}</button>
      <button type="button" class="btn switch" data-action="next-turn">${t("bot.nextTurn")}</button>
    </div>
    <p class="activate-reason" role="status"></p>
    <p class="combat-wait" role="status" hidden></p>
    <div class="playback" hidden></div>` +
    (dev ? `<details class="dev-activate"><summary>${t("bot.devActivate")}</summary>
      <div class="activate-row"><select class="army-select" aria-label="${t("bot.devArmy")}"></select><button type="button" class="btn switch" data-action="activate">${t("bot.activate")}</button></div></details>` : "");
  const turnLine = parts.activate.querySelector<HTMLElement>(".turn-line")!;
  const runButton = parts.activate.querySelector<HTMLButtonElement>("[data-action=impulse]")!;
  const nextButton = parts.activate.querySelector<HTMLButtonElement>("[data-action=next-turn]")!;
  const reason = parts.activate.querySelector<HTMLElement>(".activate-reason")!;
  const select = parts.activate.querySelector<HTMLSelectElement>(".army-select");
  const playback = parts.activate.querySelector<HTMLElement>(".playback")!;
  const wait = parts.activate.querySelector<HTMLElement>(".combat-wait")!;
  const send = (command: Parameters<GameSession["dispatch"]>[0]) => {
    const refused = session.dispatch(command).find((e) => e.type === "CommandRejected");
    reason.textContent = refused ? t(refused.reason) : "";
  };
  parts.activate.addEventListener("click", (e) => {
    const action = (e.target as Element).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "impulse") send({ type: "RunBotImpulse" });
    else if (action === "next-turn") send({ type: "NextTurn" });
    else if (action === "activate" && select) send({ type: "ActivateFormation", army: select.value });
  });

  const renderControls = (state: GameState) => {
    const lock = engine.locked(state);
    const pile = state.sovietCards?.drawPile.length ?? 0;
    const impulses = state.sovietImpulses ?? 0;
    turnLine.innerHTML = !state.started ? t("bot.turnLine.beforeStart")
      : impulses ? t("bot.turnLine.started", { turn: state.turn, impulse: impulses }) : t("bot.turnLine.noImpulse", { turn: state.turn });
    // A Soviet impulse paused on a combat (4.5a): it goes on from the Combat tab.
    const paused = !!state.botImpulse;
    wait.hidden = !state.combat;
    wait.textContent = state.combat ? t("bot.waitCombat", { hex: state.combat.target }) : "";
    runButton.disabled = !!lock || !state.sovietCards || !pile || player.playing || paused;
    runButton.title = lock ? t(lock) : t(!pile && state.started ? "bot.runTitle.pileEmpty" : "bot.runTitle.endsImpulse");
    nextButton.disabled = !!lock || !state.sovietCards || pile > 0 || player.playing || paused;
    nextButton.title = pile ? t("bot.nextTitle.waitPile", { count: pile }) : t("bot.nextTitle.ready");
    if (select) {
      const armies = new Map<string, string>();
      for (const [id, s] of Object.entries(state.units)) {
        const u = engine.unit(id);
        if (u?.side === "soviet" && (isHex(s.at) || s.at === "reserve")) armies.set(u.armyOrCorps, u.front ?? "");
      }
      const keep = select.value;
      select.innerHTML = [...armies].sort(([, a], [, b]) => a.localeCompare(b))
        .map(([a, f]) => `<option value="${a}">${t("bot.armyOption", { army: armyName(a), front: frontName(f) })}</option>`).join("");
      if (armies.has(keep)) select.value = keep;
    }
  };

  // ---- Reading: each card of the last impulse, its lines and what the bot made of them.
  const lineStatus = (l: CardCommand, i: number, checks: Checked[], role: string) => {
    const c = checks.find((x) => x.index === i);
    const badge = l.turns ? `<span class="gt">${l.turns}</span>` : "";
    const cls = c ? (c.played ? "played" : "passed") : role === "auxiliary" && l.kind !== "event" ? "idle" : "unread";
    const note = !c ? "" : c.played ? `<span class="note">${esc(c.reason ? t(c.reason) : t("bot.reading.done"))}</span>`
      : `<span class="note">${esc(t("bot.reading.passed", { reason: c.reason ?? "" }))}</span>`;
    return `<li class="${cls}">${c?.played ? `<span class="mark" aria-label="${t("bot.reading.played")}">▶</span>` : ""}${badge}<span class="text">${esc(l.text)}</span>${note}</li>`;
  };

  const renderReading = () => {
    if (!reading || !cards) { parts.reading.hidden = true; parts.reading.innerHTML = ""; return; }
    parts.reading.hidden = false;
    const d = reading.drawn;
    const drew = d.cards.map((c) => c.toUpperCase()).join(t("bot.reading.and"));
    parts.reading.innerHTML = `<header class="reading-head"><h2>${t("bot.reading.title")}</h2><p>${esc(t("bot.reading.drew", { cards: drew, why: d.why }))}</p></header>` +
      reading.blocks.map((b) => {
        const c = cards.card(b.card)!;
        return `<article class="read-card"><h3><img src="${cardImage(b.card)}" alt="" data-card="${b.card}" tabindex="0">` +
          `<span>${b.card.toUpperCase()} ${esc(c.title)}<small>${t(`bot.reading.role.${b.role}`)}</small></span></h3>` +
          `<ol class="lines">${c.commands.map((l, i) => lineStatus(l, i, b.checks, b.role)).join("")}</ol>` +
          (b.fate ? `<p class="fate">${t(`bot.reading.fate.${b.fate}`)}</p>` : "") + `</article>`;
      }).join("");
  };

  // ---- Orders: the units of each activation, in the order the bot handled them.
  const outcome = (d: Decision) =>
    d.outcome === "moved" ? t("bot.order.moved", { from: d.from, to: d.to }) : d.outcome === "frozen" ? t("bot.order.stays", { from: d.from }) : t("bot.order.noMethod");
  /** "Method 11", "Army objective method 3" (9.26), or "No method". */
  const methodLabel = (method: string | null) => {
    const n = method?.match(/ method (\d+)$/)?.[1];
    if (!method) return t("bot.order.noMethodLabel");
    if (!n) return method;
    return t(method.startsWith("9.26") ? "bot.order.armyMethod" : "bot.order.method", { n });
  };

  const renderOrders = () => {
    if (!current) { parts.orders.innerHTML = ""; parts.orders.hidden = true; playback.hidden = true; return; }
    parts.orders.hidden = false;
    const { formations, decisions } = current.activation;
    const shown = why.shown();
    const speeds: Speed[] = ["slow", "normal", "fast"];
    const order = (d: Decision, i: number) => {
      const u = engine.unit(d.unit), s = session.state.units[d.unit];
      const state = i === current!.lit && player.playing ? "current" : i > current!.lit ? "pending" : "";
      return `<li><button type="button" data-order="${i}" class="${state}${d === shown ? " shown" : ""}${d.outcome === "moved" ? "" : " still"}">` +
        (u ? `<img src="${faceImage(u, s?.face ?? "front")}" alt="">` : "") +
        `<span class="name">${u?.designation ?? d.unit}<small>${methodLabel(d.method)}</small></span>` +
        `<span class="where">${outcome(d)}</span></button></li>`;
    };
    playback.hidden = false;
    playback.innerHTML = `<div class="speed" role="group" aria-label="${t("bot.speed.group")}">` +
      speeds.map((s) => `<button type="button" data-speed="${s}" aria-pressed="${player.speed === s}">${t(`bot.speed.${s}`)}</button>`).join("") +
      `</div><div class="playback-actions">` +
      `<button type="button" class="switch" data-action="replay-all"${player.playing ? " disabled" : canReplayAll() ? "" : ` disabled title="${t("bot.replayAllMoved")}"`}>${t("bot.replayAll")}</button>` +
      `<button type="button" class="switch" data-action="skip"${player.playing ? "" : " disabled"}>${t("bot.skip")}</button>` +
      `<button type="button" class="switch" data-action="clear-trails"${!player.playing && player.hasTrails ? "" : " disabled"} title="${t("bot.clearTrailsTitle")}">${t("bot.clearTrails")}</button></div>`;
    parts.orders.innerHTML = formations.map(({ formation, first, objectives }, k) => {
        const end = formations[k + 1]?.first ?? decisions.length;
        // Step 1 (9.0): the objective check, and any marker the moves reached.
        const marks = objectives.map((e) => `<p class="objective-check" title="${esc(t(e.why))} (${e.rule})">` +
          `${t("objective.change.line", { marker: objectiveName(e.marker, e.face), change: objectiveChange(e) })}</p>`).join("");
        return `<header class="orders-head"><h2>${t(armyName(formation.army))}</h2><p>${t("bot.formation.front", { front: frontName(formation.front), methods: formation.methods })}</p>${marks}</header>` +
          `<ol class="orders">${decisions.slice(first, end).map((d, j) => order(d, first + j)).join("")}</ol>`;
      }).join("");
    placeWhy();
  };

  /** The slip sits under the order it explains, unless the player opened it from the log. */
  function placeWhy() {
    if (why.inLog()) return;
    const d = why.shown(), i = d && current ? current.activation.decisions.indexOf(d) : -1;
    const li = i >= 0 ? parts.orders.querySelector<HTMLElement>(`[data-order="${i}"]`)?.closest("li") ?? null : null;
    why.place(li);
  }

  /** Every counter the activation walked still stands where it ended. */
  const canReplayAll = () => !!current && current.activation.decisions.every((d) => !walks(d) || session.state.units[d.unit]?.at === d.to);

  /** Plays the activation on show: the counters walk one after the other, the slip follows. */
  function playCurrent() {
    if (!current) return;
    const { activation } = current;
    current.lit = -1;
    player.play(activation, (i) => {
      if (!current) return;
      current.lit = i;
      // The slip follows the moves; a unit no method moves would only blank it.
      if (!picked && activation.decisions[i].outcome !== "noMove") why.show(activation.decisions[i]);
      renderOrders();
      renderControls(session.state);
    }, () => {
      // Skip lands every counter at once: no order is left pending.
      if (current?.activation === activation) current.lit = activation.decisions.length - 1;
      renderOrders();
      renderControls(session.state);
    });
  }

  playback.addEventListener("click", (e) => {
    const t = e.target as Element;
    const speed = t.closest<HTMLElement>("[data-speed]")?.dataset.speed as Speed | undefined;
    if (speed) { player.setSpeed(speed); renderOrders(); return; }
    if (t.closest("[data-action=skip]")) { player.skip(); return; }
    if (t.closest("[data-action=clear-trails]")) { player.clearTrails(); renderOrders(); return; }
    if (t.closest("[data-action=replay-all]")) {
      if (!player.playing && canReplayAll()) { picked = false; why.place(null); why.show(null); playCurrent(); }
    }
  });

  parts.orders.addEventListener("click", (e) => {
    const t = e.target as Element;
    const order = t.closest<HTMLElement>("[data-order]");
    if (order && current) { picked = true; why.place(null); why.show(current.activation.decisions[Number(order.dataset.order)]); renderOrders(); }
  });

  // ---- Soviet state kept so far.
  const renderStatus = (s: GameState) => {
    const adj = s.adjustment && ADJUSTMENTS.find((a) => a.id === s.adjustment!.id);
    const removed = s.sovietCards?.removed ?? [];
    const roll = s.adjustment?.roll;
    parts.status.innerHTML = (adj ? `<div><dt>${t("bot.status.adjustment")}</dt><dd>${roll ? t("bot.status.adjustmentRolled", { adjustment: adjustmentName(adj.id), roll }) : t(adjustmentName(adj.id))}</dd></div>` : "") +
      `<div><dt>${t("bot.status.vp")}</dt><dd>${s.vp}</dd></div>` +
      `<div><dt>${t("bot.status.discard")}</dt><dd>${s.sovietDiscard.length ? s.sovietDiscard.map((c) => c.toUpperCase()).join(t("list.comma")) : t("bot.status.none")}</dd></div>` +
      (removed.length ? `<div><dt>${t("bot.status.removed")}</dt><dd>${removed.map((c) => c.toUpperCase()).join(t("list.comma"))}</dd></div>` : "");
  };

  const render = (state: GameState) => { renderDeck(state); renderControls(state); renderReading(); renderOrders(); renderStatus(state); };

  /** Called after the units are drawn for a step, so the player can walk them. */
  function onStep(state: GameState, events: GameEvent[], undo: boolean) {
    const activation = undo ? null : readActivation(events);
    const impulse = undo ? null : readImpulse(events, session.depth);
    readings = readings.filter((r) => r.depth <= session.depth);
    if (impulse) readings = [impulse];
    else if (!undo && readings.length && events.some((e) => e.type === "CombatEnded"))
      readings.push(readImpulse(events, session.depth, readings[readings.length - 1])!);
    reading = readings.at(-1) ?? null;
    if (activation) {
      current = { activation, depth: session.depth, lit: -1 };
      picked = false;
      why.place(null);
      why.show(null);
      playCurrent();
    } else if (current && (session.depth < current.depth || impulse)) {
      // The activation was undone (or a new position loaded, or an impulse without one): its trails and slip go too.
      current = null;
      player.clear();
      if (!why.inLog()) why.show(null);
    }
    render(state);
    // The slip's Replay button depends on where the counter stands now.
    if (!activation) why.show(why.shown());
  }

  render(session.state);
  return {
    onStep,
  };
}
