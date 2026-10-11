// Bot tab of the rail (§3bis D): the Soviet card on the deck, the activation being played
// (army, front, its units in the order the bot moved them, the current one lit), playback
// speed, and the "Why this move" slip below. Plus the Soviet state kept so far.
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import { isHex, SOVIET_CARDS, type GameEvent, type GameState } from "../../engine/types";
import { faceImage } from "../data/game-data";
import { readActivation, type Activation, type Decision } from "../playback/activation";
import type { MovePlayer, Speed } from "../playback/move-player";
import type { GameSession } from "../state/session";
import type { mountWhyPanel } from "./why-panel";

const ARMIES: Record<string, string> = {
  "3T": "3rd Tank Army", "6": "6th Army", "40": "40th Army", "69": "69th Army", "1G": "1st Guards Army", Popov: "Mobile Group Popov",
};
const armyName = (token: string) => ARMIES[token] ?? `${token} Army`;
const frontName = (f: string) => (f === "voronezh" ? "Voronezh Front" : "Southwest Front");
const cardImage = (card: string) => `/assets/cards/EAKh-sovECcards-E-${card.slice(1)}.png`;

/** The card the bot drew for its impulse. TODO 4.1: read it from the game state (8.1). */
const drawnCard = (_state: GameState): string | null => null;

interface Parts { deck: HTMLElement; activate: HTMLElement; orders: HTMLElement; status: HTMLElement }

export function mountBotPanel(parts: Parts, session: GameSession, player: MovePlayer, why: ReturnType<typeof mountWhyPanel>) {
  const engine = session.engine;
  /** The activation on show, and the undo depth that takes it back. */
  let current: { activation: Activation; depth: number; lit: number } | null = null;
  /** A decision the player picked: the slip stays on it while the play goes on. */
  let picked = false;
  let shownCard: string | null = null;

  // ---- Deck: the drawn card face up on the edges of the cards left (one edge per card).
  const renderDeck = (state: GameState) => {
    const card = drawnCard(state);
    const left = SOVIET_CARDS.length - state.sovietDiscard.length - (card ? 1 : 0);
    const edges = Array.from({ length: left }, (_, i) => `<i style="--k:${i}"></i>`).join("");
    const face = card
      ? `<img class="card${card !== shownCard ? " drawn" : ""}" src="${cardImage(card)}" alt="Soviet card ${card.toUpperCase()}">`
      : `<div class="card empty">No card drawn</div>`;
    parts.deck.innerHTML = `<div class="deck" style="--left:${left}"><div class="edges">${edges}</div>${face}</div>` +
      `<p class="deck-count"><b>${left}</b> card${left === 1 ? "" : "s"} left</p>` +
      (card ? "" : `<p class="deck-note">The bot draws its card when it plays an impulse (coming with the Soviet cards).</p>`);
    shownCard = card;
  };

  // ---- Provisional trigger until the cards decide which formation moves (8.13).
  // TODO 4.1: replaced by "Run bot impulse" (§3bis A).
  const select = document.createElement("select");
  select.className = "army-select";
  select.setAttribute("aria-label", "Soviet army");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn ink";
  button.textContent = "Activate army";
  const reason = document.createElement("p");
  reason.className = "activate-reason";
  parts.activate.innerHTML = `<h2>Activate an army</h2><p class="hint">Stand-in for the Soviet cards: pick the formation the card would activate.</p>`;
  const row = document.createElement("div");
  row.className = "activate-row";
  row.append(select, button);
  parts.activate.append(row, reason);
  button.addEventListener("click", () => {
    const events = session.dispatch({ type: "ActivateFormation", army: select.value });
    const refused = events.find((e) => e.type === "CommandRejected");
    reason.textContent = refused ? refused.reason : "";
  });

  const renderActivate = (state: GameState) => {
    const armies = new Map<string, string>();
    for (const [id, s] of Object.entries(state.units)) {
      const u = engine.unit(id);
      if (u?.side === "soviet" && (isHex(s.at) || s.at === "reserve")) armies.set(u.armyOrCorps, u.front ?? "");
    }
    const keep = select.value;
    select.innerHTML = [...armies].sort(([, a], [, b]) => a.localeCompare(b))
      .map(([a, f]) => `<option value="${a}">${armyName(a)} (${frontName(f)})</option>`).join("");
    if (armies.has(keep)) select.value = keep;
    const lock = engine.locked(state);
    button.disabled = !!lock || !armies.size || player.playing;
    button.title = lock ?? "";
  };

  // ---- Orders: the units of the activation, in the order the bot handled them.
  const outcome = (d: Decision) =>
    d.outcome === "moved" ? `${d.from} to ${d.to}` : d.outcome === "frozen" ? `stays in ${d.from}` : "no method";

  const renderOrders = () => {
    if (!current) { parts.orders.innerHTML = ""; parts.orders.hidden = true; return; }
    parts.orders.hidden = false;
    const { formation, decisions } = current.activation;
    const shown = why.shown();
    const speeds: Speed[] = ["slow", "normal", "fast"];
    parts.orders.innerHTML = `<header class="orders-head"><h2>${armyName(formation.army)}</h2><p>${frontName(formation.front)}, movement methods ${formation.methods}</p></header>` +
      `<div class="playback"><div class="speed" role="group" aria-label="Animation speed">` +
      speeds.map((s) => `<button type="button" data-speed="${s}" aria-pressed="${player.speed === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("") +
      `</div><button type="button" class="switch" data-action="skip"${player.playing ? "" : " disabled"}>Skip</button></div>` +
      `<ol class="orders">` + decisions.map((d, i) => {
        const u = engine.unit(d.unit), s = session.state.units[d.unit];
        const state = i === current!.lit && player.playing ? "current" : i > current!.lit ? "pending" : "";
        return `<li><button type="button" data-order="${i}" class="${state}${d === shown ? " shown" : ""}${d.outcome === "moved" ? "" : " still"}">` +
          (u ? `<img src="${faceImage(u, s?.face ?? "front")}" alt="">` : "") +
          `<span class="name">${u?.designation ?? d.unit}<small>${d.method ? d.method.replace("9.21 method", "Method") : "No method"}</small></span>` +
          `<span class="where">${outcome(d)}</span></button></li>`;
      }).join("") + "</ol>";
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
    parts.status.innerHTML = (adj ? `<div><dt>Set-up adjustment</dt><dd>${adj.name}${s.adjustment!.roll ? ` (rolled ${s.adjustment!.roll})` : ""}</dd></div>` : "") +
      `<div><dt>Soviet VP</dt><dd>${s.vp}</dd></div>` +
      `<div><dt>Soviet discard</dt><dd>${s.sovietDiscard.length ? s.sovietDiscard.map((c) => c.toUpperCase()).join(", ") : "None"}</dd></div>`;
  };

  const render = (state: GameState) => { renderDeck(state); renderActivate(state); renderOrders(); renderStatus(state); };

  /** Called after the units are drawn for a step, so the player can walk them. */
  function onStep(state: GameState, events: GameEvent[], undo: boolean) {
    const activation = undo ? null : readActivation(events);
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
        renderActivate(session.state);
      }, () => { renderOrders(); renderActivate(session.state); });
    } else if (current && session.depth < current.depth) {
      // The activation was undone (or a new position loaded): its trails and slip go too.
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
