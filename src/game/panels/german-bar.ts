// German impulse bar (F, §3bis, task 5.1): a slip at the foot of the map with what the player
// does there during his impulse (drag the counters) and the one button "Attack a hex" (A).
// Attack mode turns it into an attack order: the attackers are picked on the map (a click on a
// counter takes it or drops it, Shift+click or a click beside the counters its whole stack;
// a selection already made comes along), then a click on the Soviet hex declares the attack.
// The engine checks it (12.1, DeclareAttack) and the Combat tab opens on the sheet; until then
// the attackers are view state only. Pointing at a Soviet hex shows the arrows of the attack
// dashed in Prussian blue, or why it may not be attacked. While a combat is open, the bar points
// at the Combat tab. Nothing here decides a rule: the engine does (D12).
import { isHex, type GameState } from "../../engine/types";
import { t, type Message } from "../../i18n/i18n";
import { faceImage } from "../data/game-data";
import type { CombatPlane } from "../map/combat-plane";
import type { ClickInfo } from "../map/map-view";
import type { UnitsPlane } from "../map/units-plane";
import type { GameSession } from "../state/session";
import type { Selection } from "../state/selection";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** An arrow into a hex: the attack, as the combat arrows draw it. */
const ATTACK_ICON = `<svg viewBox="0 0 20 20" aria-hidden="true"><polygon class="a-hex" points="19,8 16,13.2 10,13.2 7,8 10,2.8 16,2.8"/>` +
  `<path class="a-shaft" d="M1.6 18.4 6.4 13.6"/><path class="a-head" d="M10.9 9.1 8.9 15.3 4.7 11.1Z"/></svg>`;

export interface GermanBar {
  attacking(): boolean;
  /** Attack a hex on or off (button, key A). */
  toggle(): void;
  cancel(): void;
  /** A map click in attack mode: pick an attacker, or declare the attack on that hex. */
  mapClick(hex: string, info: ClickInfo): void;
  /** The hex under the pointer, for the arrows of the attack it would be. */
  hover(hex: string | null): void;
}

