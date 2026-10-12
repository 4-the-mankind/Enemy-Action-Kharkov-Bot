// Every text the player reads (task 5.4): templates in en.json, i18next JSON format, so the
// i18next library can take over the same file if more languages come:
//  - {{name}} is a parameter; a parameter may itself be a message (rendered first) or a list
//    (joined with ", ");
//  - plurals: "key_one" / "key_other" (Intl.PluralRules), chosen by the number in {{count}};
//  - keys are nested objects, addressed with dots ("supply.zocCloses").
// The engine never writes sentences: its events carry messages (key + parameters), and the
// interface renders them with t().
import en from "./en.json";
import type { Message, MessageKey, Param } from "./message";

export { msg, type Message, type MessageKey, type Param } from "./message";

const LANG = "en";
const plural = new Intl.PluralRules(LANG);
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
// In tests a missing template or parameter is an error; on the page it stays visible.
const strict = typeof process !== "undefined" && !!process.env?.VITEST;

/** The template of a key (plural form chosen by `count`), or undefined. */
export function template(key: string, count?: number): string | undefined {
  let node: unknown = en;
  const parts = key.split(".");
  for (const p of parts.slice(0, -1)) node = (node as Record<string, unknown>)?.[p];
  const leaves = node as Record<string, unknown> | undefined, last = parts[parts.length - 1];
  const exact = leaves?.[last];
  if (typeof exact === "string") return exact;
  if (count === undefined) return typeof leaves?.[`${last}_other`] === "string" ? (leaves[`${last}_other`] as string) : undefined;
  const form = leaves?.[`${last}_${plural.select(count)}`] ?? leaves?.[`${last}_other`];
  return typeof form === "string" ? form : undefined;
}

/** Parameter names a template uses. */
export const placeholders = (text: string) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);

const isMessage = (p: unknown): p is Message => typeof p === "object" && p !== null && !Array.isArray(p) && "key" in p;

function render(p: Param): string {
  if (Array.isArray(p)) return p.map(render).join(t("list.comma"));
  if (typeof p === "object" && "list" in p) return p.list.map(render).join(t(`list.${p.separator}`));
  return isMessage(p) ? t(p) : String(p);
}

/** The text of a message, or of a key and its parameters. */
export function t(m: Message): string;
export function t(key: MessageKey, params?: Record<string, Param>): string;
export function t(a: Message | MessageKey, b?: Record<string, Param>): string {
  const { key, params = {} } = typeof a === "string" ? { key: a, params: b } : a;
  const count = typeof params.count === "number" ? params.count : undefined;
  const text = template(key, count);
  if (text === undefined) {
    if (strict) throw new Error(`i18n: no text for "${key}".`);
    return key;
  }
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    if (!(name in params)) {
      if (strict) throw new Error(`i18n: "${key}" needs {{${name}}}.`);
      return whole;
    }
    return render(params[name]);
  });
}

/**
 * Fills the static page: data-i18n (text), data-i18n-html (markup kept), and
 * data-i18n-title / data-i18n-aria-label (attributes).
 */
export function applyI18n(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n as MessageKey);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml as MessageKey);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle as MessageKey);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]")) el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel as MessageKey));
}
