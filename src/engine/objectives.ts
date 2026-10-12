// Soviet Front and Army Objectives (9.1, task 4.2).
// - Step 1 of a Soviet activation (9.0) [GT 1-7]: the front's objective marker is relocated by
//   a die roll on the placement tables when a unit of the front reaches it (9.11); the Army
//   Objective marker is placed on the first activation of the 40th or 1st Guards Army (9.13).
// - An Army Objective marker moves on as soon as a Soviet unit enters its hex, and leaves play
//   when one enters the last hex on its back (9.13).
// - A front's third objective leaves play at the end of the activation in which a Soviet unit
//   enters it, or [GT 7] in the Supply Phase (9.12, Q35: third objective only), and every
//   marker at the end of Game-turn 7. The army marker leaves with its front's marker (9.13).
// "Enters" includes the hexes a unit crosses (Q32). Every check and change is traced
// (ObjectiveChanged), the checks that leave a marker in place included.
import type { Unit } from "../core/units";
import { dynamicKey, msg, semicolonList, type Message, type Param } from "../i18n/message";
import { armyName, frontName } from "./names";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { rollDie } from "./random";
import {
  isHex, OBJECTIVE_ARMIES, OBJECTIVE_FRONTS, type GameEvent, type GameState, type ObjectiveArmy, type ObjectiveFace,
  type ObjectiveFront, type ObjectiveMarker,
} from "./types";

/** Objective hexes named by the booklet's tables and markers (names in en.json, names.place). */
const NAMED = new Set(["0215", "0311", "0608", "0912", "1009", "1116", "1210", "1421", "1615", "1910", "2102", "2120", "2404", "2412", "2518", "2615", "3116"]);
/** "Kharkov (0912)", or the bare hex number. */
export const hexName = (hex: string): Param => (NAMED.has(hex) ? msg("names.hex", { name: msg(dynamicKey(`names.place.${hex}`)), hex }) : hex);

/** 9.11 Objective Placement Tables, by the marker's hex: the results of a roll of 1-6, 7-9, 10. */
const FIRST_TO_SECOND: Record<string, [string, string, string]> = {
  "1009": ["1116 W", "1615 W", "0912 W"], // Chuguev: Valki, Krasnograd, Kharkov
  "0608": ["0912 W", "0614 S", "1116 W"], // Volchansk: Kharkov, 0614, Valki
  "1210": ["1116 W", "1615 W", "0912 S"], // Zmiyev: Valki, Krasnograd, Kharkov
  "1608": ["2015 S", "2412 W", "2809 W"], // 1608: 2015, Pavlograd, 2809
  "1906": ["2412 W", "2404 W", "2809 W"], // 1906: Pavlograd, Krasnoarmiysk, 2809
  "1410": ["2214 S", "1910 W", "2015 S"], // 1410: 2214, Lozovaya, 2015
};
const SECOND_TO_THIRD: Record<string, [string, string, string]> = {
  "1116": ["1421 W", "1221 S", "1621 W"], // Valki: Poltava, 1221, 1621
  "0912": ["1421 W", "0821 S", "1221 S"], // Kharkov: Poltava, 0821, 1221
  "0614": ["1221 S", "1421 W", "0821 S"], // 0614: 1221, Poltava, 0821
  "1615": ["1421 W", "1621 W", "1421 W"], // Krasnograd: Poltava, 1621, Poltava
  "2015": ["2518 W", "2120 S", "2615 W"], // 2015: Dnepropetrovsk, Pryadovka, Sinelnikowo
  "2412": ["3116 W", "2518 W", "2518 W"], // Pavlograd: Zaporozhe, Dnepropetrovsk, Dnepropetrovsk
  "2214": ["3116 W", "2518 W", "2120 S"], // 2214: Zaporozhe, Dnepropetrovsk, Pryadovka
  "2809": ["2615 W", "3116 W", "3314 W"], // 2809: Sinelnikowo, Zaporozhe, 3314
  "2404": ["3116 W", "2615 W", "3314 W"], // Krasnoarmiysk: Zaporozhe, Sinelnikowo, 3314
  "1910": ["2518 W", "2120 S", "2615 W"], // Lozovaya: Dnepropetrovsk, Pryadovka, Sinelnikowo
};

/**
 * Which of its three objectives (9.12) a front marker in the hex is: a row of the first table,
 * of the second, or neither (a third objective, where the tables are no longer used).
 */
export const objectiveStage = (hex: string): 1 | 2 | 3 => (FIRST_TO_SECOND[hex] ? 1 : SECOND_TO_THIRD[hex] ? 2 : 3);

/** 9.11: where the die roll (1-10) sends a front marker from the hex; null for a third objective. */
export function relocation(hex: string, roll: number): ObjectiveMarker | null {
  const row = FIRST_TO_SECOND[hex] ?? SECOND_TO_THIRD[hex];
  if (!row) return null;
  const [at, face] = row[roll <= 6 ? 0 : roll <= 9 ? 1 : 2].split(" ");
  return { at, face: face === "W" ? "west" : "south" };
}

