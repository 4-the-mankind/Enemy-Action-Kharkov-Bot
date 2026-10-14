// Combat tab of the rail (D18, task 4.5a): the combat sheet of the combat in progress, its
// steps 1-9 of 12.0 numbered (done: one line, a click shows the detail; in progress: open,
// with its button; to come: greyed), in the attacker's color. Everything it shows comes from
// the game state and the engine (engine.combat.view): the page computes nothing (D12). Each
// button sends one command, so Undo (the sheet's own button, or Ctrl+Z) takes back one step.
import { GERMAN_DEFENSE_TACTICS, type GermanDefenseTactic } from "../../engine/combat";
import { armyName } from "../../engine/names";
import { hexName } from "../../engine/objectives";
import type { AdvanceCheck, Combat, DecisionStep, GameState, HitAdjustment } from "../../engine/types";
import { msg, t, type Message, type MessageKey } from "../../i18n/i18n";
import { dynamicKey } from "../../i18n/message";
import { faceImage } from "../data/game-data";
import type { GameSession } from "../state/session";
import { cardImage } from "./card-zoom";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const tx = (m: Message) => esc(t(m));

type StepId = "reserves" | "tactics" | "yourTactics" | "chits" | "hits" | "yourLosses" | "sovietLosses" | "advance" | "cleanUp" | "target" | "sovietLoss";
const STEPS: Record<Combat["kind"], StepId[]> = {
  sovietAttack: ["reserves", "tactics", "yourTactics", "chits", "hits", "yourLosses", "sovietLosses", "advance", "cleanUp"],
  nkvdOperations: ["target", "yourLosses", "sovietLoss", "advance"],
};
/** The step the sheet waits on, by stage (index in STEPS). */
const CURRENT: Record<Combat["kind"], Record<Combat["stage"], number>> = {
  sovietAttack: { target: 2, tactics: 2, chits: 3, hits: 4, losses: 5, done: 8 },
  nkvdOperations: { target: 0, tactics: 1, chits: 1, hits: 1, losses: 1, done: 3 },
};

