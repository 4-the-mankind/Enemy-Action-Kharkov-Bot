// Wiring only (task 5.10): each chit scan beside what the engine reads from
// data/combat-chits.json, evaluated by src/engine/chits.ts on a combat the dev sets. Dev only.
import { COMBAT_CHITS, type ChitCondition, type ChitFace, type CombatChit } from "../../core/combat-chits";
import { faceHolds, holds, readChit, type ChitFacts } from "../../engine/chits";
import { applyI18n, t } from "../../i18n/i18n";
import { dynamicKey, msg, type Message } from "../../i18n/message";
import { staticUrl } from "../../ui/static-url";

const form = document.getElementById("test") as HTMLFormElement;
const list = document.getElementById("chits") as HTMLElement;
const count = document.getElementById("count") as HTMLElement;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const TERRAINS = ["clear", "broken", "woods", "town", "city", "marsh"];
/** Checkboxes of the test combat: a ChitFacts field, or a field of one of its pairs. */
const FLAGS = ["airpowerGerman", "airpowerSoviet", "artilleryAttacker", "artilleryDefender", "combatEngineers", "defenderAdjacent",
  "dispersedOrUnsupplied", "flank", "ipCrossfire", "oneHex", "armorAttacker", "armorDefender", "nkvd", "attackNotSupported", "defenderNotSupported"] as const;

(document.getElementById("terrain") as HTMLSelectElement).innerHTML = TERRAINS.map((k) =>
  `<option value="${k}">${esc(k)}</option>`).join("");
(document.getElementById("command") as HTMLSelectElement).innerHTML = `<option value="">${esc(t("chitsTool.test.commandUnknown"))}</option>` +
  [1, 2, 3, 4, 5].map((v) => `<option value="${v}"${v === 3 ? " selected" : ""}>${v}</option>`).join("");
(document.getElementById("flags") as HTMLElement).innerHTML = FLAGS.map((f) =>
  `<label class="flag"><input type="checkbox" name="${f}" /><span>${esc(t(dynamicKey(`chitsTool.test.${f}`)))}</span></label>`).join("");
applyI18n();

function facts(): ChitFacts {
  const v = new FormData(form);
  const num = (k: string) => Number(v.get(k) ?? 0);
  const on = (k: (typeof FLAGS)[number]) => v.get(k) === "on";
  const command = String(v.get("commandValue") ?? "");
  return {
    kind: v.get("kind") === "sovietAttack" ? "sovietAttack" : "germanAttack",
    turn: num("turn"), attack: num("attack"), defense: num("defense"), terrain: String(v.get("terrain")),
    airpower: { german: on("airpowerGerman"), soviet: on("airpowerSoviet") },
    artillery: { attacker: on("artilleryAttacker"), defender: on("artilleryDefender") },
    combatEngineers: on("combatEngineers"), defenderAdjacent: on("defenderAdjacent") ? ["?"] : [],
    dispersedOrUnsupplied: on("dispersedOrUnsupplied"), flank: on("flank"), drawn: num("drawn"),
    ipCrossfire: on("ipCrossfire"), oneHex: on("oneHex"),
    armor: { attacker: on("armorAttacker"), defender: on("armorDefender") },
    commandValue: command ? Number(command) : null, nkvd: on("nkvd"),
    attackNotSupported: on("attackNotSupported"), defenderNotSupported: on("defenderNotSupported"),
  };
}

/** How the engine understands a condition, in words. */
function explain(c: ChitCondition): Message {
  switch (c.type) {
    case "ratio": return "atLeast" in c ? msg("chitsTool.condition.ratioAtLeast", { ratio: c.atLeast }) : msg("chitsTool.condition.ratioBelow", { ratio: c.below });
    case "terrain": return msg("chitsTool.condition.terrain", { terrain: msg(dynamicKey(`combat.situation.terrain.${c.terrain}`)) });
    case "airpower": case "artillery": case "onlyArmor": return msg(dynamicKey(`chitsTool.condition.${c.type}.${c.side}`));
    case "commandValue": return msg("chitsTool.condition.commandValue", { values: { list: c.values, separator: "comma" } });
    case "notSupported": return msg(dynamicKey(`chitsTool.condition.notSupported.${c.what}`));
    default: return msg(dynamicKey(`chitsTool.condition.${c.type}`));
  }
}

const stateOf = (h: boolean | null) => (h === true ? "yes" : h === false ? "no" : "unknown");
const badge = (h: boolean | null) => `<span class="state ${stateOf(h)}">${esc(t(dynamicKey(`chitsTool.state.${stateOf(h)}`)))}</span>`;

function hits(face: ChitFace): string {
  const parts = (["attacker", "defender", "german", "soviet"] as const).filter((k) => face.hits[k] !== undefined)
    .map((k) => esc(t(dynamicKey(`chitsTool.hits.${k}`), { n: face.hits[k]! })));
  return parts.length ? parts.join(" ") : esc(t("chitsTool.hits.none"));
}

function faceHtml(chit: CombatChit, side: "front" | "back", f: ChitFacts, kept: string): string {
  const face = chit[side]!;
  const file = `comchit_${chit.id}${side === "front" ? "frt" : "bck"}.png`;
  const title = `<h3>${esc(t(dynamicKey(`chitsTool.${side}`)))}</h3>`;
  const h = faceHolds(face, f);
  const conds = face.if.map((c) => `<li>${badge(holds(c, f))} ${esc(t(explain(c)))}</li>`).join("");
  return `<section class="face${kept === side ? " kept" : ""}">${title}
    <img class="scan" src="${staticUrl(`scans/chits/${file}`)}" alt="${esc(face.printed)}" width="95" height="95" />
    <div class="reading">
      <p class="printed"><b>${esc(face.printed)}</b> · ${hits(face)}
        ${face.priority ? `<span class="p" title="${esc(t("chitsTool.priority"))}">P</span>` : ""}
        ${face.turns ? `<span class="gt">${esc(t("chitsTool.turns", face.turns))}</span>` : ""} ${badge(h)}</p>
      <p class="any">${esc(t("chitsTool.anyOf"))}</p>
      <ul class="conds">${conds}</ul>
    </div></section>`;
}

function render() {
  const f = facts();
  count.textContent = t("chitsTool.count", { count: COMBAT_CHITS.length });
  list.innerHTML = COMBAT_CHITS.map((chit) => {
    const r = readChit(chit, f);
    const head = `<header><h2>#${chit.id}</h2>${chit.dark ? `<span class="dark">${esc(t("chitsTool.dark"))}</span>` : ""}
      <span class="kept-${r.kept}">${esc(t(dynamicKey(`chitsTool.kept.${r.kept}`)))}</span></header>`;
    return `<article class="chit${chit.dark ? " is-dark" : ""}">${head}<div class="faces">${faceHtml(chit, "front", f, r.kept)}${faceHtml(chit, "back", f, r.kept)}</div></article>`;
  }).join("");
}

form.addEventListener("input", render);
render();
