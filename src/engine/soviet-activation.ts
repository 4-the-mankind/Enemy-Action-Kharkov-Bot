// A whole Soviet activation (9.0): steps 1-2 (objective check, movement: soviet-movement.ts),
// step 3 (attack checks: soviet-attacks.ts), step 4 [GT 4+] reserves placed (9.5), step 5
// [GT 2+] removals to the reserve box (9.6), step 6 [GT 4+] one IP (9.7), step 7 Dispersed
// markers removed (12.9), then the end of the activation (9.12).
//
// Q37: a valid attack stops the activation. Its progress (SovietActivation) is kept in the
// state while the player resolves the combat by hand; `resume` goes on from there. Attackers
// found in another hex at that time have advanced after combat: they moved (Q40).
import type { Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import type { Board } from "./board";
import { withUnitAt, without, type Movement } from "./movement";
import type { Objectives } from "./objectives";
import type { PendingRules } from "./pending";
import { narrowHexes, requireHexes, type SovietAttacks } from "./soviet-attacks";
import type { SovietMovement } from "./soviet-movement";
import { isHex, type DecisionStep, type GameEvent, type GameState, type SovietActivation, type StepResult } from "./types";

export interface SovietActivationData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  objectives: Objectives;
  sovietMovement: SovietMovement;
  attacks: SovietAttacks;
  /** The engine's bot commands: MoveUnits, SetDispersed, SetImprovedPosition. */
  move(state: GameState, ids: string[], to: string): StepResult;
  setDispersed(state: GameState, ids: string[], dispersed: boolean): StepResult;
  setImprovedPosition(state: GameState, hex: string, placed: boolean): StepResult;
}

/** What the activating card brings (8.13, 9.4, 12.35). */
export interface ActivationOptions {
  commandValue: number;
  /** STAVKA: the NKVD combat tactic in every attack. */
  nkvd: boolean;
  /** Card in the Auxiliary card box (12.31), if any. */
  auxiliary: string | null;
}

/** An activation run so far: `pending` set when it stopped on an attack (Q37). */
export type ActivationRun = StepResult & { pending: SovietActivation | null };

/** 9.6: Kharkov's units are never removed. */
const KHARKOV = "0912";

export type SovietActivations = ReturnType<typeof createSovietActivation>;

