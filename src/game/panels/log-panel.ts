// Log tab of the rail (D): the events of each step, newest first, in the player's words.
import type { Engine } from "../../engine/engine";
import { adjustmentName, armyName, frontName, sideName } from "../../engine/names";
import { isHex, type GameEvent, type Location } from "../../engine/types";
import { msg, t, type Param } from "../../i18n/i18n";
import { dynamicKey } from "../../i18n/message";
import type { Decision } from "../playback/activation";
import type { GameSession } from "../state/session";
import { cardImage } from "./card-zoom";
import { objectiveChange, objectiveName } from "./objective-text";

const where = (at: Location): Param => (isHex(at) ? at : msg(`log.where.${at as "reserve" | "reinforcements" | "eliminated" | "outOfPlay"}`));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A card named in the log: its number, with the scan held up on hover (card-zoom). */
const card = (id: string) => `<span class="log-card" data-card="${id}" tabindex="0"><img src="${cardImage(id)}" alt="">${id.toUpperCase()}</span>`;

const MOVED = { eliminated: "eliminated", outOfPlay: "outOfPlay", reserve: "reserve", reinforcements: "reinforcements" } as const;

/** One log line for the event, or null when it adds nothing to the lines around it. */
function describe(e: GameEvent, engine: Engine): { html: string; refused?: boolean } | null {
  const name = (id: string) => engine.unit(id)?.designation ?? id;
  const line = (html: string) => ({ html });
  switch (e.type) {
    case "SetUpApplied":
      return line(t("log.setUp", { placed: e.placed.length, reserve: e.reserve.length, reinforcements: e.reinforcements.length }));
    case "SetUpCleared":
      return line(t("log.setUpCleared"));
    case "UnitsMoved": {
      const who = e.units.length > 1 ? msg("log.moved.many", { count: e.units.length, units: e.units.map(name) }) : msg("log.moved.one", { unit: name(e.units[0]) });
      const from = [...new Set(e.from)];
      const kind = isHex(e.to) ? "hex" : MOVED[e.to as keyof typeof MOVED];
      // Placed with Alt, without the movement rules (Q59).
      if (e.free && isHex(e.to))
        return line(from.length === 1 ? t("log.moved.hexFromFree", { who, to: e.to, from: where(from[0]) }) : t("log.moved.hexFree", { who, to: e.to }));
      return line(from.length === 1
        ? t(`log.moved.${kind}From`, { who, to: e.to, from: where(from[0]) })
        : t(`log.moved.${kind}`, { who, to: e.to }));
    }
    case "UnitRestacked":
      return line(t(`log.restacked.${e.to}`, { unit: name(e.unit), hex: e.at }));
    case "StepRemoved":
      return line(t(e.to === "reduced" ? "log.stepRemovedR" : "log.stepRemoved", { unit: name(e.unit) }));
    case "DispersedSet":
      return line(t(e.dispersed ? "log.dispersed" : "log.undispersed", { units: e.units.map(name) }));
    case "VictoryPointsSet":
      return line(t("log.vp", { from: e.from, to: e.to }));
    case "SovietCardDiscarded":
      return line(t(e.discarded ? "log.cardDiscarded" : "log.cardUndiscarded", { card: card(e.card) }));
    case "SovietCardsDrawn":
      return line(e.auxiliary
        ? t("log.drawn.pair", { command: card(e.command), auxiliary: card(e.auxiliary), why: esc(t(e.why)), count: e.left })
        : t("log.drawn.single", { command: card(e.command), why: esc(t(e.why)), count: e.left }));
    case "SovietCommandCard":
      return e.second ? line(t("log.secondImpulse", { card: card(e.card) })) : null;
    case "SovietCommandChecked": {
      const text = engine.sovietCards?.card(e.card)?.commands[e.index]?.text;
      const what = { card: card(e.card), line: esc(text ?? t("log.line", { n: e.index + 1 })) };
      return e.played
        ? line(t("log.linePlayed", { ...what, what: esc(e.reason ? t(e.reason) : t("log.lineDone")) }))
        : line(t("log.linePassed", { ...what, reason: esc(e.reason ? t(e.reason) : "") }));
    }
    case "SovietCardReturned":
      return line(t("log.cardReturned", { card: card(e.card), count: e.left }));
    case "SovietCardRemoved":
      return line(t("log.cardRemoved", { card: card(e.card) }));
    case "ReminderAdded":
      return line(t("log.reminder", { title: esc(t(e.reminder.title)), text: esc(t(e.reminder.text)) }));
    case "ReminderDismissed":
      return line(t("log.reminderDone"));
    case "TurnStarted":
      return line(t("log.turn.begins", { turn: e.turn })
        + (e.toReserve.length ? t("log.turn.toReserve", { count: e.toReserve.length, units: e.toReserve.map(name) }) : "")
        + (e.cardsAdded.length ? t("log.turn.pileNew", { count: e.pile, cards: e.cardsAdded.map(card) }) : t("log.turn.pile", { count: e.pile })));
    case "ObjectivePlaced":
      return line(e.at
        ? t("log.objectivePlaced", { marker: objectiveName(e.front, e.face), hex: e.at })
        : t("log.objectiveRemoved", { marker: objectiveName(e.front) }));
    case "ObjectiveChanged":
      return line(t("log.objectiveChanged", { marker: objectiveName(e.marker, e.face), change: objectiveChange(e), why: esc(t(e.why)), rule: e.rule }));
    case "SetUpAdjustmentApplied": {
      const params = {
        die: e.id.replace("-", ","), name: adjustmentName(e.id), count: e.commands,
        how: e.roll ? msg("log.adjustmentRoll", { roll: e.roll }) : msg("log.adjustmentChosen"),
      };
      return line(e.replaces ? t("log.adjustmentReplaces", { ...params, replaced: adjustmentName(e.replaces) }) : t("log.adjustment", params));
    }
    case "GameStarted":
      return line(t("log.gameStarted"));
    case "SupplyPhaseDone": {
      const changes = e.changes.map((c) => msg("log.supply.change", { unit: name(c.unit), marker: msg(`log.supply.marker.${c.to}`) }));
      const german = e.germanSurrender.map((g) => msg("log.supply.stack", { hex: g.hex, units: g.units.map(name) }));
      return line((changes.length ? t("log.supply.phase", { turn: e.turn, changes }) : t("log.supply.phaseNone", { turn: e.turn }))
        + (german.length ? t("log.supply.surrender", { stacks: { list: german, separator: "semicolon" } }) : "")
        + (e.supportLine ? t(e.supportLine === "west" ? "log.supply.lineWest" : "log.supply.lineEast") : ""));
    }
    case "SupplyStatusSet":
      return line(t(`log.supply.set.${e.status}`, { units: e.units.map(name) }));
    case "ForwardSupportSet":
      return line(e.hexes.length ? t("log.forwardSupport", { hexes: e.hexes }) : t("log.forwardSupportRemoved"));
    case "TownCaptured":
      return line(t("log.townCaptured", { hex: e.hex, side: sideName(e.owner) }));
    case "FormationActivated":
      return line(t(e.desperation ? "log.activatedDesperate" : "log.activated", { army: armyName(e.army), front: frontName(e.front), methods: e.methods }));
    case "DecisionTraced": {
      if (e.outcome === "noMove") return line(t("log.decision.noMove", { unit: name(e.unit) }));
      const by = { unit: name(e.unit), from: e.from, to: e.to, method: e.method ?? "", title: e.title ?? "" };
      return line(t(e.outcome === "frozen" ? "log.decision.stays" : "log.decision.moved", by));
    }
    case "CommandRejected":
      return { html: t("log.rejected", { reason: e.reason }), refused: true };
    // Soviet attacks (4.4) and the combat sheet (4.5a, D18).
    case "AttackChecked":
      return line(esc(t("log.attack.checked", { unit: name(e.lead), hex: e.target, soviet: e.situational[0], german: e.situational[1], reason: e.reason })));
    case "AttackLeadRefused":
      return null;
    case "ReservePlaced":
      return e.hex ? line(esc(t("log.reserve.placed", { unit: name(e.unit), hex: e.hex, rule: e.rule })))
        : line(esc(t("log.reserve.notPlaced", { unit: name(e.unit), reason: e.reason ?? "" })));
    case "SovietAttackDeclared":
      return line(esc(t("log.attack.declared", { hex: e.target, attackers: e.attackers.map(name), defenders: e.defenders.map(name), soviet: e.soviet, german: e.german })));
    case "RemovalChecked":
      return e.removed ? line(esc(t("log.removal", { unit: name(e.unit), hex: e.hex, reason: e.reason }))) : null;
    case "ImprovedPositionSet":
      return line(esc(e.placed ? (e.rule ? t("log.ip.placedRule", { hex: e.hex, rule: e.rule }) : t("log.ip.placed", { hex: e.hex }))
        : e.reason ? t("log.ip.removedWhy", { hex: e.hex, reason: e.reason }) : t("log.ip.removed", { hex: e.hex })));
    case "ActivationEnded":
      return line(esc(t("log.attack.activationEnded", { army: armyName(e.army) })));
    case "CombatStarted":
    case "CombatCleanedUp":
      return null;
    case "GermanAttackDeclared":
      return line(esc(t("log.attack.germanDeclared", { hex: e.target, attackers: e.attackers.map(name), defenders: e.defenders.map(name), german: e.german, soviet: e.soviet })));
    case "AttackCancelled":
      return line(esc(t("log.attack.cancelled", { hex: e.target })));
    case "SovietTacticsApplied": {
      const used = e.tactics.filter((x) => x.applies).map((x) => x.card ? `${x.name} (${x.card.toUpperCase()})` : x.name);
      // Step 3 of a German attack: the card drawn for the Soviet defense (12.3).
      if (e.defense) {
        if (!e.card) return line(esc(t(e.noCard ?? msg("combat.noCard.noCards"))));
        return line(used.length ? t("log.defense.tactics", { hex: e.target, tactics: used }) : t("log.defense.noEffect", { hex: e.target, card: card(e.card.id) }));
      }
      return line(used.length ? t("log.attack.tactics", { hex: e.target, tactics: used })
        : esc(t("log.attack.noTactics", { hex: e.target, why: e.noCard ?? "" })));
    }
    case "ActivationNamed": {
      const a = e.activation, corps = a.corps ? msg(dynamicKey(`names.corps.${a.corps}`)) : null;
      if (!("hex" in a)) return line(esc(t("log.activation.corps", { corps: corps! })));
      return line(esc(corps ? t("log.activation.kampfgruppeCorps", { corps, hex: a.hex, range: a.range })
        : t("log.activation.kampfgruppe", { hex: a.hex, range: a.range })));
    }
    case "SovietHitTaken": {
      const h = e.hit, base = { n: h.n, hex: e.target };
      if (h.priority === "12.75") return line(t("log.defense.hit.second", base));
      // The step itself follows (StepRemoved, or the unit eliminated).
      if (h.priority === "A") return line(t("log.defense.hit.step", base));
      if (h.priority === "B") return line(t("log.defense.hit.retreat", base));
      const hold = { ...base, chance: h.hold?.chance ?? 0, roll: h.hold?.roll ?? 0 };
      return line(t(h.result === "step" ? "log.defense.hit.holds" : "log.defense.hit.gives", hold));
    }
    case "GermanAdvanced":
      return line(esc(t("log.attack.germanAdvanced", { units: e.units.map(name), from: e.from, to: e.to })));
    case "ReinforcementMoved":
      return line(esc(t(e.defense ? "log.defense.reinforce" : "log.attack.reinforce", { unit: name(e.unit), hex: e.hex })));
    case "CombatTargetChosen":
      return line(t("log.attack.target", { hex: e.hex }));
    case "GermanTacticsPlayed": {
      const tactics = e.tactics.map((x) => msg(dynamicKey(`names.tactic.${x}`)));
      if (e.joined?.length) return line(esc(t("log.attack.germanJoined", { tactics, units: e.joined.map(name) })));
      return line(e.tactics.length ? esc(t("log.attack.german", { tactics })) : t("log.attack.germanNone"));
    }
    case "StepRestored":
      return line(esc(t("log.attack.restored", { unit: name(e.unit) })));
    case "CombatChitsDrawn":
      return line(t("log.attack.chits", { count: e.chits }));
    case "CombatHitsEntered":
      return line(t("log.attack.hits", { german: e.hits.german, soviet: e.hits.soviet, chitsGerman: e.chitHits.german, chitsSoviet: e.chitHits.soviet }));
    case "GermanLossesChosen":
      return line(e.disperse ? t("log.attack.lossesDispersed", { count: e.steps }) : t("log.attack.losses", { steps: e.steps, hexes: e.retreat }));
    case "RetreatEntered":
      return line(esc(t(e.costsStep ? "log.attack.retreatStep" : "log.attack.retreat", { units: e.units.map(name), from: e.from, to: e.to, priority: e.priority })));
    case "GermanHitsApplied":
      return line(t(e.attack ? "log.attack.appliedGerman" : "log.attack.applied"));
    case "SovietLossesApplied": {
      const r = e.report, hit = [...(r.first ? [r.first.unit] : []), ...r.removed];
      return line(esc(hit.length || r.dispersed.length ? t("log.attack.sovietLosses", { hex: e.target, units: [...hit, ...r.dispersed.map((d) => msg("log.dispersedUnit", { unit: name(d) }))].map((u) => (typeof u === "string" ? name(u) : u)) })
        : t("log.attack.sovietNoLoss", { hex: e.target })));
    }
    case "AdvanceChecked": {
      const c = e.check;
      if (!c.hex || (c.reason && c.chance == null)) return line(esc(t("log.attack.noAdvance", { unit: name(c.unit), why: c.reason ?? msg("advance.no.secondHex") })));
      if (c.chance === "advance") return line(esc(t("log.attack.advanced", { unit: name(c.unit), hex: c.hex, route: c.route! })));
      if (typeof c.chance === "number" && c.roll !== undefined)
        return line(esc(t(c.advanced ? "log.attack.advancedRoll" : "log.attack.stays", { unit: name(c.unit), hex: c.hex, route: c.route!, roll: c.roll, need: c.chance })));
      return line(esc(t("log.attack.full", { unit: name(c.unit), hex: c.hex, route: c.route ?? "", count: c.occupants ?? 2 })));
    }
    case "CombatEnded":
      return line(t("log.attack.ended", { hex: e.target }));
  }
}