/** 9.13: the hexes on the back of each Army Objective marker, in order. */
export const ARMY_OBJECTIVE_HEXES: Record<ObjectiveArmy, string[]> = { "40": ["0311", "1012", "0215"], "1G": ["2102", "2701"] };
export const ARMY_OBJECTIVE_FRONT: Record<ObjectiveArmy, ObjectiveFront> = { "40": "voronezh", "1G": "southwest" };
/** Army Objective markers are printed West only. */
export const ARMY_OBJECTIVE_FACE: ObjectiveFace = "west";

export const isObjectiveArmy = (army: string): army is ObjectiveArmy => (OBJECTIVE_ARMIES as string[]).includes(army);

/**
 * 9.13: hex of the army's Army Objective marker, or null when it is not in play: never placed,
 * removed, or its front's objective marker removed (which removes it too).
 */
export function armyObjective(state: GameState, army: string): string | null {
  if (!isObjectiveArmy(army) || !state.objectives[ARMY_OBJECTIVE_FRONT[army]]) return null;
  return state.armyObjectives?.[army] ?? null;
}

export interface ObjectivesData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
}

type Result = { state: GameState; events: GameEvent[] };

export type Objectives = ReturnType<typeof createObjectives>;

export function createObjectives({ board, movement, unit, rules }: ObjectivesData) {
  const name = (id: string) => unit(id)?.designation ?? id;
  const soviet = (id: string) => unit(id)?.side === "soviet";
  const unitsIn = (state: GameState, hex: string) => Object.keys(state.units).filter((id) => state.units[id].at === hex);

  /** 9.13: the front's marker leaves play, and the Army Objective marker of its army with it. */
  function removeFront(state: GameState, front: ObjectiveFront, rule: string, why: Message): Result {
    const marker = state.objectives[front];
    if (!marker) return { state, events: [] };
    const objectives = { ...state.objectives };
    delete objectives[front];
    let next: GameState = { ...state, objectives };
    const events: GameEvent[] = [{ type: "ObjectiveChanged", marker: front, from: marker.at, to: null, rule, why }];
    for (const army of OBJECTIVE_ARMIES) {
      const at = state.armyObjectives?.[army];
      if (ARMY_OBJECTIVE_FRONT[army] !== front || !at) continue;
      next = { ...next, armyObjectives: { ...next.armyObjectives, [army]: null } };
      events.push({ type: "ObjectiveChanged", marker: army, from: at, to: null, rule: "9.13", why: msg("objective.why.frontLeft", { front: frontName(front) }) });
    }
    return { state: next, events };
  }

  /**
   * 9.11: units of the front that reach the marker, with how: in its hex; adjacent to it when
   * German units hold it; proximate (9.3) to it when no unit occupies it.
   */
  function reachedBy(state: GameState, front: ObjectiveFront, hex: string): Message[] {
    const here = unitsIn(state, hex);
    const german = here.some((id) => unit(id)?.side === "german");
    const ground = rules.ground(state);
    const out: Message[] = [];
    for (const [id, s] of Object.entries(state.units)) {
      const u = unit(id);
      if (!u || u.side !== "soviet" || u.front !== front || !isHex(s.at)) continue;
      if (s.at === hex) out.push(msg("objective.reach.occupies", { unit: u.designation }));
      else if (german && board.areAdjacent(s.at, hex)) out.push(msg("objective.reach.adjacent", { unit: u.designation, hex: s.at }));
      else if (!here.length && board.hexCount(s.at, hex) <= Math.max(movement.faceValues(state, id).movement, 1) + 1
        && movement.proximateToHex(state, id, hex, ground)) out.push(msg("objective.reach.proximate", { unit: u.designation, hex: s.at }));
    }
    return out;
  }

  /**
   * Step 1 of the activation (9.0) of the formation `army` of the front: [GT 1-7] the front's
   * objective check (9.11), then the Army Objective marker on the army's first activation
   * (9.13). Skipped once the front's marker has left play.
   */
  function check(state: GameState, front: ObjectiveFront, army: string): Result {
    const marker = state.objectives[front];
    if (state.turn > 7 || !marker) return { state, events: [] };
    const events: GameEvent[] = [];
    const stage = objectiveStage(marker.at);
    const stays = (rule: string, why: Message): GameEvent =>
      ({ type: "ObjectiveChanged", marker: front, from: marker.at, to: marker.at, face: marker.face, rule, why });
    if (stage === 3) events.push(stays("9.12", msg("objective.why.third")));
    else {
      const reasons = reachedBy(state, front, marker.at);
      if (!reasons.length) events.push(stays("9.11", msg("objective.why.notReached", { front: frontName(front) })));
      else {
        const die = rollDie(state);
        const to = relocation(marker.at, die.roll)!;
        state = { ...die.state, objectives: { ...die.state.objectives, [front]: to } };
        events.push({
          type: "ObjectiveChanged", marker: front, from: marker.at, to: to.at, face: to.face, roll: die.roll, rule: "9.11",
          why: msg("objective.why.relocated", {
            reasons: semicolonList(reasons), roll: die.roll, table: msg(stage === 1 ? "objective.table.first" : "objective.table.second"),
            hex: hexName(to.at), face: msg(to.face === "west" ? "objective.faceShort.west" : "objective.faceShort.south"),
          }),
        });
      }
    }
    if (isObjectiveArmy(army) && ARMY_OBJECTIVE_FRONT[army] === front && state.armyObjectives?.[army] === undefined) {
      const at = ARMY_OBJECTIVE_HEXES[army][0];
      state = { ...state, armyObjectives: { ...state.armyObjectives, [army]: at } };
      events.push({ type: "ObjectiveChanged", marker: army, from: null, to: at, face: ARMY_OBJECTIVE_FACE, rule: "9.13", why: msg("objective.why.armyFirst", { army: armyName(army) }) });
    }
    return { state, events };
  }

  /**
   * 9.13: Soviet units entered these hexes, in order (a move's path, start excluded): an Army
   * Objective marker in one of them moves to the next hex on its back; the last hex on its back
   * removes it, even if the others were not entered.
   */
  function entered(state: GameState, ids: string[], hexes: string[]): Result {
    const movers = ids.filter(soviet);
    const events: GameEvent[] = [];
    if (!movers.length) return { state, events };
    const who = movers.map(name);
    for (const army of OBJECTIVE_ARMIES) {
      let at = armyObjective(state, army);
      if (!at) continue;
      const route = ARMY_OBJECTIVE_HEXES[army], last = route[route.length - 1];
      for (const hex of hexes) {
        if (hex === last) {
          state = { ...state, armyObjectives: { ...state.armyObjectives, [army]: null } };
          events.push({ type: "ObjectiveChanged", marker: army, from: at, to: null, rule: "9.13", why: msg("objective.why.enteredLast", { units: who, hex: hexName(last) }) });
          break;
        }
        if (hex !== at) continue;
        const next: string = route[route.indexOf(at) + 1];
        state = { ...state, armyObjectives: { ...state.armyObjectives, [army]: next } };
        events.push({ type: "ObjectiveChanged", marker: army, from: at, to: next, face: ARMY_OBJECTIVE_FACE, rule: "9.13", why: msg("objective.why.entered", { units: who, hex: hexName(at) }) });
        at = next;
      }
    }
    return { state, events };
  }

  /**
   * 9.12: at the end of a Soviet activation, the third objective of a front leaves play if a
   * Soviet unit entered it during the activation. TODO 4.4: once attacks and advances are part
   * of the activation, call this after its last step.
   */
  function endActivation(state: GameState, enteredHexes: Set<string>): Result {
    const events: GameEvent[] = [];
    for (const front of OBJECTIVE_FRONTS) {
      const m = state.objectives[front];
      if (!m || objectiveStage(m.at) !== 3 || !enteredHexes.has(m.at)) continue;
      const r = removeFront(state, front, "9.12", msg("objective.why.thirdEntered", { hex: hexName(m.at) }));
      state = r.state;
      events.push(...r.events);
    }
    return { state, events };
  }

  /**
   * Supply Phase step 5 [GT 7] (9.12, Q35): a front's third objective leaves play unless a Soviet
   * unit of either front, in its hex or adjacent to it, can trace reserve supply (13.3). A first
   * or second objective stays until the end of the turn.
   */
  function supplyPhase(state: GameState): Result {
    const events: GameEvent[] = [];
    if (state.turn !== 7) return { state, events };
    for (const front of OBJECTIVE_FRONTS) {
      const m = state.objectives[front];
      if (!m) continue;
      const stays = (why: Message): GameEvent => ({ type: "ObjectiveChanged", marker: front, from: m.at, to: m.at, face: m.face, rule: "9.12", why });
      if (objectiveStage(m.at) !== 3) {
        events.push(stays(msg("objective.why.notThird")));
        continue;
      }
      const near = Object.keys(state.units).find((id) => {
        const at = state.units[id].at;
        return soviet(id) && isHex(at) && (at === m.at || board.areAdjacent(at, m.at)) && rules.reserveSupplyTracesTo(state, at);
      });
      if (near) {
        events.push(stays(msg("objective.why.reserveSupply", { unit: name(near), hex: state.units[near].at })));
        continue;
      }
      const r = removeFront(state, front, "9.12", msg("objective.why.gt7NoReserve"));
      state = r.state;
      events.push(...r.events);
    }
    return { state, events };
  }

  /** End of Game-turn 7 (4.0 V, 9.12): every objective marker leaves play. */
  function endOfTurn7(state: GameState): Result {
    const events: GameEvent[] = [];
    for (const front of OBJECTIVE_FRONTS) {
      const r = removeFront(state, front, "9.12", msg("objective.why.endGt7"));
      state = r.state;
      events.push(...r.events);
    }
    return { state, events };
  }

  return { check, entered, endActivation, supplyPhase, endOfTurn7 };
}
