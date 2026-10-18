// State tags (§3bis H, task 4.6b, Q86): the conditions the bot reads, read from the game state
// (ground 18.33-18.34, support 13.51 and Forward Support 13.53, operational limit 9.8, Soviet
// desperation 9.22, OKW Expedites, STAVKA out of play 8.2 / 18.34). And the tags each event
// cites (Q88): tagEvents marks the events, the "Why this move" steps and the skipped methods
// whose messages come from a tagged rule, plus the events that are about a tag themselves.
import { msg, type Message, type MessageKey } from "../i18n/message";
import { frontName } from "./names";
import type { PendingRules } from "./pending";
import type { DecisionStep, GameEvent, GameState, ObjectiveFront, SkippedMethod, StateTag, TagId } from "./types";
import { MAX_FORWARD_SUPPORT } from "./types";

/** 8.2: STAVKA, out of play from Game-turn 7 (18.34: at once in heavy mud). */
const STAVKA = "e22";
const FRONTS: ObjectiveFront[] = ["voronezh", "southwest"];
/** 9.22: Soviet desperation below this many VPs. */
const DESPERATION_VP = 19;

/** Messages of the engine that come from a tagged rule: the tag they cite. */
const BY_MESSAGE: Partial<Record<MessageKey, TagId>> = {
  "cards.delay.lightMud": "lightMud",
  "combat.chits.lightMud": "lightMud",
  "reject.event.heavyMud": "heavyMud",
  "reject.replacement.heavyMudDone": "heavyMud",
  "reject.replacement.heavyMudInfantry": "heavyMud",
  "combat.noCard.unsupported": "support",
  "combat.noCard.defendersUnsupported": "support",
  "garrison.no.operationalLimit": "operationalLimit",
  "cards.endangered.outsideLimit": "operationalLimit",
  "move.method.moveIntoTowardOperationalLimit": "operationalLimit",
  "move.pref.hexWithinCurrentSovietOperationalLimit": "operationalLimit",
  "move.pref.hexWithinOperationalLimit": "operationalLimit",
  "move.skip.everyDestinationBeyondOperationalLimit": "operationalLimit",
  "move.skip.noActiveUnitBeyondOperationalLimit": "operationalLimit",
  "move.skip.withinOperationalLimit": "operationalLimit",
};

/** Tags cited by the messages in a value, at any depth (parameters included). `skip`: keys left out. */
function scan(value: unknown, into: Set<TagId>, skip: readonly string[] = []) {
  if (Array.isArray(value)) { for (const v of value) scan(v, into, skip); return; }
  if (!value || typeof value !== "object") return;
  const o = value as Record<string, unknown>;
  if (typeof o.key === "string") {
    const tag = BY_MESSAGE[o.key as MessageKey];
    if (tag) into.add(tag);
  }
  for (const [k, v] of Object.entries(o)) if (!skip.includes(k)) scan(v, into, skip);
}

/** The tag a message cites, if any (a step, a skipped method's reason). */
export function tagOf(m: Message | null | undefined): TagId | undefined {
  const found = new Set<TagId>();
  scan(m, found);
  return [...found][0];
}

/** The tags an event is about, beyond its messages. */
function own(e: GameEvent): TagId[] {
  switch (e.type) {
    case "FormationActivated": return e.desperation ? ["desperation"] : [];
    case "GroundRevealed": return [e.ground];
    case "HeavyMudTurn": return e.stavkaRemoved ? ["heavyMud", "stavkaRemoved"] : ["heavyMud"];
    case "VictorySkipped": return ["heavyMud"];
    case "ReminderAdded": return e.reminder.ground ? [e.reminder.ground] : [];
    case "SupplyPhaseDone": return [...(e.heavyMud ? ["heavyMud" as const] : []), ...(e.supportLine ? ["support" as const] : [])];
    case "ForwardSupportSet": return ["forwardSupport"];
    case "SovietCardRemoved": return e.card === STAVKA ? ["stavkaRemoved"] : [];
    case "ReplacementAssigned": return e.rule === "18.34" ? ["heavyMud"] : [];
    case "GermanEventPlayed": return e.event === "okwExpedites" ? ["okwExpedites"] : e.event === "airInterdiction" ? ["forwardSupport"] : [];
    default: return [];
  }
}

/** A step weighed on the move only if it set hexes aside. */
const tagStep = (s: DecisionStep): DecisionStep => {
  const tag = s.dropped.length ? tagOf(s.text) : undefined;
  return tag ? { ...s, tag } : s;
};
const tagSkipped = (k: SkippedMethod): SkippedMethod => {
  const tag = tagOf(k.reason);
  return tag ? { ...k, tag } : k;
};

