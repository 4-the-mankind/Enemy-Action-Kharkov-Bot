// Messages (task 5.4): what the engine and the interface say, as a key of en.json and the
// values of its {{parameters}}. Types only: rendering is i18n.ts (t), so the engine never
// loads the texts.
import type en from "./en.json";

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? K extends `${infer B}_${PluralSuffix}` ? `${P}${B}` : `${P}${K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every key of en.json (plural forms under their base key). */
export type MessageKey = Leaves<typeof en>;
type Item = string | number | Message;
/** A list joined with a separator of en.json ("list.comma" for a plain array). */
export interface ListParam { list: Item[]; separator: "comma" | "semicolon" | "sentence" }
export type Param = Item | Item[] | ListParam;
/** A text to show: its key in en.json and the values of its {{parameters}}. */
export interface Message { key: MessageKey; params?: Record<string, Param> }

/** Builds a message (engine and interface alike). */
export const msg = (key: MessageKey, params?: Record<string, Param>): Message => (params ? { key, params } : { key });

/** Items joined with "; " (items that hold commas themselves). */
export const semicolonList = (list: Item[]): ListParam => ({ list, separator: "semicolon" });
/** Sentences joined with ". " (a detail built from optional parts). */
export const sentences = (parts: Item[]): Message => msg("common.sentences", { parts: { list: parts, separator: "sentence" } });

/** A key built from game data (army token, front, adjustment id…): checked when rendered. */
export const dynamicKey = (key: string) => key as MessageKey;