export function mountCombatPanel(root: HTMLElement, session: GameSession) {
  const engine = session.engine;
  /** What the player is choosing before sending it: reset when the combat moves on. */
  let local = { key: "", tactics: new Set<GermanDefenseTactic>(), replacement: "hit" as string, german: 0, soviet: 0, open: new Set<number>() };
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
    const p = engine.combat.preview(state, local.german, local.soviet)!;
    const stepper = (key: "german" | "soviet", label: MessageKey, sub: MessageKey, min: number) =>
      `<div class="hit-row"><div><b>${t(label)}</b><small>${t(sub)}</small></div>` +
      `<div class="stepper" role="group" aria-label="${t(label)}"><button type="button" data-dec="${key}" aria-label="${t("combatSheet.hits.less")}"${local[key] <= min ? " disabled" : ""}>−</button>` +
      `<output aria-live="polite">${local[key]}</output><button type="button" data-inc="${key}" aria-label="${t("combatSheet.hits.more")}">+</button></div></div>`;
    return `<p>${esc(t("combatSheet.hits.hint"))}</p><div class="hits">` +
      stepper("german", "combatSheet.hits.german", "combatSheet.hits.germanSub", -9) + stepper("soviet", "combatSheet.hits.soviet", "combatSheet.hits.sovietSub", -9) + `</div>` +
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

  // ---------------------------------------------------------------- summaries (done steps)

  function summary(id: StepId, c: Combat): string {
    switch (id) {
      case "reserves": return c.reserves.length ? esc(names(c.reserves.map((r) => r.unit)).join(t("list.comma"))) : t("combatSheet.sum.none");
      case "tactics": {
        const used = c.tactics.filter((x) => x.applies).map((x) => x.name);
        return used.length ? esc(used.join(t("list.comma"))) : t("combatSheet.sum.none");
      }
      case "yourTactics": return c.germanTactics.length ? esc(c.germanTactics.map((x) => t(`names.tactic.${x as GermanDefenseTactic}`)).join(t("list.comma"))) : t("combatSheet.sum.none");
      case "chits": return esc(t("combatSheet.sum.chits", { count: Math.max(c.chits.min, c.chits.max) }));
      case "hits": return c.hits ? esc(t("combatSheet.sum.hits", { german: c.hits.german, soviet: c.hits.soviet })) : "";
      case "yourLosses": {
        const L = c.losses;
        if (!L) return "";
        if (L.pullOut) return t("combatSheet.sum.pullOut");
        if (c.defenders.every((d) => !/^\d{4}$/.test(session.state.units[d]?.at ?? ""))) return t("combatSheet.sum.eliminated");
        return esc(t("combatSheet.sum.losses", { steps: L.lost.length, hexes: Math.max(0, ...Object.values(L.paths).map((p) => p.length - 1)) }));
      }
      case "sovietLosses": case "sovietLoss": return c.sovietLosses ? esc(t("combatSheet.sum.sovietHits", { count: c.sovietLosses.hits })) : "";
      case "advance": {
        const n = new Set((c.advance ?? []).filter((a) => a.advanced).map((a) => a.unit)).size;
        return n ? esc(t("combatSheet.sum.advanced", { count: n })) : t("combatSheet.sum.noAdvance");
      }
      case "target": return c.target;
      case "cleanUp": return "";
    }
  }

  function body(id: StepId, c: Combat, state: GameState, current: boolean): string {
    switch (id) {
      case "reserves": return reserves(c, state);
      case "tactics": return tactics(c);
      case "yourTactics": return yourTactics(c, state, current);
      case "chits": return chits(c, state, current);
      case "hits": return hits(c, state, current);
      case "yourLosses": return yourLosses(c, state, current);
      case "sovietLosses": case "sovietLoss": return sovietLosses(c, state);
      case "advance": return advance(c, state);
      case "cleanUp": return cleanUp(c);
      case "target": return target(c, current);
    }
  }

  // ---------------------------------------------------------------- the footer button

  function action(c: Combat, state: GameState): { label: string; ready: boolean; hint?: string } | null {
    switch (c.stage) {
      case "target": return null;
      case "tactics": return { label: local.tactics.size ? t("combatSheet.yourTactics.play", { count: local.tactics.size }) : t("combatSheet.yourTactics.none"), ready: true };
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

  function send(command: Parameters<GameSession["dispatch"]>[0]) {
    const refused = session.dispatch(command).find((e) => e.type === "CommandRejected");
    reason = refused ? refused.reason : null;
    render(session.state);
  }

  // ---------------------------------------------------------------- render

  function render(state: GameState) {
    const c = state.combat;
    if (!c) { root.innerHTML = `<p class="hint">${t("page.combatNone")}</p>`; reason = null; return; }
    const key = `${c.kind}:${c.target}:${c.stage}`;
    const ids = STEPS[c.kind], cur = CURRENT[c.kind][c.stage];
    if (key !== local.key) {
      const sameCombat = local.key.startsWith(`${c.kind}:${c.target}:`);
      const open = sameCombat ? local.open : new Set<number>();
      // Once the bot has played its steps, its losses and advance show at once.
      if (c.stage === "done") ids.forEach((id, i) => { if (id === "sovietLosses" || id === "sovietLoss" || id === "advance") open.add(i); });
      local = { key, tactics: new Set(c.germanTactics as GermanDefenseTactic[]), replacement: "hit", german: 0, soviet: 0, open };
      reason = null;
    }
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
    const by = c.kind === "nkvdOperations"
      ? (state.botImpulse?.card ? t("combatSheet.byNkvd", { card: state.botImpulse.card.toUpperCase() }) : "")
      : army ? (state.botImpulse?.card ? t("combatSheet.by", { army: armyName(army), card: state.botImpulse.card.toUpperCase(), value: c.commandValue })
        : t("combatSheet.byNoCard", { army: armyName(army), value: c.commandValue })) : "";
    const a = action(c, state);
    root.innerHTML = `<div class="combat-sheet ${c.kind === "nkvdOperations" ? "nkvd" : "soviet"}">
      <div class="hem"></div>
      <header class="b-head"><h2>${esc(c.kind === "nkvdOperations" ? t("combatSheet.title.nkvdOperations", { event: msg("names.event.nkvdOperations"), hex: c.target }) : t("combatSheet.title.sovietAttack", { hex: c.target }))}</h2>
        <p>${esc(whereLine(c, v))}</p>${by ? `<p>${esc(by)}</p>` : ""}</header>
      ${c.stage === "target" ? "" : `<div class="forces">${side(c.attackers, v.soviet, "combatSheet.soviets")}<span class="odds">${v.odds[1] === 0 ? "—" : `${v.odds[0]}:${v.odds[1]}`}</span>${side(c.defenders, v.german, "combatSheet.germans", true)}</div>`}
      <ol class="steps">${steps}</ol>
      <footer class="b-foot"><div class="foot-row">` +
        `<button type="button" class="undo" data-undo aria-keyshortcuts="Control+Z" title="${esc(t("page.undoHint"))}"${session.canUndo() ? "" : " disabled"}>${t("page.undo")}</button>` +
        (a ? `<button type="button" class="act" data-act${a.ready ? "" : " disabled"}>${esc(a.label)}</button>` : "") + `</div>` +
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
    const target = el.closest<HTMLButtonElement>("[data-target]");
    if (target) { send({ type: "CombatTarget", hex: target.dataset.target! }); return; }
    if (!el.closest("[data-act]")) return;
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

  root.addEventListener("change", (e) => {
    const i = e.target as HTMLInputElement;
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

  session.subscribe((state) => render(state));
  render(session.state);
  return { render };
}
