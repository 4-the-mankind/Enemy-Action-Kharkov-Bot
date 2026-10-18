// German events that act on what only the app holds (Q77, task 4.6): the player plays the
// card on the table and tells the app. STAVKA Confused discards from the virtual Soviet draw
// pile; OKW Expedites brings the German units due on turn 6 into their reserve box on turn 5
// (the engine's Reserve Phase); Air Interdiction removes a Forward Support marker. The other
// German events go through the counter menu (Dispersed, IP, supply marker).
import type { SovietCard } from "../core/soviet-cards";
import type { Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import type { PendingRules } from "./pending";
import type { GameState, GermanEventId, StepResult } from "./types";

export interface GermanEventsData {
  card(id: string): SovietCard | undefined;
  /** Units used in the solo game. */
  units: Unit[];
  rules: PendingRules;
}

/** STAVKA Confused: cards are discarded until their Command Values total at least this. */
const STAVKA_CONFUSED_VALUE = 4;
/** Game-turns printed on the special events (events.json). */
const TURNS: Partial<Record<GermanEventId, number[]>> = { stavkaConfused: [5, 6], okwExpedites: [4] };

export function createGermanEvents({ card, units, rules }: GermanEventsData) {
  /** Why the event may not be played now, or null. */
  function whyNot(state: GameState, event: GermanEventId, hex?: string): Message | null {
    // 18.34: no card is played in a heavy mud turn.
    if (rules.ground(state) === "heavyMud") return msg("reject.event.heavyMud");
    const turns = TURNS[event];
    if (turns && !turns.includes(state.turn)) return msg("reject.event.turns", { turns: turns.join("-") });
    if (event === "stavkaConfused" && !state.sovietCards?.drawPile.length) return msg("reject.event.pileEmpty");
    if (event === "okwExpedites" && state.okwExpedites) return msg("reject.event.alreadyPlayed");
    if (event === "airInterdiction") {
      const markers = state.forwardSupport ?? [];
      if (!markers.length) return msg("reject.event.noForwardSupport");
      if (!hex || !markers.includes(hex)) return msg("reject.event.noMarkerThere", { hex: hex ?? "" });
    }
    return null;
  }

  function play(state: GameState, event: GermanEventId, hex?: string): StepResult | Message {
    const why = whyNot(state, event, hex);
    if (why) return why;
    if (event === "stavkaConfused") {
      const pile = state.sovietCards!.drawPile;
      const cards: string[] = [];
      for (let total = 0; total < STAVKA_CONFUSED_VALUE && cards.length < pile.length;) {
        cards.push(pile[cards.length]);
        total += card(cards[cards.length - 1])?.commandValue ?? 0;
      }
      return {
        state: { ...state, sovietCards: { ...state.sovietCards!, drawPile: pile.slice(cards.length) }, sovietDiscard: [...state.sovietDiscard, ...cards] },
        events: [{ type: "GermanEventPlayed", event, cards }],
      };
    }
    if (event === "okwExpedites") {
      const due = units.filter((u) => u.side === "german" && u.entryTurn === 6 && state.units[u.id]?.at === "reinforcements").map((u) => u.id);
      return { state: { ...state, okwExpedites: true }, events: [{ type: "GermanEventPlayed", event, units: due }] };
    }
    return {
      state: { ...state, forwardSupport: (state.forwardSupport ?? []).filter((h) => h !== hex) },
      events: [{ type: "GermanEventPlayed", event, hex }],
    };
  }

  return { play, whyNot };
}
