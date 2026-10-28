// Combat tab of the rail (D18, task 4.5a): the combat sheet of the combat in progress, its
// steps 1-9 of 12.0 numbered (done: one line, a click shows the detail; in progress: open,
// with its button; to come: greyed), in the attacker's color. A German attack (tasks 5.1, 4.5b)
// follows the German combat sequence: your tactics, the Soviet card (and, when its Reinforce
// Battle needs it, what your card activated, Q62), the chits declared, the hits, the Soviet
// hits (12.53), your losses, your advance; "Cancel attack" until the hits are entered. Everything
// it shows comes from the game state and the engine (engine.combat.view): the page computes
// nothing (D12). Each button sends one command, so Undo (the sheet's own button, or Ctrl+Z)
// takes back one step.
import { GERMAN_ATTACK_TACTICS, GERMAN_DEFENSE_TACTICS, type GermanAttackTactic, type GermanDefenseTactic } from "../../engine/combat";
import { armyName } from "../../engine/names";
import { hexName } from "../../engine/objectives";
import type { AdvanceCheck, Combat, CombatTactic, DecisionStep, GameState, HitAdjustment, SovietHit } from "../../engine/types";
import { msg, t, type Message, type MessageKey } from "../../i18n/i18n";
import { dynamicKey } from "../../i18n/message";
import { faceImage } from "../data/game-data";
import type { CombatPlane } from "../map/combat-plane";
import type { GameSession } from "../state/session";
import { cardImage } from "./card-zoom";
import { staticUrl } from "../../ui/static-url";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const tx = (m: Message) => esc(t(m));

type StepId = "reserves" | "tactics" | "yourTactics" | "chits" | "hits" | "yourLosses" | "sovietLosses" | "advance" | "cleanUp" | "target" | "sovietLoss"
  | "declare" | "sovietCard" | "yourAdvance";
const STEPS: Record<Combat["kind"], StepId[]> = {
  sovietAttack: ["reserves", "tactics", "yourTactics", "chits", "hits", "yourLosses", "sovietLosses", "advance", "cleanUp"],
  nkvdOperations: ["target", "yourLosses", "sovietLoss", "advance"],
  germanAttack: ["declare", "yourTactics", "sovietCard", "chits", "hits", "sovietLosses", "yourLosses", "yourAdvance", "cleanUp"],
};
/** The step the sheet waits on, by stage (index in STEPS). */
const CURRENT: Record<Combat["kind"], Record<Combat["stage"], number>> = {
  sovietAttack: { target: 2, tactics: 2, activation: 2, chits: 3, hits: 4, losses: 5, advance: 7, done: 8 },
  nkvdOperations: { target: 0, tactics: 1, activation: 1, chits: 1, hits: 1, losses: 1, advance: 3, done: 3 },
  germanAttack: { target: 1, tactics: 1, activation: 2, chits: 3, hits: 4, losses: 6, advance: 7, done: 8 },
};

/** The German corps (6.0) and their activation markers (assets/counters/others/), for Q62. */
const CORPS = [["III", "ger3rdpzcorpsactivated"], ["XL", "ger40thactivated"], ["XLVIII", "ger48thactivated"], ["LVII", "ger57thactivated"],
  ["IISS", "ger2ndssactivated"], ["Raus", "gerrausactivated"]] as const;
const marker = (file: string) => staticUrl(`assets/counters/others/marker-${file}.png`);

export interface CombatPanel {
  render(state: GameState): void;
  /** A map click while the sheet asks for the hex of a Kampfgruppe marker (Q62): true if it took it. */
  mapClick(hex: string): boolean;
}