export function createSovietActivation(data: SovietActivationData) {
  const { board, movement, unit, rules, objectives, sovietMovement, attacks, move, setDispersed, setImprovedPosition } = data;
  const known = (id: string) => {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  };
  const sideOf = (id: string) => known(id).side;
  const onMap = (state: GameState, id: string) => isHex(state.units[id]?.at ?? "");
  const values = (state: GameState, id: string) => movement.faceValues(state, id);
  const supplied = (state: GameState, id: string) => rules.supplyStatus(state, id) === "supplied";
  const isTownOrCity = (hex: string) => board.hex(hex).terrain === "town" || board.hex(hex).terrain === "city";
  const hasIp = (state: GameState, hex: string) => !!state.improvedPositions?.includes(hex);
  function unitsIn(state: GameState, hex: string, side?: "german" | "soviet"): string[] {
    const out: string[] = [];
    for (const id of state.order) if (state.units[id]?.at === hex && (!side || sideOf(id) === side)) out.push(id);
    return out;
  }
  const adjacentHexesWith = (state: GameState, hex: string, side: "german" | "soviet") =>
    board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex) && unitsIn(state, n.hex, side).length).map((n) => n.hex);
  const onMapOf = (state: GameState, side: "german" | "soviet") => Object.keys(state.units).filter((id) => sideOf(id) === side && onMap(state, id));

  /** Reach of a unit in a given state (9.3 proximate), cached for that state object. */
  const reachCache = new WeakMap<GameState, Map<string, Set<string>>>();
  function reach(state: GameState, id: string): Set<string> {
    let byUnit = reachCache.get(state);
    if (!byUnit) reachCache.set(state, (byUnit = new Map()));
    let r = byUnit.get(id);
    if (!r) byUnit.set(id, (r = new Set(movement.reachable(state, id, { ground: rules.ground(state) }).hexes.keys())));
    return r;
  }
  /** 9.3: a unit is proximate to an empty hex (it can enter it) within its reach; a cheap hex count first. */
  const proximateToHex = (state: GameState, id: string, hex: string) =>
    board.hexCount(state.units[id].at, hex) <= 2 * values(state, id).movement + 2 && reach(state, id).has(hex) && movement.canEndIn(state, hex, [id]);

  /**
   * Steps 1-7 of the activation of the formation (9.0), stopping on the first valid attack.
   * `units`: the active units the card chose (8.13); by default, the whole army.
   */
  function start(state: GameState, army: string, units: string[] | undefined, opts: ActivationOptions): ActivationRun | Message {
    const r = sovietMovement.moveFormation(state, army, units);
    if ("key" in r) return r;
    const header = r.events.find((e): e is Extract<GameEvent, { type: "FormationActivated" }> => e.type === "FormationActivated")!;
    const moved = r.events.flatMap((e) => (e.type === "UnitsMoved" && isHex(e.to) ? e.units : []));
    const act: SovietActivation = {
      army, front: header.front, units: header.units, commandValue: opts.commandValue, nkvd: opts.nkvd,
      moved: [...new Set(moved)], fromReserve: [], attacked: [], checked: [], led: [], passChecks: 0, refused: [],
      entered: [...sovietMovement.enteredHexes(r.events)],
    };
    const rest = proceed(r.state, act, opts.auxiliary);
    return { ...rest, events: [...r.events, ...rest.events] };
  }

  /** Goes on with the activation once the player has resolved the combat it stopped on (Q37). */
  function resume(state: GameState, act: SovietActivation, auxiliary: string | null): ActivationRun {
    const { attack, ...rest } = act;
    if (!attack) return proceed(state, act, auxiliary);
    // Attackers now in another hex advanced after combat (12.8): they moved (Q40) and entered it (9.12).
    const advanced = attack.units.filter((id) => onMap(state, id) && state.units[id].at !== attack.at[id]);
    return proceed(state, {
      ...rest,
      moved: [...new Set([...rest.moved, ...advanced])],
      entered: [...new Set([...rest.entered, ...advanced.map((id) => state.units[id].at)])],
    }, auxiliary);
  }

  function proceed(state: GameState, act: SovietActivation, auxiliary: string | null): ActivationRun {
    // Step 3: attack checks (9.4); a valid attack stops the activation (Q37).
    const placedBefore = act.fromReserve.length;
    const c = attacks.checks(state, act, auxiliary);
    if (c.declared) {
      const placed = c.act.fromReserve.slice(placedBefore);
      const pending = { ...c.act, entered: [...new Set([...c.act.entered, ...placed.map((id) => c.state.units[id].at)])] };
      return { state: c.state, events: c.events, pending };
    }
    state = c.state;
    act = c.act;
    const events: GameEvent[] = [...c.events];
    const run = (r: { state: GameState; act: SovietActivation; events: GameEvent[] }) => {
      state = r.state;
      act = r.act;
      events.push(...r.events);
    };
    if (state.turn >= 4) run(placeReserves(state, act)); // step 4 (9.5)
    if (state.turn >= 2) run(removals(state, act)); // step 5 (9.6)
    if (state.turn >= 4) run(placeIp(state, act)); // step 6 (9.7)
    // Step 7 (12.9): active units that did not attack lose their Dispersed marker.
    const undisperse = act.units.filter((id) => onMap(state, id) && state.units[id].dispersed && !act.attacked.includes(id));
    if (undisperse.length) {
      const r = setDispersed(state, undisperse, false);
      state = r.state;
      events.push(...r.events);
    }
    // 9.12: a front's third objective entered during the activation leaves play.
    const end = objectives.endActivation(state, new Set(act.entered));
    events.push(...end.events, { type: "ActivationEnded", army: act.army });
    return { state: end.state, events, pending: null };
  }

  // ---- Step 4 [GT 4+]: active reserves placed in VP and village hexes (9.5).

  function placeReserves(state: GameState, act: SovietActivation) {
    const events: GameEvent[] = [];
    for (const id of attacks.sorted(state, act.units.filter((u) => state.units[u]?.at === "reserve"), "desc")) {
      const steps: DecisionStep[] = [];
      const hex = placementHex(state, act, id, steps);
      if (!hex) {
        events.push({ type: "ReservePlaced", unit: id, hex: null, rule: "9.5", steps, reason: msg("reserve.why.noHex") });
        continue;
      }
      events.push({ type: "ReservePlaced", unit: id, hex, rule: "9.5", steps });
      // TODO 4.6: the garrison marker of the hex is removed (9.5).
      const m = move(state, [id], hex);
      state = m.state;
      events.push(...m.events);
      act = { ...act, fromReserve: [...act.fromReserve, id], entered: [...new Set([...act.entered, hex])] };
    }
    return { state, act, events };
  }

  /** 9.5: the hex where the reserve unit is placed, or null. */
  function placementHex(state: GameState, act: SovietActivation, id: string, steps: DecisionStep[]): string | null {
    const front = act.front;
    // A village or Soviet town/city targeted by the active front (German towns/cities are not eligible).
    let hexes = board.hexes.filter((h) => {
      const d = board.hex(h);
      return (d.frontTarget === front || d.frontTarget === "both") && (d.village || (isTownOrCity(h) && movement.townOwner(state, h) === "soviet"));
    });
    hexes = requireHexes(hexes, "9.5", msg("reserve.req.unoccupied"), (h) => unitsIn(state, h).length === 0, steps);
    hexes = requireHexes(hexes, "9.5", msg("reserve.req.withinLimit"), (h) => !rules.beyondOperationalLimit(state, front, h), steps);
    hexes = requireHexes(hexes, "9.5", msg("reserve.req.notAdjacentSoviet"),
      (h) => board.hex(h).vp !== null || !adjacentHexesWith(state, h, "soviet").length, steps);
    hexes = requireHexes(hexes, "9.5", msg("reserve.req.reserveSupply"), (h) => rules.reserveSupplyTracesTo(state, h), steps);
    // Q25: a hex where the unit would be surrounded is not "not nearly surrounded" either.
    hexes = requireHexes(hexes, "9.5", msg("reserve.req.notNearlySurrounded"), (h) => {
      if (!board.hex(h).village || isTownOrCity(h)) return true;
      const after = withUnitAt(state, id, h);
      return !movement.isNearlySurrounded(after, id) && !movement.isSurrounded(after, id);
    }, steps);
    if (!hexes.length) return null;
    const germans = onMapOf(state, "german");
    const soviets = onMapOf(state, "soviet").filter((u) => supplied(state, u));
    const army = soviets.filter((u) => known(u).armyOrCorps === act.army && !act.fromReserve.includes(u));
    const frontUnits = soviets.filter((u) => known(u).front === front);
    const closest = (units: string[]) => (h: string) => (units.length ? Math.min(...units.map((u) => board.distance(h, state.units[u].at))) : null);
    return narrowHexes(hexes, [
      { rule: "9.5 a", text: msg("reserve.pref.germanThreat"), test: (h) => rules.supplyTracesTo(state, "german", h) || germans.some((g) => proximateToHex(state, g, h)) },
      { rule: "9.5 b", text: msg("reserve.pref.garrison"), test: (h) => rules.garrisonAt(state, h) },
      { rule: "9.5 c", text: msg("reserve.pref.adjacentGerman"), test: (h) => adjacentHexesWith(state, h, "german").length > 0 },
      { rule: "9.5 d", text: msg("reserve.pref.support"), test: (h) => rules.inSovietSupport(state, h) },
      { rule: "9.5 e", text: msg("reserve.pref.city"), test: (h) => board.hex(h).terrain === "city" },
      { rule: "9.5 f", text: msg("reserve.pref.vpHex"), test: (h) => board.hex(h).vp !== null },
      { rule: "9.5 g", text: msg("reserve.pref.closestArmy"), score: closest(army) },
      { rule: "9.5 h", text: msg("reserve.pref.closestFront"), score: closest(frontUnits) },
      { rule: "9.5", text: msg("reserve.pref.lowestHex"), score: (h) => Number(h) }, // Q40
    ], steps)[0];
  }

  // ---- Step 5 [GT 2+]: active units removed to the reserve box (9.6).

  const nearlySurroundedCache = new WeakMap<GameState, Map<string, boolean>>();
  function nearlySurrounded(state: GameState, id: string): boolean {
    let byUnit = nearlySurroundedCache.get(state);
    if (!byUnit) nearlySurroundedCache.set(state, (byUnit = new Map()));
    let v = byUnit.get(id);
    if (v === undefined) byUnit.set(id, (v = movement.isNearlySurrounded(state, id)));
    return v;
  }

  /** Why the active unit is not removed (9.6), or the situation that removes it. */
  function removal(state: GameState, act: SovietActivation, id: string): { removed: boolean; reason: Message } {
    const no = (reason: Message) => ({ removed: false, reason });
    const hex = state.units[id].at;
    if (act.moved.includes(id)) return no(msg("removal.moved"));
    if (act.attacked.includes(id)) return no(msg("removal.attacked"));
    if (act.fromReserve.includes(id)) return no(msg("removal.fromReserve"));
    if (!adjacentHexesWith(state, hex, "german").length) return no(msg("removal.notAdjacent"));
    if (hex === KHARKOV) return no(msg("removal.kharkov"));
    if (!rules.canTraceSupply(state, id)) return no(msg("removal.noSupply"));
    const situation = removalSituation(state, act, id);
    if (!situation) return no(msg("removal.noSituation"));
    const after = without(state, id);
    const within = !rules.beyondOperationalLimit(state, act.front, hex);
    if (within) {
      const freed = onMapOf(state, "german").find((g) => board.hexCount(state.units[g].at, hex) <= 2
        && movement.isSurrounded(state, g) && !movement.isSurrounded(after, g));
      if (freed) return no(msg("removal.unsurrounds", { unit: known(freed).designation }));
    }
    for (const u of onMapOf(state, "soviet")) {
      if (u === id) continue;
      if (rules.canTraceSupply(state, u) && !rules.canTraceSupply(after, u)) return no(msg("removal.cutsSupply", { unit: known(u).designation }));
      if (!nearlySurrounded(state, u) && !movement.isSurrounded(state, u) && nearlySurrounded(after, u))
        return no(msg("removal.exposes", { unit: known(u).designation }));
    }
    return { removed: true, reason: situation };
  }

  /** The four situations of 9.6 that remove an eligible unit, or null. */
  function removalSituation(state: GameState, act: SovietActivation, id: string): Message | null {
    const hex = state.units[id].at;
    const inactive = act.front === "voronezh" ? "southwest" : "voronezh";
    const village = [hex, ...board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex)).map((n) => n.hex)]
      .find((h) => board.hex(h).village && board.hex(h).frontTarget === inactive);
    if (village) return msg("removal.why.village", { hex: village });
    const others = unitsIn(state, hex, "soviet").filter((u) => u !== id);
    const adjacent = adjacentHexesWith(state, hex, "soviet").length;
    if (board.hex(hex).vp !== null) {
      const steps = others.reduce((n, u) => n + values(state, u).steps, 0);
      return steps >= 2 ? msg("removal.why.vpStack", { steps }) : null;
    }
    const within = !rules.beyondOperationalLimit(state, act.front, hex);
    if (others.length) return msg(within ? "removal.why.stacked" : "removal.why.stackedBeyond");
    if (adjacent >= (within ? 2 : 1)) return msg(within ? "removal.why.adjacent" : "removal.why.adjacentBeyond", { count: adjacent });
    return null;
  }

  function removals(state: GameState, act: SovietActivation) {
    const events: GameEvent[] = [];
    for (const id of attacks.sorted(state, act.units.filter((u) => onMap(state, u)), "desc")) {
      if (!onMap(state, id)) continue;
      const hex = state.units[id].at;
      const r = removal(state, act, id);
      events.push({ type: "RemovalChecked", unit: id, hex, removed: r.removed, reason: r.reason });
      if (!r.removed) continue;
      const m = move(state, [id], "reserve");
      state = m.state;
      events.push(...m.events);
    }
    return { state, act, events };
  }

  // ---- Step 6 [GT 4+]: an IP on one hex of active units that did not move or attack (9.7).

  function placeIp(state: GameState, act: SovietActivation) {
    const idle = act.units.filter((id) => onMap(state, id) && !act.moved.includes(id) && !act.attacked.includes(id) && !act.fromReserve.includes(id));
    let hexes = [...new Set(idle.map((id) => state.units[id].at))].sort();
    if (!hexes.length) return { state, act, events: [] as GameEvent[] };
    const steps: DecisionStep[] = [];
    hexes = requireHexes(hexes, "9.7", msg("ip.req.support"), (h) => rules.inSovietSupport(state, h), steps);
    hexes = requireHexes(hexes, "9.7", msg("ip.req.townCity"), (h) => !isTownOrCity(h), steps);
    hexes = requireHexes(hexes, "9.7", msg("ip.req.already"), (h) => !hasIp(state, h), steps);
    hexes = requireHexes(hexes, "9.7", msg("ip.req.unfit"),
      (h) => unitsIn(state, h).some((u) => !state.units[u].dispersed && supplied(state, u)), steps);
    if (!hexes.length) return { state, act, events: [] as GameEvent[] };
    const germans = onMapOf(state, "german").filter((g) => supplied(state, g));
    const strength = (h: string) => unitsIn(state, h, "soviet").reduce((n, u) => n + values(state, u).combat, 0);
    const [hex] = narrowHexes(hexes, [
      { rule: "9.7 a", text: msg("ip.pref.adjacentGerman"), test: (h) => adjacentHexesWith(state, h, "german").some((g) => unitsIn(state, g, "german").some((x) => supplied(state, x))) },
      { rule: "9.7 b", text: msg("ip.pref.proximateGerman"), test: (h) => {
        const soviet = unitsIn(state, h, "soviet")[0];
        return germans.some((g) => board.hexCount(state.units[g].at, h) <= 2 * values(state, g).movement + 3 && movement.proximateToUnit(state, g, soviet));
      } },
      { rule: "9.7 c", text: msg("ip.pref.leastStrength"), score: strength },
      { rule: "9.7 d", text: msg("ip.pref.lowestHex"), score: (h) => Number(h) },
    ], steps);
    const r = setImprovedPosition(state, hex, true);
    return {
      state: r.state, act,
      events: r.events.map((e): GameEvent => (e.type === "ImprovedPositionSet" ? { ...e, rule: "9.7", steps } : e)),
    };
  }

  return { start, resume };
}
