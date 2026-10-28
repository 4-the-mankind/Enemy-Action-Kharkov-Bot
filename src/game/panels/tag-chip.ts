// State tags drawn (§3bis H, task 4.6b): the chip of the tags bar (marker, name, how long it
// lasts; click = a slip with its effect and rule, Q89), and the small mark that cites a tag on
// a log line or a "Why this move" step (Q88), with the same marker and a slip of its effect.
import type { StateTag, TagId } from "../../engine/types";
import { groundImage } from "../data/game-data";
import { cardImage } from "./card-zoom";
import { infoAttrs } from "./info-pop";
import { t } from "../../i18n/i18n";
import { staticUrl } from "../../ui/static-url";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const marker = (file: string) => staticUrl(`assets/counters/others/${file}`);

/** Line glyph for the tags without a marker of their own: the support and operational limit lines. */
const LINE = (cls: string) => `<svg class="tag-glyph ${cls}" viewBox="0 0 20 20" aria-hidden="true"><path class="zone" d="M11 1h8v18h-8z"/><path class="edge" d="M11 1 9 6l2 4-2 5 2 4"/></svg>`;

/** The marker of a tag (ground markers, Forward Support, VP, game-turn), the STAVKA card, or a line glyph. */
export function tagIcon(id: TagId): string {
  switch (id) {
    case "frozen": case "lightMud": case "heavyMud": return `<img src="${groundImage(id)}" alt="">`;
    case "forwardSupport": return `<img src="${marker("marker-sovietfwrdsupp.png")}" alt="">`;
    case "desperation": return `<img src="${marker("marker-sovietVP.png")}" alt="">`;
    case "okwExpedites": return `<img src="${marker("marker-germangameturn-sml.png")}" alt="">`;
    case "stavkaRemoved": return `<img class="card" src="${cardImage("e22")}" alt="">`;
    case "support": return LINE("support");
    case "operationalLimit": return LINE("limit");
  }
}

/** The slip of a tag: marker and name, then its text, then its rule and how long it lasts. */
export const infoSlip = (icon: string, name: string, text: string, foot = "") =>
  `<header>${icon}<b>${esc(name)}</b></header><p>${esc(text)}</p>` + (foot ? `<p class="info-foot">${esc(foot)}</p>` : "");

/** A chip of the tags bar: a click shows its effect, its rule and how long it lasts (Q89). */
export function tagChip(tag: StateTag): string {
  const rule = tag.rule ? t("tag.slipRule", { rule: tag.rule }) : t("tag.event");
  const slip = infoSlip(tagIcon(tag.id), t(tag.name), t(tag.effect), `${rule} · ${t(tag.until)}`);
  return `<li class="tag-chip ${tag.id}"${infoAttrs(slip)}>${tagIcon(tag.id)}` +
    `<span class="tag-name">${esc(t(tag.name))}</span><small class="tag-until">${esc(t(tag.until))}</small></li>`;
}

/** A tag cited by a log line or a step (Q88): the same marker, its short name; a click shows its effect (Q89). */
export function tagMark(id: TagId): string {
  const slip = infoSlip(tagIcon(id), t(`tag.${id}.short`), t(`tag.${id}.hint`));
  return `<span class="tag-mark ${id}"${infoAttrs(slip)}>${tagIcon(id)}${esc(t(`tag.${id}.short`))}</span>`;
}

export const tagMarks = (ids: readonly TagId[] | undefined) => (ids?.length ? `<span class="tag-marks">${ids.map(tagMark).join("")}</span>` : "");