export function mountGermanBar(root: HTMLElement, session: GameSession, deps: { units: UnitsPlane; combat: CombatPlane; selection: Selection }): GermanBar {
  const engine = session.engine;
  let mode = false;
  let attackers: string[] = [];
  /** Why the last click declared nothing, or why the hex pointed at may not be attacked. */
  let refusal: Message | null = null, pointed: Message | null = null, hovered: string | null = null;

  const isGerman = (id: string) => engine.unit(id)?.side === "german";
  const unitsIn = (state: GameState, hex: string) => state.order.filter((id) => state.units[id]?.at === hex);
  const busy = (state: GameState) => !!engine.locked(state) || !!state.combat;

  function mark() {
    deps.units.markAttackers(new Set(attackers));
    hovered = null;
    pointed = null;
    deps.combat.preview(null);
  }

  function stop() {
    mode = false;
    attackers = [];
    refusal = null;
    mark();
    render(session.state);
  }

  function toggle() {
    if (mode) { stop(); return; }
    const state = session.state;
    if (busy(state)) return;
    mode = true;
    // A stack selected before comes along as the first attackers.
    attackers = deps.selection.list().filter((id) => isGerman(id) && isHex(state.units[id]?.at ?? ""));
    deps.selection.clear();
    refusal = null;
    mark();
    render(state);
  }

  function pick(ids: string[]) {
    const all = ids.every((id) => attackers.includes(id));
    attackers = all ? attackers.filter((id) => !ids.includes(id)) : [...attackers, ...ids.filter((id) => !attackers.includes(id))];
    refusal = null;
    mark();
    render(session.state);
  }

  function declare(hex: string) {
    const refused = session.dispatch({ type: "DeclareAttack", target: hex, attackers }).find((e) => e.type === "CommandRejected");
    if (refused) {
      refusal = refused.reason;
      render(session.state);
      return;
    }
    stop();
  }

  function mapClick(hex: string, info: ClickInfo) {
    const state = session.state;
    const germans = unitsIn(state, hex).filter(isGerman);
    if (info.unit && isGerman(info.unit) && !info.shift) pick([info.unit]);
    else if (germans.length) pick(germans);
    else declare(hex);
  }

  function hover(hex: string | null) {
    if (!mode || hex === hovered) return;
    hovered = hex;
    const state = session.state;
    const target = hex && attackers.length && unitsIn(state, hex).some((id) => !isGerman(id)) ? hex : null;
    pointed = target ? engine.combat.whyNotAttack(state, attackers, target) : null;
    const from = [...new Set(attackers.map((id) => state.units[id].at))];
    deps.combat.preview(target && !pointed ? from : null, target ?? undefined);
    const line = root.querySelector<HTMLElement>(".gb-reason");
    if (line) showReason(line);
  }

  function showReason(line: HTMLElement) {
    const m = refusal ?? pointed;
    line.textContent = m ? t(m) : "";
    line.classList.toggle("refused", !!refusal);
  }

  function render(state: GameState) {
    root.hidden = !!engine.locked(state);
    root.classList.toggle("attack", mode);
    if (state.combat) {
      root.innerHTML = `<p class="gb-line">${esc(t("germanBar.combatOpen", { hex: state.combat.target }))}</p>`;
      return;
    }
    if (!mode) {
      root.innerHTML = `<p class="gb-line">${esc(t("germanBar.hint"))}</p>` +
        `<button type="button" class="gb-attack" data-attack aria-keyshortcuts="a">${ATTACK_ICON}<span>${esc(t("germanBar.attack"))}</span> <kbd>A</kbd></button>`;
      return;
    }
    const byHex = new Map<string, string[]>();
    for (const id of attackers) byHex.set(state.units[id].at, [...(byHex.get(state.units[id].at) ?? []), id]);
    const groups = [...byHex].map(([hex, ids]) => `<li><span class="gb-hex">${hex}</span>` + ids.map((id) => {
      const u = engine.unit(id)!;
      return `<button type="button" class="gb-unit" data-out="${id}" title="${esc(t("germanBar.remove", { unit: u.designation }))}">` +
        `<img src="${faceImage(u, state.units[id].face)}" alt="${esc(u.designation)}"></button>`;
    }).join("") + `</li>`).join("");
    root.innerHTML = `<div class="hem"></div><div class="gb-head"><h2>${ATTACK_ICON}${esc(t("germanBar.attack"))}</h2>` +
      `<button type="button" class="gb-cancel" data-cancel>${esc(t("germanBar.cancel"))} <kbd>Esc</kbd></button></div>` +
      `<p class="gb-step">${esc(t(attackers.length ? "germanBar.pickTarget" : "germanBar.pickAttackers"))}</p>` +
      (groups ? `<ul class="gb-attackers" aria-label="${esc(t("germanBar.attackers"))}">${groups}</ul>` : "") +
      `<p class="gb-reason" role="status"></p>`;
    showReason(root.querySelector<HTMLElement>(".gb-reason")!);
  }

  root.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    if (el.closest("[data-attack]")) toggle();
    else if (el.closest("[data-cancel]")) stop();
    else {
      const out = el.closest<HTMLElement>("[data-out]");
      if (out) pick([out.dataset.out!]);
    }
  });

  // Its height, for the inspector resting on it when the map is narrow (style.css).
  new ResizeObserver(() => root.parentElement?.style.setProperty("--gb-h", `${root.hidden ? 0 : root.offsetHeight}px`)).observe(root);

  session.subscribe((state) => {
    // A combat opened (or the game locked): no attack order on the side.
    if (mode && busy(state)) { stop(); return; }
    const kept = attackers.filter((id) => isGerman(id) && isHex(state.units[id]?.at ?? ""));
    if (kept.length !== attackers.length) { attackers = kept; mark(); }
    render(state);
  });
  render(session.state);

  return { attacking: () => mode, toggle, cancel: stop, mapClick, hover };
}