/**
 * An undo removes the lines of the step it takes back; refused commands stay (they changed nothing).
 * A click on a bot decision line shows its "Why this move" slip.
 */
export function mountLogPanel(root: HTMLElement, session: GameSession, onDecision: (d: Decision, line: HTMLLIElement) => void, intro?: string) {
  const decisions = new WeakMap<HTMLLIElement, Decision>();
  root.addEventListener("click", (e) => {
    const li = (e.target as Element).closest("li");
    const d = li && decisions.get(li);
    if (d) onDecision(d, li);
  });
  root.addEventListener("keydown", (e) => {
    const li = (e.target as Element).closest("li");
    const d = li && decisions.get(li);
    if (d && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDecision(d, li); }
  });
  const add = (html: string, cls = "") => {
    const li = document.createElement("li");
    li.innerHTML = html;
    li.className = cls;
    root.prepend(li);
    return li;
  };
  /** Lines of each step that changed the state, in the order of the undo history. */
  const steps: HTMLLIElement[][] = [];
  add(intro ?? t("log.newGame"));
  session.subscribe((_, events, undo) => {
    if (undo) { steps.pop()?.forEach((li) => li.remove()); return; }
    const lines: HTMLLIElement[] = [];
    // A set-up adjustment is one step: its own actions are listed under it, in play order.
    // So is a Soviet impulse, and the start of a turn.
    const grouped = ["SetUpAdjustmentApplied", "SovietCardsDrawn", "TurnStarted", "GermanHitsApplied", "CombatEnded", "CombatHitsEntered"].includes(events[0]?.type);
    let anchor: HTMLLIElement | null = null;
    for (const [i, e] of events.entries()) {
      const line = describe(e, session.engine);
      if (!line) continue;
      const cls = (line.refused ? "fresh refused" : "fresh") + (grouped && i > 0 ? " sub" : "");
      let li: HTMLLIElement;
      if (grouped && anchor) {
        li = document.createElement("li");
        li.innerHTML = line.html;
        li.className = cls;
        anchor.after(li);
      } else li = add(line.html, cls);
      if (grouped) anchor = li;
      if (e.type === "DecisionTraced") {
        decisions.set(li, e);
        li.classList.add("decision");
        li.tabIndex = 0;
        li.title = t("log.showWhy");
      }
      if (!line.refused) lines.push(li);
    }
    if (lines.length) steps.push(lines);
  });
}
