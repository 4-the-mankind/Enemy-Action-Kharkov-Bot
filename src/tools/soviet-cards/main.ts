// Wiring only: load data/soviet-cards.json and lay each card scan beside the bot's reading of
// it (4.1), for the dev to check. The plain-words reading mirrors src/engine/soviet-cards.ts.
import { parseSovietCards, type CardCommand, type SovietCard } from "../../core/soviet-cards";
import { armyName, frontName } from "../../engine/names";
import { t } from "../../i18n/i18n";

interface Named { id: string; name: string }

const cardsEl = document.getElementById("cards") as HTMLElement;
const count = document.getElementById("count") as HTMLElement;
const errorEl = document.getElementById("error") as HTMLElement;
const tabs = document.getElementById("front-tabs") as HTMLElement;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const army = (a: string) => t(a === "voronezh" || a === "southwest" ? frontName(a) : armyName(a));
const scan = (id: string) => `/assets/cards/EAKh-sovECcards-E-${id.slice(1)}.png`;
const FRONT = { voronezh: "Voronezh Front", southwest: "Southwest Front" } as const;
const TIE = { voronezh: "a supplied unit closest to the west map edge", southwest: "a supplied unit closest to the 3300 hexrow", stavka: "a supplied unit closest to hex 1923" };

/** Task that will code the line, when the bot passes it over for now. */
const PENDING: Record<string, string> = {
  replacement: "4.6", "soviet-garrison-front": "4.6",
};

function reading(l: CardCommand, events: Map<string, string>): { what: string; rule: string; waits?: string; note?: string } {
  switch (l.kind) {
    case "activateArmy":
      return { what: `Activate all units of the ${army(l.army)}${l.stacked ? ", plus units of its front stacked with them" : ""}.`, rule: "8.13" };
    case "activateArmyUnits":
      return {
        what: `Activate up to two units or stacks of the ${army(l.army)} outside VP hexes, chosen by a) supplied, b) not surrounded, c) highest strength, d) most units, e) lowest selector; plus all its reserves.`,
        rule: "8.13 Army Units",
      };
    case "activateMostUnits":
      return {
        what: `Activate the army${l.front ? ` of the ${FRONT[l.front]}` : ""} with the most supplied units on the map and in reserve, plus units of its front stacked with them. Tie: ${TIE[l.front ?? "stavka"]}, then the lowest numbered army.`,
        rule: "8.13",
      };
    case "activateEndangered":
      return { what: `Activate all ${FRONT[l.front]} units outside the operational limit or nearly surrounded; if none, as on Game-turn 4.`, rule: "8.13" };
    case "replacement":
      return { what: `Assign one replacement step to the ${army(l.army)}.`, rule: "8.12", waits: PENDING.replacement };
    default: {
      const name = events.get(l.event) ?? l.event;
      const front = l.front ? ` (${FRONT[l.front]})` : "";
      const special = l.kind === "special";
      return {
        what: `${special ? "Special event" : "Command event"}: ${name}${front}.`,
        rule: "8.11",
        waits: PENDING[l.event],
        note: l.event === "soviet-command-delay" ? "Only from the auxiliary card."
          : l.event === "soviet-nkvd-operations" ? "The bot picks the target and its step loss; you apply the hits and, until task 4.5, the advance after combat."
          : l.event === "soviet-hitler-distracts" ? "A reminder for you on the map."
          : special ? "Never played from the auxiliary card." : undefined,
      };
    }
  }
}

function render(cards: SovietCard[], events: Map<string, string>, tactics: Map<string, string>, front: string) {
  const shown = cards.filter((c) => front === "all" || (c.front ?? "stavka") === front);
  count.textContent = `${shown.length} of ${cards.length} cards`;
  cardsEl.innerHTML = shown.map((c) => {
    const facts = [
      ["Front", c.front ? FRONT[c.front] : "STAVKA"],
      ["Command Value", `c${c.commandValue}`],
      ["Primary", c.primary ? "Yes" : "No"],
      ["In the deck", c.entryTurn ? `From Game-turn ${c.entryTurn}` : "At start"],
    ];
    const lines = c.commands.map((l) => {
      const r = reading(l, events);
      return `<li>${l.turns ? `<span class="gt">${l.turns}</span>` : `<span class="gt all">All</span>`}` +
        `<div><p class="what">${esc(r.what)} <span class="rule">${r.rule}</span></p>` +
        `<p class="printed">Printed: “${esc(l.text)}”</p>` +
        (r.note ? `<p class="note">${esc(r.note)}</p>` : "") +
        (r.waits ? `<p class="waits">Passed over by the bot until task ${r.waits}.</p>` : "") + `</div></li>`;
    }).join("");
    const tac = c.tactics.map((t) =>
      `<li>${t.turns ? `<span class="gt">${t.turns}</span>` : ""}<b>${esc(t.name)}</b>${t.use ? ` <span class="use">only when ${t.use === "attack" ? "attacking" : "defending"}</span>` : ""}` +
      `<span class="tactic">${esc(tactics.get(t.tactic) ?? t.tactic)}</span></li>`).join("");
    return `<article class="card-row" id="${c.id}">
      <a class="scan" href="${scan(c.id)}" target="_blank" rel="noopener"><img src="${scan(c.id)}" alt="Scan of card ${c.id.toUpperCase()}" loading="lazy"></a>
      <div class="reading">
        <h2><span class="id">${c.id.toUpperCase()}</span> ${esc(c.title)}</h2>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <h3>Commands, top to bottom</h3>
        <ol class="lines">${lines}</ol>
        <h3>Combat tactic${c.tactics.length > 1 ? "s" : ""}</h3>
        <ul class="tactics">${tac}</ul>
        ${c.reuse ? `<p class="flag">Re-use: shuffled back into the draw pile after combat use (12.32).</p>` : ""}
        ${c.note ? `<p class="flag">${esc(c.note)}</p>` : ""}
      </div>
    </article>`;
  }).join("");
}

async function init() {
  const get = async (path: string) => {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path.slice(1)} could not be loaded.`);
    return res.json();
  };
  let cards: SovietCard[], events: Map<string, string>, tactics: Map<string, string>;
  try {
    const [c, e, t] = await Promise.all(["/data/soviet-cards.json", "/data/events.json", "/data/combat-tactics.json"].map(get));
    cards = parseSovietCards(c);
    events = new Map((e.events as Named[]).map((x) => [x.id, x.name]));
    tactics = new Map((t.tactics as Named[]).map((x) => [x.id, x.name]));
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = (err as Error).message;
    return;
  }
  let front = "all";
  tabs.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-front]");
    if (!b) return;
    front = b.dataset.front!;
    tabs.querySelectorAll<HTMLButtonElement>("[data-front]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-selected", String(x === b));
    });
    render(cards, events, tactics, front);
  });
  render(cards, events, tactics, front);
}

init();