/**
 * Marks each event with the tags that weighed on it (Q88). Methods that did not apply are left
 * out of the event's own tags (every 9.22 move lists some): they carry their own tag instead.
 */
export function tagEvents(events: GameEvent[]): GameEvent[] {
  return events.map((e) => {
    let event = e;
    if (event.type === "DecisionTraced" || event.type === "FormationActivated") event = { ...event, skipped: event.skipped.map(tagSkipped) };
    if (event.type === "DecisionTraced" || event.type === "ReservePlaced") event = { ...event, steps: event.steps.map(tagStep) };
    const found = new Set<TagId>(own(event));
    if (event.type === "DecisionTraced" || event.type === "ReservePlaced") {
      for (const s of event.steps) if (s.tag) found.add(s.tag);
      if (event.type === "DecisionTraced") scan(event.title, found);
      if (event.type === "ReservePlaced") scan(event.reason, found);
    } else scan(event, found, ["skipped", "tags"]);
    return found.size ? { ...event, tags: [...found] } : event;
  });
}

export function createTags(rules: PendingRules) {
  const turnOnly = (turn: number) => msg("tag.until.turn", { turn });

  /** The state tags of the moment, in the order of the bar (Q86). */
  function tags(state: GameState): StateTag[] {
    const out: StateTag[] = [];
    const vp = state.vp;
    const withoutObjective = FRONTS.filter((f) => !state.objectives[f]);
    // 18.33: the ground condition from Game-turn 7.
    if (state.turn >= 7) {
      const g = rules.ground(state);
      out.push({ id: g, name: msg(`tag.${g}.name`), effect: msg(`tag.${g}.effect`), rule: g === "frozen" ? "18.33" : "18.34", until: turnOnly(state.turn) });
    }
    // 13.51: the support line [GT 5+]; from GT 8, set in the Supply Phase by the VPs.
    if (state.turn >= 5) {
      const line = state.turn < 8 ? "west" : state.supportLine ?? (vp >= 21 ? "west" : "east");
      const until = state.turn < 8 ? msg("tag.until.turn7") : state.supportLine ? turnOnly(state.turn) : msg("tag.until.supplyPhase");
      out.push({ id: "support", name: msg(`tag.support.name.${line}`), effect: msg("tag.support.effect"), rule: "13.51", until });
    }
    // 13.53: Forward Support markers, off the map at the end of the turn (13.54).
    const markers = state.forwardSupport ?? [];
    if (markers.length) {
      out.push({
        id: "forwardSupport", name: msg("tag.forwardSupport.name", { count: markers.length, max: MAX_FORWARD_SUPPORT }),
        effect: msg("tag.forwardSupport.effect", { hexes: markers }), rule: "13.53", until: turnOnly(state.turn),
      });
    }
    // 9.8 [GT 6+]: far with 21 VPs or more, near otherwise; for the fronts without an objective marker.
    const limit = rules.operationalLimit(state);
    if (limit) {
      out.push({
        id: "operationalLimit", name: msg(`tag.operationalLimit.name.${limit}`),
        effect: withoutObjective.length
          ? msg("tag.operationalLimit.effect", { fronts: withoutObjective.map(frontName) })
          : msg("tag.operationalLimit.effectNone"),
        rule: "9.8", until: msg(limit === "far" ? "tag.until.vpAtLeast" : "tag.until.vpAtMost", { vp: limit === "far" ? 21 : 20 }),
      });
    }
    // 9.22: Soviet desperation, for the fronts that move by 9.22.
    if (state.turn >= 5 && vp < DESPERATION_VP && withoutObjective.length) {
      out.push({
        id: "desperation", name: msg("tag.desperation.name"),
        effect: msg("tag.desperation.effect", { fronts: withoutObjective.map(frontName) }),
        rule: "9.22", until: msg("tag.until.vpBelow", { vp: DESPERATION_VP }),
      });
    }
    // OKW Expedites, played on Game-turn 4 (Q77): the German reserves of turn 6 come on turn 5.
    if (state.okwExpedites && state.turn === 4) {
      out.push({ id: "okwExpedites", name: msg("tag.okwExpedites.name"), effect: msg("tag.okwExpedites.effect"), rule: "", until: msg("tag.until.turnStart", { turn: 5 }) });
    }
    // 8.2: STAVKA out of play from turn 7; 18.34: at the start of a heavy mud turn 7.
    if (state.sovietCards?.removed.includes(STAVKA)) {
      const mud = state.ground?.turns[7] === "heavyMud";
      out.push({ id: "stavkaRemoved", name: msg("tag.stavkaRemoved.name"), effect: msg(mud ? "tag.stavkaRemoved.effectMud" : "tag.stavkaRemoved.effect"), rule: mud ? "18.34" : "8.2", until: msg("tag.until.game") });
    }
    return out;
  }

  return { tags };
}