export function mountCombatPanel(root: HTMLElement, session: GameSession, plane: CombatPlane): CombatPanel {
  const engine = session.engine;
  /** What the player is choosing before sending it: reset when the combat moves on. */
  const fresh = (key: string, open: Set<number>) => ({
    key, tactics: new Set<GermanDefenseTactic>(), attackTactics: new Set<GermanAttackTactic>(), replacement: "hit" as string,
    german: 0, soviet: 0, chits: 0, commandValue: null as number | null,
    formation: null as string | null, kgHex: null as string | null, kgRange: 3 as 2 | 3, kgCorps: null as string | null, open,
  });
  let local = fresh("", new Set());
  let reason: Message | null = null;

  const unit = (id: string, state: GameState) => {
    const u = engine.unit(id), s = state.units[id];
    return u ? `<img class="unit" src="${faceImage(u, s?.face ?? "front")}" alt="" title="${esc(u.designation)}">` : "";
  };
  const name = (id: string) => engine.unit(id)?.designation ?? id;
  const names = (ids: string[]) => ids.map(name);
  const hexChips = (kept: string[], dropped: string[]) =>
    `<span class="hexes">${kept.map((h) => `<span class="kept">${h}</span>`).join("")}${dropped.map((h) => `<span class="dropped">${h}</span>`).join("")}</span>`;
  const decisions = (steps: DecisionStep[]) => steps.length
    ? `<ul class="why-steps">${steps.map((s) => `<li><span class="rule">${esc(s.rule)}</span> ${tx(s.text)} ${hexChips(s.kept, s.dropped)}</li>`).join("")}</ul>` : "";
  const sumList = (rows: { text: Message; value: number; bare?: boolean }[], total: number, label: MessageKey) =>
    `<dl class="sum">${rows.map((r) => `<dt>${tx(r.text)}</dt><dd class="${r.value < 0 ? "neg" : ""}">${r.bare || r.value < 0 ? r.value : `+${r.value}`}</dd>`).join("")}` +
    `<dt class="total">${t(label)}</dt><dd class="total">${total}</dd></dl>`;
  const d10 = (roll: number, ok: boolean) => `<span class="d10${ok ? " hold" : ""}" title="${esc(t("combatSheet.die", { roll }))}">${roll}</span>`;

  // ---------------------------------------------------------------- step bodies

  function reserves(c: Combat, state: GameState): string {
    if (!c.reserves.length) return `<p>${t("combatSheet.reserves.none")}</p>`;
    return `<ul class="lines">${c.reserves.map((r) => `<li>${unit(r.unit, state)}<div class="what">${esc(t("combatSheet.reserves.placed", { unit: name(r.unit), hex: r.hex }))}${decisions(r.steps)}</div></li>`).join("")}</ul>`;
  }

  function tactics(c: Combat): string {
    const lines = c.tactics.map((x) => {
      const label = x.source === "barrage" ? t("combatSheet.tactics.barrage") : x.source === "stavka" ? t("combatSheet.tactics.stavka")
        : x.source === "card" ? t(c.card?.fromDiscard ? "combatSheet.tactics.cardFromDiscard" : "combatSheet.tactics.card", { card: x.card!.toUpperCase(), name: x.name })
        : t("combatSheet.tactics.auxiliary", { card: x.card!.toUpperCase(), name: x.name });
      const notes = [
        ...(x.reason ? [t("combatSheet.tactics.noBenefit", { why: x.reason })] : []),
        ...(x.units ? [x.units.length ? t("combatSheet.tactics.joined", { units: names(x.units) }) : t("combatSheet.tactics.noUnit")] : []),
        ...(x.removedIp ? [t("combatSheet.tactics.ipRemoved")] : []),
      ];
      const img = x.card ? `<img class="card" src="${cardImage(x.card)}" alt="${x.card.toUpperCase()}" data-card="${x.card}" tabindex="0">` : "<span></span>";
      return `<li>${img}<div class="what"><b>${esc(label)}</b>${notes.map((n) => `<small>${esc(n)}</small>`).join("")}</div>` +
        `<span class="tag${x.applies ? "" : " no"}">${esc(t("combatSheet.tactics.chits", { count: x.chits }))}</span></li>`;
    });
    const extra = [
      ...(c.noCard ? [`<p class="note">${tx(c.noCard)}</p>`] : []),
      ...(c.card && !c.tactics.some((x) => x.source === "card") ? [`<p class="note">${esc(t("combatSheet.tactics.cardNoTactic", { card: c.card.id.toUpperCase() }))}</p>`] : []),
      ...(c.auxiliary && !c.auxiliary.applied ? [`<p class="note">${esc(t("combatSheet.tactics.auxStays", { card: c.auxiliary.id.toUpperCase(), why: c.auxiliary.reason ?? "" }))}</p>`] : []),
    ];
    return (lines.length ? `<ul class="lines">${lines.join("")}</ul>` : "") + extra.join("");
  }

  function yourTactics(c: Combat, state: GameState, current: boolean): string {
    if (!current) return `<p>${c.germanTactics.length ? esc(c.germanTactics.map((x) => t(`names.tactic.${x as GermanDefenseTactic}`)).join(t("list.comma"))) : t("combatSheet.sum.none")}</p>`;
    const v = engine.combat.view(state)!;
    if (v.tacticsLock) return `<p class="note">${tx(v.tacticsLock)}</p>`;
    const sorted = [...GERMAN_DEFENSE_TACTICS].sort((a, b) => Number(!!v.tactics[a]) - Number(!!v.tactics[b]));
    const items = sorted.map((id) => {
      const lock = v.tactics[id];
      return `<li class="${lock ? "wide" : ""}"><label class="${lock ? "off" : ""}"><input type="checkbox" data-tactic="${id}"${local.tactics.has(id) ? " checked" : ""}${lock ? " disabled" : ""}>` +
        `<span class="box"></span><span class="t-name">${t(`names.tactic.${id}`)}${lock ? `<small>${tx(lock)}</small>` : ""}</span></label></li>`;
    }).join("");
    const replacement = local.tactics.has("german-battlefield-replacements")
      ? `<ul class="choices">${[["hit", t("combatSheet.yourTactics.replacementHit")], ...v.replacementUnits.map((u) => [u, t("combatSheet.yourTactics.replacementUnit", { unit: name(u) })])]
        .map(([value, label]) => `<li><label><input type="radio" name="replacement" value="${value}"${local.replacement === value ? " checked" : ""}><span class="dot"></span><span>${esc(label)}</span></label></li>`).join("")}</ul>` : "";
    const reinforce = local.tactics.has("german-reinforce-battle") || c.reinforcing.length
      ? `<p class="note">${esc(c.reinforcing.length ? t("combatSheet.yourTactics.reinforcing", { units: names(c.reinforcing) }) : t("combatSheet.yourTactics.reinforceHint", { hex: c.target }))}</p>` : "";
    return `<p>${t("combatSheet.yourTactics.hint")}</p><ul class="tactics">${items}</ul>${replacement}${reinforce}`;
  }

  function chits(c: Combat, state: GameState, current: boolean): string {
    const v = engine.combat.view(state)!;
    if (!current) return `<p>${esc(t("combatSheet.sum.chits", { count: v.chits.draw }))}</p>`;
    const holds = v.situations.filter((s) => s.applies), others = v.situations.filter((s) => !s.applies);
    return `<div class="draw"><span class="big">${v.chits.draw}</span><div><b>${t("combatSheet.chits.draw")}</b>` +
      `<small>${esc(t("combatSheet.chits.note", { min: v.chits.min }))}</small></div></div>` +
      sumList(v.chits.rows, v.chits.max, "combatSheet.chits.total") +
      `<h4>${t("combatSheet.chits.keep")}</h4><ul class="situ yes">${holds.map((s) => `<li>${tx(s.text)}</li>`).join("")}</ul>` +
      `<details class="more"><summary>${esc(t("combatSheet.chits.others", { count: others.length }))}</summary>` +
      `<ul class="situ no">${others.map((s) => `<li>${tx(s.text)}</li>`).join("")}</ul></details>`;
  }

  const ledger = (adj: HitAdjustment[], start: number, total: number) =>
    sumList([{ text: msg("combatSheet.hits.chitsKept"), value: start, bare: true }, ...adj.map((a) => ({ text: a.text, value: Number.isFinite(a.value) ? a.value : -start }))],
      total, "combatSheet.hits.total");

  function hits(c: Combat, state: GameState, current: boolean): string {
    if (!current) {
      if (!c.hits) return "";
      return `<div class="ledger"><div><h4>${t("combatSheet.hits.yours")}</h4>${ledger(c.hits.germanAdjustments, c.chitHits?.german ?? 0, c.hits.german)}</div>` +
        `<div><h4>${t("combatSheet.hits.theirs")}</h4>${ledger(c.hits.sovietAdjustments, c.chitHits?.soviet ?? 0, c.hits.soviet)}</div></div>`;
    }
    const ga = c.kind === "germanAttack";
    const p = engine.combat.preview(state, local.german, local.soviet, local.commandValue ?? undefined)!;
    const stepper = (key: "german" | "soviet", label: MessageKey, sub: MessageKey, min: number) =>
      `<div class="hit-row"><div><b>${t(label)}</b><small>${t(sub)}</small></div>` +
      `<div class="stepper" role="group" aria-label="${t(label)}"><button type="button" data-dec="${key}" aria-label="${t("combatSheet.hits.less")}"${local[key] <= min ? " disabled" : ""}>−</button>` +
      `<output aria-live="polite">${local[key]}</output><button type="button" data-inc="${key}" aria-label="${t("combatSheet.hits.more")}">+</button></div></div>`;
    // Soviet Intelligence in defense: the command value printed on the German card (1 or 2: one Soviet hit less).
    const cv = ga && engine.combat.view(state)!.needsCommandValue
      ? `<div class="hit-row cv"><div><b>${t("combatSheet.attack.commandValue")}</b><small>${t("combatSheet.attack.commandValueSub")}</small></div>` +
        `<span class="seg" role="group" aria-label="${t("combatSheet.attack.commandValue")}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-cv="${n}" aria-pressed="${local.commandValue === n}">${n}</button>`).join("")}</span></div>` : "";
    return `<p>${esc(t(ga ? "combatSheet.attack.hitsHint" : "combatSheet.hits.hint"))}</p><div class="hits">` +
      stepper("german", "combatSheet.hits.german", ga ? "combatSheet.attack.germanSub" : "combatSheet.hits.germanSub", -9) +
      stepper("soviet", "combatSheet.hits.soviet", ga ? "combatSheet.attack.sovietSub" : "combatSheet.hits.sovietSub", -9) + cv + `</div>` +
      `<div class="ledger"><div><h4>${t("combatSheet.hits.yours")}</h4>${ledger(p.germanAdjustments, local.german, p.german)}</div>` +
      `<div><h4>${t("combatSheet.hits.theirs")}</h4>${ledger(p.sovietAdjustments, local.soviet, p.soviet)}</div></div>` +
      `<p class="note">${t("combatSheet.hits.floor")}</p>`;
  }

  const lossLabel = (o: { retreat: number; steps: number; eliminated: boolean }) => {
    if (o.eliminated) return t("combatSheet.losses.eliminated");
    if (!o.retreat) return t("combatSheet.losses.steps", { count: o.steps });
    if (!o.steps) return t(o.retreat === 2 ? "combatSheet.losses.retreat2" : "combatSheet.losses.retreat1");
    return t("combatSheet.losses.stepsRetreat", { steps: msg("combatSheet.losses.stepWord", { count: o.steps }), hexes: msg(o.retreat === 2 ? "combatSheet.losses.retreatTwo" : "combatSheet.losses.retreatOne") });
  };

  function yourLosses(c: Combat, state: GameState, current: boolean): string {
    const L = c.losses;
    if (!L || !c.hits) return "";
    const hexesDone = Math.max(0, ...Object.values(L.paths).map((p) => p.length - 1));
    if (!current) {
      return `<p>${esc(L.pullOut ? t("combatSheet.sum.pullOut") : t("combatSheet.sum.losses", { steps: L.lost.length, hexes: hexesDone }))}</p>` +
        Object.entries(L.paths).map(([u, p]) => `<p class="note">${esc(name(u))}: ${p.join(" › ")}</p>`).join("");
    }
    const v = engine.combat.view(state)!;
    // NKVD Operations: two hits, an Improved Position taking the first one (Q58).
    const nkvd = c.kind === "nkvdOperations" && c.hits.germanAdjustments.length
      ? sumList([{ text: msg("combatSheet.losses.nkvdTwo"), value: c.chitHits?.german ?? 2, bare: true }, ...c.hits.germanAdjustments], c.hits.german, "combatSheet.hits.total") : "";
    const head = `<p><b>${esc(t("combatSheet.losses.head", { count: c.hits.german }))}</b></p>${nkvd}`;
    const options = L.pullOut ? `<p>${t("combatSheet.losses.pullOut")}</p>`
      : `<p>${t("combatSheet.losses.choose")}</p><ul class="choices">${v.lossOptions.map((o) =>
        `<li><label><input type="radio" name="loss" value="${o.retreat}"${L.retreat === o.retreat ? " checked" : ""}><span class="dot"></span><span>${esc(lossLabel(o))}</span></label></li>`).join("")}</ul>`;
    const need = L.lost.length + v.owed;
    const tally = L.retreat === null ? "" : `<ul class="tally">` +
      (need ? `<li class="${v.owed ? "" : "ok"}"><span class="mark"></span>${esc(t("combatSheet.losses.tallySteps", { done: L.lost.length, need }))}</li>` : "") +
      (L.retreat ? `<li class="${hexesDone >= L.retreat ? "ok" : ""}"><span class="mark"></span>${esc(t("combatSheet.losses.tallyRetreat", { done: hexesDone, count: L.retreat }))}</li>` : "") +
      `</ul>`;
    return head + options + (L.retreat !== null ? `<p class="note">${t("combatSheet.losses.how")}</p>` : "") + tally;
  }

  function sovietLosses(c: Combat, state: GameState): string {
    const r = c.sovietLosses;
    if (!r) return "";
    if (c.kind === "nkvdOperations") return `<p>${esc(r.first ? t("combatSheet.soviet.nkvd", { unit: name(r.first.unit) }) : t("combatSheet.soviet.nkvdNone"))}</p>`;
    if (!r.hits) return `<p>${t("combatSheet.soviet.none")}</p>` + (r.reduced ? `<p class="note">${esc(t("combatSheet.soviet.reduced", { count: r.reduced }))}</p>` : "");
    const out = [];
    if (r.reduced) out.push(`<p class="note">${esc(t("combatSheet.soviet.reduced", { count: r.reduced }))}</p>`);
    if (r.first) out.push(`<ul class="lines"><li>${unit(r.first.unit, state)}<div class="what">${esc(r.first.tied
      ? t("combatSheet.soviet.firstTied", { unit: name(r.first.unit), units: names(r.first.tied) })
      : t("combatSheet.soviet.first", { unit: name(r.first.unit) }))}</div></li></ul>`);
    if (r.table) {
      const x = r.table;
      const result = x.eliminate ? msg("combatSheet.soviet.eliminate")
        : x.disperse ? (x.removed ? msg("combatSheet.soviet.stepsDispersed", { count: x.removed }) : msg("combatSheet.soviet.dispersed"))
        : msg("combatSheet.soviet.steps", { count: x.removed });
      out.push(`<p>${esc(t("combatSheet.soviet.table", { hits: x.hits, steps: x.steps, result }))}${x.parenthetical ? ` <small>(${t("combatSheet.soviet.parenthetical")})</small>` : ""}</p>`);
    }
    if (r.removed.length) out.push(`<p class="note">${esc(t("combatSheet.soviet.removed", { units: names(r.removed) }))}</p>`);
    if (r.eliminated.length) out.push(`<p class="note">${esc(t("combatSheet.soviet.eliminated", { units: names(r.eliminated) }))}</p>`);
    return out.join("");
  }

  function advanceLine(a: AdvanceCheck, state: GameState): string {
    const head = `<b>${esc(name(a.unit))}</b>${a.leg === 2 ? ` <small>${esc(a.hex ? t("combatSheet.advance.second", { hex: a.hex }) : t("combatSheet.advance.noSecond"))}</small>` : ""}`;
    const route = a.route ? `<small>${esc(t("combatSheet.advance.route", { route: a.route, count: a.occupants ?? 0 }))}</small>` : "";
    let tag: string;
    if (a.reason && a.chance == null) tag = `<span class="tag no">${esc(t("combatSheet.advance.no", { why: a.reason }))}</span>`;
    else if (a.chance === "advance") tag = `<span class="tag">${t("combatSheet.advance.auto")}</span>`;
    else if (typeof a.chance === "number" && a.roll !== undefined) tag = `<span class="tag${a.advanced ? "" : " no"}">${d10(a.roll, a.advanced)} ${t(a.advanced ? "combatSheet.advance.advances" : "combatSheet.advance.stays")}</span>`;
    else tag = `<span class="tag no">${t("combatSheet.advance.stays")}</span>`;
    const needs = typeof a.chance === "number" ? `<small>${esc(t("combatSheet.advance.needs", { need: a.chance }))}</small>` : "";
    return `<li>${unit(a.unit, state)}<div class="what">${head}${route}${needs}</div>${tag}</li>`;
  }

  function advance(c: Combat, state: GameState): string {
    const checks = c.advance ?? [];
    if (!checks.length) return `<p>${esc(t("combatSheet.advance.held", { hex: c.target }))}</p>`;
    return `<p>${esc(t("combatSheet.advance.intro", { hex: c.target }))}</p><ul class="lines">${checks.map((a) => advanceLine(a, state)).join("")}</ul>`;
  }

  function cleanUp(c: Combat): string {
    const lines = (c.cleanUp ?? []).map((f) => `<li><img class="card" src="${cardImage(f.card)}" alt="${f.card.toUpperCase()}" data-card="${f.card}" tabindex="0">` +
      `<div class="what">${esc(t(`combatSheet.cleanUp.${f.fate}`, { card: f.card.toUpperCase() }))}</div></li>`).join("");
    return `<ul class="lines">${lines}<li class="plain"><div class="what">${t("combatSheet.cleanUp.chits")}</div></li></ul>`;
  }

  function target(c: Combat, current: boolean): string {
    if (!current) return `<p>${esc(String(c.target))}</p>`;
    return `<p>${t("combatSheet.target.choose")}</p><div class="target-choices">${(c.choices ?? []).map((h) =>
      `<button type="button" class="btn" data-target="${h}">${esc(t("combatSheet.target.pick", { hex: h }))}</button>`).join("")}</div>`;
  }

  // ---------------------------------------------------------------- German attack (task 4.5b)

  function attackTactics(c: Combat, state: GameState, current: boolean): string {
    const cancelled = c.tactics.find((x) => x.cancelled)?.cancelled ?? [];
    const names_ = (ids: string[]) => ids.map((x) => t(`names.tactic.${x as GermanAttackTactic}`)).join(t("list.comma"));
    if (!current) {
      return `<p>${c.germanTactics.length ? esc(names_(c.germanTactics)) : t("combatSheet.sum.none")}</p>` +
        (cancelled.length ? `<p class="note">${esc(t("combatSheet.attack.cancelled", { tactics: names_(cancelled) }))}</p>` : "") +
        (c.joined.length ? `<p class="note">${esc(t("combatSheet.tactics.joined", { units: names(c.joined) }))}</p>` : "");
    }
    const v = engine.combat.view(state)!;
    const locks = v.attackTactics!;
    const sorted = [...GERMAN_ATTACK_TACTICS].sort((a, b) => Number(!!locks[a]) - Number(!!locks[b]));
    const items = sorted.map((id) => {
      const lock = locks[id];
      return `<li class="${lock ? "wide" : ""}"><label class="${lock ? "off" : ""}"><input type="checkbox" data-attack-tactic="${id}"${local.attackTactics.has(id) ? " checked" : ""}${lock ? " disabled" : ""}>` +
        `<span class="box"></span><span class="t-name">${t(`names.tactic.${id}`)}${lock ? `<small>${tx(lock)}</small>` : ""}</span></label></li>`;
    }).join("");
    const notes: string[] = [];
    if (local.attackTactics.has("german-assault-coordination") && v.assault.length) notes.push(t("combatSheet.attack.assault", { units: names(v.assault) }));
    if (local.attackTactics.has("german-reinforce-battle") || c.reinforcing.length)
      notes.push(c.reinforcing.length ? t("combatSheet.yourTactics.reinforcing", { units: names(c.reinforcing) }) : t("combatSheet.attack.reinforceHint", { hex: c.target }));
    notes.push(t("combatSheet.attack.weakHint"));
    return `<p>${t("combatSheet.attack.hint")}</p><ul class="tactics">${items}</ul>${notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}`;
  }

  /** What a Soviet tactic does for the defense, for the line of the card. */
  function defenseEffect(c: Combat, x: CombatTactic): string[] {
    if (!x.applies) return [t("combatSheet.tactics.noBenefit", { why: x.reason ?? msg("combatSheet.sum.none") })];
    const terrain = engine.combat.view(session.state)?.terrain ?? "clear";
    switch (x.tactic) {
      case "soviet-airpower-artillery": return [t("combatSheet.defense.effect.chits", { name: x.name })];
      case "soviet-fixed-artillery": return [t("combatSheet.defense.effect.chits", { name: "Artillery" })];
      case "soviet-nkvd": return [t("combatSheet.defense.effect.nkvd")];
      case "soviet-partisans":
        return [t(terrain === "city" ? "combatSheet.defense.effect.partisansCity" : terrain === "town" || terrain === "woods" ? "combatSheet.defense.effect.partisansCover" : "combatSheet.defense.effect.partisansOpen")];
      case "soviet-rifle-brigade": return [t("combatSheet.defense.effect.rifle")];
      case "soviet-tank-brigade": return [t("combatSheet.defense.effect.tank")];
      case "soviet-intelligence": {
        const out = [t("combatSheet.defense.effect.intelligence")];
        if (x.cancelled?.length) out.push(t("combatSheet.attack.cancelled", { tactics: x.cancelled.map((y) => t(`names.tactic.${y as GermanAttackTactic}`)).join(t("list.comma")) }));
        return out;
      }
      case "soviet-battlefield-replacements":
        return [x.restored ? t("combatSheet.defense.effect.restored", { unit: name(x.restored) }) : t("combatSheet.defense.effect.replacementsHit")];
      case "soviet-combat-engineer": return [t("combatSheet.defense.effect.ip", { hex: c.target })];
      case "soviet-reinforce-battle": return [t("combatSheet.defense.effect.reinforce", { units: names(x.units ?? []), from: x.from ?? "", hex: c.target })];
      default: return [];
    }
  }

  function sovietCard(c: Combat, state: GameState, current: boolean): string {
    if (c.noCard) return `<p class="note">${tx(c.noCard)}</p>`;
    if (!c.card) return "";
    const img = `<img class="card" src="${cardImage(c.card.id)}" alt="${c.card.id.toUpperCase()}" data-card="${c.card.id}" tabindex="0">`;
    const label = t(c.card.fromDiscard ? "combatSheet.defense.cardFromDiscard" : "combatSheet.defense.card", { card: c.card.id.toUpperCase() });
    if (c.stage === "activation" && current) return `<ul class="lines"><li>${img}<div class="what"><b>${esc(label)}</b></div></li></ul>${activationQuestion(c, state)}`;
    const lines = c.tactics.map((x) => `<li>${img}<div class="what"><b>${esc(x.name)}</b>${defenseEffect(c, x).map((n) => `<small>${esc(n)}</small>`).join("")}` +
      `${x.steps ? decisions(x.steps) : ""}</div><span class="tag${x.applies ? "" : " no"}">${t(x.applies ? "combatSheet.defense.applies" : "combatSheet.defense.noEffect")}</span></li>`).join("");
    return `<p>${esc(label)}</p>` + (lines ? `<ul class="lines">${lines}</ul>` : `<p class="note">${esc(t("combatSheet.defense.noTactic", { card: c.card.id.toUpperCase() }))}</p>`);
  }

  /** Q62: what the German card activated, asked for the Soviet Reinforce Battle. */
  function activationQuestion(c: Combat, state: GameState): string {
    const attackers = new Set(c.attackers.map((a) => engine.unit(a)?.armyOrCorps));
    const corps = CORPS.map(([id, m]) => `<li><input type="radio" name="formation" id="f-${id}" value="${id}"${local.formation === id ? " checked" : ""}>` +
      `<label for="f-${id}"><img src="${marker(m)}" alt="">${t(`names.corps.${id}`)}${attackers.has(id) ? `<small>${t("combatSheet.activation.attackers")}</small>` : ""}</label></li>`).join("");
    const kg = local.formation === "KG";
    const kgItem = `<li class="kg"><input type="radio" name="formation" id="f-KG" value="KG"${kg ? " checked" : ""}>` +
      `<label for="f-KG"><img src="${marker(local.kgRange === 3 ? "germkampfgruppe3hex" : "germkampfgruppe2hex")}" alt="">` +
      `<span>${esc(kg ? (local.kgHex ? t("combatSheet.activation.kgAt", { hex: local.kgHex }) : t("combatSheet.activation.kgPick")) : t("combatSheet.activation.kg"))}</span></label></li>`;
    // A Kampfgruppe card may name a corps (6.2, Q64 c): its units alone are active.
    const range = kg ? `<div class="kg-range">${t("combatSheet.activation.range")} <span class="seg" role="group">` +
      [2, 3].map((r) => `<button type="button" data-range="${r}" aria-pressed="${local.kgRange === r}">${t("combatSheet.activation.hexes", { count: r })}</button>`).join("") + `</span>` +
      `<label for="kg-corps">${t("combatSheet.activation.units")}</label> <select id="kg-corps" data-kg-corps>` +
      `<option value=""${local.kgCorps ? "" : " selected"}>${t("combatSheet.activation.anyUnits")}</option>` +
      CORPS.map(([id]) => `<option value="${id}"${local.kgCorps === id ? " selected" : ""}>${t(`names.corps.${id}`)}</option>`).join("") + `</select></div>` : "";
    void state;
    return `<div class="ask"><p><b>${t("combatSheet.activation.question")}</b> ${t("combatSheet.activation.why")}</p>` +
      `<ul class="formations">${corps}${kgItem}</ul>${range}</div>`;
  }

  function attackChits(c: Combat, state: GameState, current: boolean): string {
    if (!current) return `<p>${esc(t("combatSheet.sum.chits", { count: c.drawn ?? 0 }))}</p>`;
    const v = engine.combat.view(state, { chits: local.chits })!;
    const top = Math.max(v.chits.min, v.chits.max);
    const holds = v.situations.filter((s) => s.applies), others = v.situations.filter((s) => !s.applies);
    const stepper = top > v.chits.min
      ? `<div class="stepper" role="group" aria-label="${t("combatSheet.attack.chitsDrawn")}"><button type="button" data-chits="-1" aria-label="${t("combatSheet.attack.chitLess")}"${local.chits <= v.chits.min ? " disabled" : ""}>−</button>` +
        `<output aria-live="polite">${local.chits}</output><button type="button" data-chits="1" aria-label="${t("combatSheet.attack.chitMore")}"${local.chits >= top ? " disabled" : ""}>+</button></div>` : "";
    return `<div class="draw"><span class="big">${local.chits}</span><div><b>${t("combatSheet.attack.chitsDrawn")}</b>` +
      `<small>${esc(top > v.chits.min ? t("combatSheet.attack.chitsNote", { min: v.chits.min, max: top }) : t("combatSheet.attack.chitsExact", { min: v.chits.min }))}</small></div>${stepper}</div>` +
      sumList(v.chits.rows, v.chits.max, "combatSheet.attack.maximum") +
      `<h4>${t("combatSheet.chits.keep")}</h4><ul class="situ yes">${holds.map((s) => `<li>${tx(s.text)}</li>`).join("")}</ul>` +
      `<details class="more"><summary>${esc(t("combatSheet.chits.others", { count: others.length }))}</summary>` +
      `<ul class="situ no">${others.map((s) => `<li>${tx(s.text)}</li>`).join("")}</ul></details>`;
  }

  function hitLine(h: SovietHit, state: GameState): string {
    const head = h.priority === "A" ? t("combatSheet.defense.hit.step") : h.priority === "B" ? t("combatSheet.defense.hit.retreat")
      : h.priority === "12.75" ? t("combatSheet.defense.hit.second") : t("combatSheet.defense.hit.hold", { chance: h.hold?.chance ?? 0 });
    const factors = h.hold ? `<small>${esc(h.hold.factors.map((f) => `${t(f.text)} ${f.value < 0 ? f.value : `+${f.value}`}`).join(t("list.semicolon")))}</small>` : "";
    const lost = h.result === "step" && h.unit ? `<small>${esc(h.tied ? t("combatSheet.defense.lostTied", { unit: name(h.unit), units: names(h.tied) }) : t("combatSheet.defense.lost", { unit: name(h.unit) }))}</small>` : "";
    const retreats = (h.retreats ?? []).map((r) => `<small>${esc(t("combatSheet.defense.retreat", { units: names(r.units), from: r.from, to: r.to, priority: r.priority }))}</small>` +
      (r.lost ? `<small>${esc(t("combatSheet.defense.retreatStep", { unit: name(r.lost) }))}</small>` : "") +
      (r.overstacked ? `<small>${esc(t("combatSheet.defense.overstacked"))}</small>` : "") + decisions(r.steps.filter((x) => x.dropped.length))).join("");
    const tag = h.hold ? `<span class="tag${h.result === "step" ? "" : " no"}">${d10(h.hold.roll, h.result === "step")} ${t(h.result === "step" ? "combatSheet.defense.holds" : "combatSheet.defense.gives")}</span>` : "<span></span>";
    void state;
    return `<li><span class="hit-n">${h.n}</span><div class="what"><b>${esc(head)}</b>${factors}${lost}${retreats}</div>${tag}</li>`;
  }

  function sovietDefense(c: Combat, state: GameState): string {
    const r = c.sovietDefense;
    if (!r) return "";
    if (!r.hits) return `<p>${t("combatSheet.defense.noHit")}</p>`;
    const head = r.maxRetreat
      ? t("combatSheet.defense.head", { count: r.hits, hexes: msg(r.maxRetreat === 2 ? "combatSheet.losses.retreatTwo" : "combatSheet.losses.retreatOne") })
      : t("combatSheet.defense.headNoRetreat", { count: r.hits });
    const out = [`<p>${esc(head)}</p>`,
      `<ul class="lines hits-list">${r.taken.map((h) => hitLine(h, state)).join("")}</ul>`];
    if (r.eliminated.length) out.push(`<p class="note">${esc(t("combatSheet.soviet.eliminated", { units: names(r.eliminated) }))}</p>`);
    if (r.unused) out.push(`<p class="note">${esc(t("combatSheet.defense.unused", { count: r.unused }))}</p>`);
    if (r.bystanders.length) out.push(`<p class="note">${esc(t("combatSheet.defense.bystanders", { units: names(r.bystanders) }))}</p>`);
    return out.join("");
  }

  function attackLosses(c: Combat, state: GameState, current: boolean): string {
    const L = c.losses;
    if (!L || !c.hits) return "";
    if (!current) return `<p>${esc(t(L.disperse ? "combatSheet.attack.sumDispersed" : "combatSheet.attack.sumSteps", { count: L.lost.length }))}</p>`;
    const v = engine.combat.view(state)!;
    const label = (o: (typeof v.lossOptions)[number]) => o.eliminated ? t("combatSheet.attack.allEliminated")
      : o.disperse ? t("combatSheet.attack.stepsDisperse", { count: o.steps }) : t("combatSheet.losses.steps", { count: o.steps });
    const options = v.lossOptions.length > 1 ? `<p>${t("combatSheet.attack.choose")}</p><ul class="choices">${v.lossOptions.map((o) =>
      `<li><label><input type="radio" name="attackLoss" value="${o.disperse ? "disperse" : "steps"}"${L.disperse !== undefined && !!L.disperse === !!o.disperse ? " checked" : ""}><span class="dot"></span><span>${esc(label(o))}</span></label></li>`).join("")}</ul>` : "";
    const need = L.lost.length + v.owed;
    const tally = L.disperse === undefined ? "" : `<ul class="tally"><li class="${v.owed ? "" : "ok"}"><span class="mark"></span>${esc(t("combatSheet.losses.tallySteps", { done: L.lost.length, need }))}</li></ul>`;
    return `<p><b>${esc(t("combatSheet.losses.head", { count: c.hits.german }))}</b></p>${options}` +
      (L.disperse !== undefined ? `<p class="note">${t("combatSheet.attack.how")}</p>` : "") + tally;
  }

  function yourAdvance(c: Combat, state: GameState, current: boolean): string {
    const moved = Object.entries(c.advanced ?? {}).map(([u, p]) => `<p class="note">${esc(name(u))}: ${p.join(" › ")}</p>`).join("");
    if (!current) return moved || `<p>${t("combatSheet.sum.noAdvance")}</p>`;
    const v = engine.combat.view(state)!;
    if (v.noAdvance && !moved) return `<p>${tx(v.noAdvance)}</p>`;
    return `<p>${esc(t("combatSheet.attack.advanceHint", { hex: c.target }))}</p>${moved}`;
  }

  // ---------------------------------------------------------------- summaries (done steps)

  function summary(id: StepId, c: Combat): string {
    switch (id) {
      case "reserves": return c.reserves.length ? esc(names(c.reserves.map((r) => r.unit)).join(t("list.comma"))) : t("combatSheet.sum.none");
      case "tactics": {
        const used = c.tactics.filter((x) => x.applies).map((x) => x.name);
        return used.length ? esc(used.join(t("list.comma"))) : t("combatSheet.sum.none");
      }
      case "yourTactics": return c.germanTactics.length ? esc(c.germanTactics.map((x) => t(`names.tactic.${x as GermanDefenseTactic}`)).join(t("list.comma"))) : t("combatSheet.sum.none");
      case "chits": return esc(t("combatSheet.sum.chits", { count: c.drawn ?? Math.max(c.chits.min, c.chits.max) }));
      case "hits": return c.hits ? esc(t("combatSheet.sum.hits", { german: c.hits.german, soviet: c.hits.soviet })) : "";
      case "yourLosses": {
        const L = c.losses;
        if (!L) return "";
        if (c.kind === "germanAttack") return esc(t(L.disperse ? "combatSheet.attack.sumDispersed" : "combatSheet.attack.sumSteps", { count: L.lost.length }));
        if (L.pullOut) return t("combatSheet.sum.pullOut");
        if (c.defenders.every((d) => !/^\d{4}$/.test(session.state.units[d]?.at ?? ""))) return t("combatSheet.sum.eliminated");
        return esc(t("combatSheet.sum.losses", { steps: L.lost.length, hexes: Math.max(0, ...Object.values(L.paths).map((p) => p.length - 1)) }));
      }
      case "sovietLosses": case "sovietLoss":
        if (c.sovietDefense) return esc(t("combatSheet.sum.sovietHits", { count: c.sovietDefense.hits }));
        return c.sovietLosses ? esc(t("combatSheet.sum.sovietHits", { count: c.sovietLosses.hits })) : "";
      case "advance": {
        const n = new Set((c.advance ?? []).filter((a) => a.advanced).map((a) => a.unit)).size;
        return n ? esc(t("combatSheet.sum.advanced", { count: n })) : t("combatSheet.sum.noAdvance");
      }
      case "target": return c.target;
      case "declare": return esc(t("combatSheet.germanAttack.declared", { count: c.attackers.length }));
      case "sovietCard": return c.card ? c.card.id.toUpperCase() : c.weak ? t("combatSheet.defense.weak") : t("combatSheet.sum.none");
      case "yourAdvance": {
        const n = Object.keys(c.advanced ?? {}).length;
        return n ? esc(t("combatSheet.sum.advanced", { count: n })) : t("combatSheet.sum.noAdvance");
      }
      case "cleanUp": return "";
    }
  }

  function body(id: StepId, c: Combat, state: GameState, current: boolean): string {
    switch (id) {
      case "reserves": return reserves(c, state);
      case "tactics": return tactics(c);
      case "yourTactics": return c.kind === "germanAttack" ? attackTactics(c, state, current) : yourTactics(c, state, current);
      case "chits": return c.kind === "germanAttack" ? attackChits(c, state, current) : chits(c, state, current);
      case "hits": return hits(c, state, current);
      case "yourLosses": return c.kind === "germanAttack" ? attackLosses(c, state, current) : yourLosses(c, state, current);
      case "sovietLosses": case "sovietLoss": return c.kind === "germanAttack" ? sovietDefense(c, state) : sovietLosses(c, state);
      case "advance": return advance(c, state);
      case "cleanUp": return cleanUp(c);
      case "target": return target(c, current);
      case "declare": return `<ul class="lines">${c.attackers.map((a) => `<li>${unit(a, state)}<div class="what">${esc(t("combatSheet.germanAttack.attacker", { unit: name(a), hex: c.from[a] }))}</div></li>`).join("")}</ul>`;
      case "sovietCard": return sovietCard(c, state, current);
      case "yourAdvance": return yourAdvance(c, state, current);
    }
  }

  // ---------------------------------------------------------------- the footer button

  function action(c: Combat, state: GameState): { label: string; ready: boolean; hint?: string } | null {
    if (c.kind === "germanAttack") return attackAction(c, state);
    switch (c.stage) {
      case "target": case "activation": case "advance": return null;
      case "tactics":
        return { label: local.tactics.size ? t("combatSheet.yourTactics.play", { count: local.tactics.size }) : t("combatSheet.yourTactics.none"), ready: true };
      case "chits": return { label: t("combatSheet.chits.done"), ready: true };
      case "hits": return { label: t("combatSheet.hits.resolve"), ready: true };
      case "losses": {
        const L = c.losses!, v = engine.combat.view(state)!;
        const standing = c.defenders.filter((d) => /^\d{4}$/.test(state.units[d]?.at ?? ""));
        const moved = standing.every((d) => (L.paths[d]?.length ?? 1) - 1 >= (L.retreat ?? 0));
        return { label: t("combatSheet.losses.applied"), ready: L.retreat !== null && (!standing.length || (v.owed === 0 && moved)) };
      }
      case "done": return { label: t("combatSheet.cleanUp.continue"), ready: true };
    }
  }

  /** The footer button of a German attack, by stage. */
  function attackAction(c: Combat, state: GameState): { label: string; ready: boolean } | null {
    switch (c.stage) {
      case "tactics": return { label: local.attackTactics.size ? t("combatSheet.yourTactics.play", { count: local.attackTactics.size }) : t("combatSheet.yourTactics.none"), ready: true };
      case "activation": return { label: t("combatSheet.activation.done"), ready: !!local.formation && (local.formation !== "KG" || !!local.kgHex) };
      case "chits": return { label: t("combatSheet.chits.done"), ready: true };
      case "hits": return { label: t("combatSheet.hits.resolve"), ready: !engine.combat.view(state)!.needsCommandValue || local.commandValue !== null };
      case "losses": {
        const L = c.losses!, v = engine.combat.view(state)!;
        return { label: t("combatSheet.losses.applied"), ready: L.disperse !== undefined && v.owed === 0 };
      }
      case "advance": return { label: t("combatSheet.attack.finish"), ready: true };
      default: return null;
    }
  }

  function send(command: Parameters<GameSession["dispatch"]>[0]) {
    const refused = session.dispatch(command).find((e) => e.type === "CommandRejected");
    reason = refused ? refused.reason : null;
    render(session.state);
  }

  // ---------------------------------------------------------------- render

  function render(state: GameState) {
    const c = state.combat;
    if (!c) { root.innerHTML = `<p class="hint">${t("page.combatNone")}</p>`; reason = null; plane.previewKampfgruppe(null, 3); return; }
    const key = `${c.kind}:${c.target}:${c.stage}`;
    const ids = STEPS[c.kind], cur = CURRENT[c.kind][c.stage];
    if (key !== local.key) {
      const sameCombat = local.key.startsWith(`${c.kind}:${c.target}:`);
      const open = sameCombat ? local.open : new Set<number>();
      // Once the bot has played its steps, its losses and advance show at once.
      if (c.stage === "done") ids.forEach((id, i) => { if (id === "sovietLosses" || id === "sovietLoss" || id === "advance") open.add(i); });
      local = fresh(key, open);
      local.tactics = new Set(c.germanTactics as GermanDefenseTactic[]);
      local.attackTactics = new Set(c.germanTactics as GermanAttackTactic[]);
      // Step 4 of a German attack: the required chits, to start with (12.4).
      if (c.kind === "germanAttack" && c.stage === "chits") local.chits = c.chits.min;
      const a = state.germanImpulse?.activation;
      if (a && "hex" in a) { local.formation = "KG"; local.kgHex = a.hex; local.kgRange = a.range; local.kgCorps = a.corps ?? null; }
      else if (a) local.formation = a.corps;
      else if (c.stage === "activation") {
        // The attackers' corps, to start with: the usual activation (6.0).
        const corps = [...new Set(c.attackers.map((x) => engine.unit(x)?.armyOrCorps))];
        if (corps.length === 1 && corps[0]) local.formation = corps[0];
      }
      reason = null;
    }
    plane.previewKampfgruppe(c.stage === "activation" && local.formation === "KG" ? local.kgHex : null, local.kgRange);
    const steps = ids.map((id, i) => {
      const n = i + 1, state_ = i < cur ? "done" : i === cur ? "current" : "todo";
      const open = state_ === "current" || (state_ === "done" && local.open.has(i));
      const head = `<span class="n">${n}</span><h3>${t(`combatSheet.step.${id}`)}</h3><span class="s-sum">${state_ === "done" ? summary(id, c) : ""}</span>`;
      const row = state_ === "done" ? `<button type="button" class="s-row" data-open="${i}" aria-expanded="${open}">${head}</button>` : `<div class="s-row">${head}</div>`;
      return `<li class="step ${state_}">${row}${open ? `<div class="s-body">${body(id, c, state, state_ === "current")}</div>` : ""}</li>`;
    }).join("");
    const v = engine.combat.view(state)!;
    const side = (list: string[], strength: number, who: MessageKey, right = false) => {
      const imgs = list.filter((u) => state.units[u]).slice(0, 5).map((u) => unit(u, state)).join("");
      const n = `<b>${strength}<span class="who">${t(who)}</span></b>`;
      return `<div class="side${right ? " right" : ""}">${right ? n + imgs : imgs + n}</div>`;
    };
    const army = state.botImpulse?.activation?.army;
    const by = c.kind === "germanAttack" ? t("combatSheet.germanAttack.from", { hexes: [...new Set(Object.values(c.from))] })
      : c.kind === "nkvdOperations"
      ? (state.botImpulse?.card ? t("combatSheet.byNkvd", { card: state.botImpulse.card.toUpperCase() }) : "")
      : army ? (state.botImpulse?.card ? t("combatSheet.by", { army: armyName(army), card: state.botImpulse.card.toUpperCase(), value: c.commandValue })
        : t("combatSheet.byNoCard", { army: armyName(army), value: c.commandValue })) : "";
    const a = action(c, state);
    const german = c.kind === "germanAttack";
    const title = c.kind === "nkvdOperations" ? t("combatSheet.title.nkvdOperations", { event: msg("names.event.nkvdOperations"), hex: c.target })
      : t(german ? "combatSheet.title.germanAttack" : "combatSheet.title.sovietAttack", { hex: c.target });
    root.innerHTML = `<div class="combat-sheet ${c.kind === "nkvdOperations" ? "nkvd" : german ? "german" : "soviet"}">
      <div class="hem"></div>
      <header class="b-head"><h2>${esc(title)}</h2>
        <p>${esc(whereLine(c, v))}</p>${by ? `<p>${esc(by)}</p>` : ""}</header>
      ${c.stage === "target" ? "" : `<div class="forces">${side(c.attackers, v.attack, german ? "combatSheet.germans" : "combatSheet.soviets")}<span class="odds">${v.odds[1] === 0 ? "—" : `${v.odds[0]}:${v.odds[1]}`}</span>${side(c.defenders, v.defense, german ? "combatSheet.soviets" : "combatSheet.germans", true)}</div>`}
      <ol class="steps">${steps}</ol>
      <footer class="b-foot"><div class="foot-row">` +
        `<button type="button" class="undo" data-undo aria-keyshortcuts="Control+Z" title="${esc(t("page.undoHint"))}"${session.canUndo() ? "" : " disabled"}>${t("page.undo")}</button>` +
        (a ? `<button type="button" class="act" data-act${a.ready ? "" : " disabled"}>${esc(a.label)}</button>` : "") + `</div>` +
        (german && ["tactics", "activation", "chits", "hits"].includes(c.stage) ? `<button type="button" class="cancel-attack" data-cancel-attack>${t("combatSheet.germanAttack.cancel")}</button>` : "") +
        `<p class="combat-reason" role="status">${reason ? tx(reason) : ""}</p></footer>
    </div>`;
  }

  /** "1802, city, 2 VP" (named places by name). */
  function whereLine(c: Combat, v: { terrain: string | null; vp: number | null }): string {
    const params = { place: hexName(c.target), terrain: msg(dynamicKey(`names.terrain.${v.terrain ?? "clear"}`)) };
    return v.vp ? t("combatSheet.whereVp", { ...params, vp: v.vp }) : t("combatSheet.where", params);
  }

  // ---------------------------------------------------------------- input

  root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    const c = session.state.combat;
    if (!c) return;
    const open = el.closest<HTMLElement>("[data-open]");
    if (open) {
      const i = Number(open.dataset.open);
      if (local.open.has(i)) local.open.delete(i); else local.open.add(i);
      render(session.state);
      return;
    }
    const step = el.closest<HTMLButtonElement>("[data-inc], [data-dec]");
    if (step) {
      const k = (step.dataset.inc ?? step.dataset.dec) as "german" | "soviet";
      local[k] += step.dataset.inc ? 1 : -1;
      render(session.state);
      root.querySelector<HTMLButtonElement>(`[data-${step.dataset.inc ? "inc" : "dec"}="${k}"]`)?.focus();
      return;
    }
    if (el.closest("[data-undo]")) { reason = null; session.undo(); return; }
    if (el.closest("[data-cancel-attack]")) { send({ type: "CancelAttack" }); return; }
    const chit = el.closest<HTMLButtonElement>("[data-chits]");
    if (chit) {
      local.chits += Number(chit.dataset.chits);
      render(session.state);
      root.querySelector<HTMLButtonElement>(`[data-chits="${chit.dataset.chits}"]`)?.focus();
      return;
    }
    const cv = el.closest<HTMLButtonElement>("[data-cv]");
    if (cv) { local.commandValue = Number(cv.dataset.cv); render(session.state); root.querySelector<HTMLButtonElement>(`[data-cv="${cv.dataset.cv}"]`)?.focus(); return; }
    const range = el.closest<HTMLButtonElement>("[data-range]");
    if (range) { local.kgRange = Number(range.dataset.range) as 2 | 3; render(session.state); root.querySelector<HTMLButtonElement>(`[data-range="${range.dataset.range}"]`)?.focus(); return; }
    const target = el.closest<HTMLButtonElement>("[data-target]");
    if (target) { send({ type: "CombatTarget", hex: target.dataset.target! }); return; }
    if (!el.closest("[data-act]")) return;
    if (c.kind === "germanAttack") { attackAct(c); return; }
    switch (c.stage) {
      case "tactics": {
        const tactics = [...local.tactics];
        const replacement = local.tactics.has("german-battlefield-replacements") ? (local.replacement === "hit" ? "hit" as const : { unit: local.replacement }) : undefined;
        send(replacement ? { type: "CombatTactics", tactics, replacement } : { type: "CombatTactics", tactics });
        break;
      }
      case "chits": send({ type: "CombatChitsDrawn" }); break;
      case "hits": send({ type: "CombatHits", german: local.german, soviet: local.soviet }); break;
      case "losses": send({ type: "CombatHitsApplied" }); break;
      case "done": send({ type: "ContinueBotImpulse" }); break;
    }
  });

  function attackAct(c: Combat) {
    switch (c.stage) {
      case "tactics": send({ type: "CombatTactics", tactics: [...local.attackTactics] }); break;
      case "activation":
        if (local.formation === "KG" && local.kgHex) {
          send({ type: "NameActivation", activation: { hex: local.kgHex, range: local.kgRange, ...(local.kgCorps ? { corps: local.kgCorps } : {}) } });
        }
        else if (local.formation && local.formation !== "KG") send({ type: "NameActivation", activation: { corps: local.formation } });
        break;
      case "chits": send({ type: "CombatChitsDrawn", chits: local.chits }); break;
      case "hits": send(local.commandValue === null ? { type: "CombatHits", german: local.german, soviet: local.soviet }
        : { type: "CombatHits", german: local.german, soviet: local.soviet, commandValue: local.commandValue }); break;
      case "losses": send({ type: "CombatHitsApplied" }); break;
      case "advance": send({ type: "FinishCombat" }); break;
      default: break;
    }
  }

  root.addEventListener("change", (e) => {
    const i = e.target as HTMLInputElement;
    if (i.dataset.attackTactic) {
      const id = i.dataset.attackTactic as GermanAttackTactic;
      if (i.checked) local.attackTactics.add(id); else local.attackTactics.delete(id);
      render(session.state);
      root.querySelector<HTMLInputElement>(`[data-attack-tactic="${id}"]`)?.focus();
      return;
    }
    if (i.dataset.kgCorps !== undefined) {
      local.kgCorps = i.value || null;
      render(session.state);
      root.querySelector<HTMLSelectElement>("#kg-corps")?.focus();
      return;
    }
    if (i.name === "formation") {
      local.formation = i.value;
      render(session.state);
      root.querySelector<HTMLInputElement>(`#f-${i.value}`)?.focus();
      return;
    }
    if (i.name === "attackLoss") {
      send({ type: "CombatLosses", retreat: 0, disperse: i.value === "disperse" });
      root.querySelector<HTMLInputElement>(`[name="attackLoss"][value="${i.value}"]`)?.focus();
      return;
    }
    if (i.dataset.tactic) {
      const id = i.dataset.tactic as GermanDefenseTactic;
      if (i.checked) local.tactics.add(id); else local.tactics.delete(id);
      render(session.state);
      root.querySelector<HTMLInputElement>(`[data-tactic="${id}"]`)?.focus();
    } else if (i.name === "replacement") {
      local.replacement = i.value;
    } else if (i.name === "loss") {
      send({ type: "CombatLosses", retreat: Number(i.value) as 0 | 1 | 2 });
      root.querySelector<HTMLInputElement>(`[name="loss"][value="${i.value}"]`)?.focus();
    }
  });

  /** Q62: a click on the map gives the hex of the Kampfgruppe marker while the sheet asks for it. */
  function mapClick(hex: string): boolean {
    const c = session.state.combat;
    if (!c || c.stage !== "activation" || local.formation !== "KG") return false;
    local.kgHex = hex;
    render(session.state);
    return true;
  }

  session.subscribe((state) => render(state));
  render(session.state);
  return { render, mapClick };
}
