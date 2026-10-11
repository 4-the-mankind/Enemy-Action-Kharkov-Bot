// Bot tab of the rail (§3bis D): the Soviet cards on the deck, "Run bot impulse" and "Next
// turn", how the bot read the cards of its last impulse (8.1), the activations being played
// (each formation, its units in the order the bot moved them, the current one lit), playback
// speed, and the "Why this move" slip below. Plus the Soviet state kept so far.
import type { CardCommand } from "../../core/soviet-cards";
import { ARMY_NAMES } from "../../engine/soviet-cards";
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import { isHex, SOVIET_CARDS, type GameEvent, type GameState } from "../../engine/types";
import { faceImage } from "../data/game-data";
import { readActivation, type Activation, type Decision } from "../playback/activation";
import type { MovePlayer, Speed } from "../playback/move-player";
import type { GameSession } from "../state/session";
import { CARD_BACK, cardImage } from "./card-zoom";
import type { mountWhyPanel } from "./why-panel";

const armyName = (token: string) => ARMY_NAMES[token] ?? `${token} Army`;
const frontName = (f: string) => (f === "voronezh" ? "Voronezh Front" : "Southwest Front");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

interface Parts { deck: HTMLElement; activate: HTMLElement; reading: HTMLElement; orders: HTMLElement; status: HTMLElement }

type Checked = Extract<GameEvent, { type: "SovietCommandChecked" }>;

/** The cards of an impulse as the bot read them, in play order. */
interface Reading {
  depth: number;
  drawn: Extract<GameEvent, { type: "SovietCardsDrawn" }>;
  /** One block per card read: the auxiliary card's event check, then each command card. */
  blocks: { card: string; role: "auxiliary" | "command" | "second"; checks: Checked[]; fate: string }[];
}

function readImpulse(events: GameEvent[], depth: number): Reading | null {
  const drawn = events.find((e): e is Reading["drawn"] => e.type === "SovietCardsDrawn");
  if (!drawn) return null;
  const blocks: Reading["blocks"] = [];
  const block = (card: string, role: Reading["blocks"][number]["role"]) => {
    const b = { card, role, checks: [] as Checked[], fate: "" };
    blocks.push(b);
    return b;
  };
  let cur: Reading["blocks"][number] | null = null;
  for (const e of events) {
    if (e.type === "SovietCommandCard") cur = block(e.card, e.second ? "second" : "command");
    else if (e.type === "SovietCommandChecked") {
      if (e.role === "auxiliary" && cur?.card !== e.card) cur = block(e.card, "auxiliary");
      cur!.checks.push(e);
    } else if (cur && e.type === "SovietCardDiscarded" && e.card === cur.card) cur.fate = "Discarded.";
    else if (cur && e.type === "SovietCardReturned" && e.card === cur.card) cur.fate = "Shuffled back into the draw pile.";
    else if (cur && e.type === "SovietCardRemoved" && e.card === cur.card) cur.fate = "Removed from the game (8.2).";
  }
  return { depth, drawn, blocks };
}

export function mountBotPanel(parts: Parts, session: GameSession, player: MovePlayer, why: ReturnType<typeof mountWhyPanel>, dev = false) {
  const engine = session.engine;
  const cards = engine.sovietCards;
  /** The activation on show, and the undo depth that takes it back. */
  let current: { activation: Activation; depth: number; lit: number } | null = null;
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
    const flip = (id: string, role: string, extra: string) =>
      `<div class="card flip${extra}${fresh ? " drawn" : ""}" role="img" aria-label="${role} ${id.toUpperCase()}" data-card="${id}" tabindex="0">` +
      `<img class="back" src="${CARD_BACK}" alt=""><img class="face" src="${cardImage(id)}" alt=""></div>`;
    const face = command
      ? (aux ? flip(aux, "Auxiliary card", " aux") : "") + flip(command, "Command card", "")
      : left
        ? `<img class="card" src="${CARD_BACK}" alt="Soviet draw pile, face down">`
        : `<div class="card empty">No card left</div>`;
    parts.deck.innerHTML = `<div class="deck${aux ? " pair" : ""}" style="--left:${left}"><div class="edges">${edges}</div>${face}</div>` +
      `<p class="deck-count"><b>${left}</b> card${left === 1 ? "" : "s"} left</p>` +
      (command ? `<p class="deck-note">Point at a card to read it, click to keep it up.</p>`
        : `<p class="deck-note">The bot draws two cards at each impulse: one commands, the other is the auxiliary card (8.1).</p>`);
    shownCard = command ?? null;
  };

  // ---- Controls: the bot's impulse, the next turn.
  parts.activate.innerHTML = `<p class="turn-line"></p>
    <div class="impulse-row">
      <button type="button" class="btn ink" data-action="impulse">Run bot impulse</button>
      <button type="button" class="btn switch" data-action="next-turn">Next turn</button>
    </div>
    <p class="activate-reason" role="status"></p>` +
    (dev ? `<details class="dev-activate"><summary>Activate an army (dev scenario)</summary>
      <div class="activate-row"><select class="army-select" aria-label="Soviet army"></select><button type="button" class="btn switch" data-action="activate">Activate</button></div></details>` : "");
  const turnLine = parts.activate.querySelector<HTMLElement>(".turn-line")!;
  const runButton = parts.activate.querySelector<HTMLButtonElement>("[data-action=impulse]")!;
  const nextButton = parts.activate.querySelector<HTMLButtonElement>("[data-action=next-turn]")!;
  const reason = parts.activate.querySelector<HTMLElement>(".activate-reason")!;
  const select = parts.activate.querySelector<HTMLSelectElement>(".army-select");
  const send = (command: Parameters<GameSession["dispatch"]>[0]) => {
    const refused = session.dispatch(command).find((e) => e.type === "CommandRejected");
    reason.textContent = refused ? refused.reason : "";
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
    turnLine.innerHTML = state.started
      ? `<b>Game-turn ${state.turn}</b>${impulses ? `, after Soviet impulse ${impulses}` : ", no Soviet impulse yet"}`
      : "<b>Game-turn 1</b>, before Start";
    runButton.disabled = !!lock || !state.sovietCards || !pile || player.playing;
    runButton.title = lock ?? (!pile && state.started ? "The Soviet draw pile is empty." : "Ends your German impulse: the bot plays its Soviet impulse.");
    nextButton.disabled = !!lock || !state.sovietCards || pile > 0 || player.playing;
    nextButton.title = pile ? `Once the Soviet draw pile is empty (${pile} left) and your cards are played.` : "End this turn and start the next.";
    if (select) {
      const armies = new Map<string, string>();
      for (const [id, s] of Object.entries(state.units)) {
        const u = engine.unit(id);
        if (u?.side === "soviet" && (isHex(s.at) || s.at === "reserve")) armies.set(u.armyOrCorps, u.front ?? "");
      }
      const keep = select.value;
      select.innerHTML = [...armies].sort(([, a], [, b]) => a.localeCompare(b))
        .map(([a, f]) => `<option value="${a}">${armyName(a)} (${frontName(f)})</option>`).join("");
      if (armies.has(keep)) select.value = keep;
    }
  };

  // ---- Reading: each card of the last impulse, its lines and what the bot made of them.
  const lineStatus = (l: CardCommand, i: number, checks: Checked[], role: string) => {
    const c = checks.find((x) => x.index === i);
    const badge = l.turns ? `<span class="gt">${l.turns}</span>` : "";
    const cls = c ? (c.played ? "played" : "passed") : role === "auxiliary" && l.kind !== "event" ? "idle" : "unread";
    const note = c ? (c.played ? `<span class="note">${esc(c.reason ?? "Done.")}</span>` : `<span class="note">Passed over: ${esc(c.reason ?? "")}.</span>`) : "";
    return `<li class="${cls}">${c?.played ? '<span class="mark" aria-label="played">▶</span>' : ""}${badge}<span class="text">${esc(l.text)}</span>${note}</li>`;
  };
  const roleName = { auxiliary: "Auxiliary card: event check", command: "Command card", second: "Second impulse: the auxiliary card commands" } as const;

  const renderReading = () => {
    if (!reading || !cards) { parts.reading.hidden = true; parts.reading.innerHTML = ""; return; }
    parts.reading.hidden = false;
    const d = reading.drawn;
    parts.reading.innerHTML = `<header class="reading-head"><h2>Soviet impulse</h2><p>Drew ${d.cards.map((c) => c.toUpperCase()).join(" and ")}: ${esc(d.why)}.</p></header>` +
      reading.blocks.map((b) => {
        const c = cards.card(b.card)!;
        return `<article class="read-card"><h3><img src="${cardImage(b.card)}" alt="" data-card="${b.card}" tabindex="0">` +
          `<span>${b.card.toUpperCase()} ${esc(c.title)}<small>${roleName[b.role]}</small></span></h3>` +
          `<ol class="lines">${c.commands.map((l, i) => lineStatus(l, i, b.checks, b.role)).join("")}</ol>` +
          (b.fate ? `<p class="fate">${b.fate}</p>` : "") + `</article>`;
      }).join("");
  };

  // ---- Orders: the units of each activation, in the order the bot handled them.
  const outcome = (d: Decision) =>
    d.outcome === "moved" ? `${d.from} to ${d.to}` : d.outcome === "frozen" ? `stays in ${d.from}` : "no method";

  const renderOrders = () => {
    if (!current) { parts.orders.innerHTML = ""; parts.orders.hidden = true; return; }
    parts.orders.hidden = false;
    const { formations, decisions } = current.activation;
    const shown = why.shown();
    const speeds: Speed[] = ["slow", "normal", "fast"];
    const order = (d: Decision, i: number) => {
      const u = engine.unit(d.unit), s = session.state.units[d.unit];
      const state = i === current!.lit && player.playing ? "current" : i > current!.lit ? "pending" : "";
      return `<li><button type="button" data-order="${i}" class="${state}${d === shown ? " shown" : ""}${d.outcome === "moved" ? "" : " still"}">` +
        (u ? `<img src="${faceImage(u, s?.face ?? "front")}" alt="">` : "") +
        `<span class="name">${u?.designation ?? d.unit}<small>${d.method ? d.method.replace(/^9\.2[12] method/, "Method") : "No method"}</small></span>` +
        `<span class="where">${outcome(d)}</span></button></li>`;
    };
    parts.orders.innerHTML = `<div class="playback"><div class="speed" role="group" aria-label="Animation speed">` +
      speeds.map((s) => `<button type="button" data-speed="${s}" aria-pressed="${player.speed === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("") +
      `</div><button type="button" class="switch" data-action="skip"${player.playing ? "" : " disabled"}>Skip</button></div>` +
      formations.map(({ formation, first }, k) => {
        const end = formations[k + 1]?.first ?? decisions.length;
        return `<header class="orders-head"><h2>${armyName(formation.army)}</h2><p>${frontName(formation.front)}, movement methods ${formation.methods}</p></header>` +
          `<ol class="orders">${decisions.slice(first, end).map((d, j) => order(d, first + j)).join("")}</ol>`;
      }).join("");
  };

  parts.orders.addEventListener("click", (e) => {
    const t = e.target as Element;
    const speed = t.closest<HTMLElement>("[data-speed]")?.dataset.speed as Speed | undefined;
    if (speed) { player.setSpeed(speed); renderOrders(); return; }
    if (t.closest("[data-action=skip]")) { player.skip(); return; }
    const order = t.closest<HTMLElement>("[data-order]");
    if (order && current) { picked = true; why.show(current.activation.decisions[Number(order.dataset.order)]); renderOrders(); }
  });

  // ---- Soviet state kept so far.
  const renderStatus = (s: GameState) => {
    const adj = s.adjustment && ADJUSTMENTS.find((a) => a.id === s.adjustment!.id);
    const removed = s.sovietCards?.removed ?? [];
    parts.status.innerHTML = (adj ? `<div><dt>Set-up adjustment</dt><dd>${adj.name}${s.adjustment!.roll ? ` (rolled ${s.adjustment!.roll})` : ""}</dd></div>` : "") +
      `<div><dt>Soviet VP</dt><dd>${s.vp}</dd></div>` +
      `<div><dt>Soviet discard</dt><dd>${s.sovietDiscard.length ? s.sovietDiscard.map((c) => c.toUpperCase()).join(", ") : "None"}</dd></div>` +
      (removed.length ? `<div><dt>Out of the game</dt><dd>${removed.map((c) => c.toUpperCase()).join(", ")}</dd></div>` : "");
  };

  const render = (state: GameState) => { renderDeck(state); renderControls(state); renderReading(); renderOrders(); renderStatus(state); };

  /** Called after the units are drawn for a step, so the player can walk them. */
  function onStep(state: GameState, events: GameEvent[], undo: boolean) {
    const activation = undo ? null : readActivation(events);
    const impulse = undo ? null : readImpulse(events, session.depth);
    if (impulse) reading = impulse;
    else if (reading && session.depth < reading.depth) reading = null;
    if (activation) {
      current = { activation, depth: session.depth, lit: -1 };
      picked = false;
      why.show(null);
      player.play(activation, (i) => {
        if (!current) return;
        current.lit = i;
        // The slip follows the moves; a unit no method moves would only blank it.
        if (!picked && activation.decisions[i].outcome !== "noMove") why.show(activation.decisions[i]);
        renderOrders();
        renderControls(session.state);
      }, () => { renderOrders(); renderControls(session.state); });
    } else if (current && (session.depth < current.depth || impulse)) {
      // The activation was undone (or a new position loaded, or an impulse without one): its trails and slip go too.
      current = null;
      player.clear();
      why.show(null);
    }
    render(state);
    // The slip's Replay button depends on where the counter stands now.
    if (!activation) why.show(why.shown());
  }

  render(session.state);
  return {
    onStep,
    /** Shows a decision picked elsewhere (log line), lighting its order when it belongs to the activation on show. */
    pick(d: Decision) { picked = true; why.show(d); renderOrders(); },
  };
}
