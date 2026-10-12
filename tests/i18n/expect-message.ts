// Message assertions (task 5.4): a test checks what the engine says, not the wording. A message
// is right when its key is the expected one, its parameters have the expected values, and the
// template of en.json uses exactly those parameters (else a value would be lost or missing).
import { expect } from "vitest";
import { placeholders, t, template, type Message, type MessageKey, type Param } from "../../src/i18n/i18n";

/** Checks a message: its key, the values of the given parameters, and its template. */
export function expectMessage(m: Message | null | undefined, key: MessageKey, params: Record<string, unknown> = {}) {
  expect(m, `expected the message ${key}`).toBeTruthy();
  expect(m!.key).toBe(key);
  const given = m!.params ?? {};
  for (const [name, value] of Object.entries(params)) expect(plain(given[name]), `{{${name}}} of ${key}`).toEqual(plain(value as Param));
  const text = template(key, typeof given.count === "number" ? given.count : undefined)!;
  expect(new Set(placeholders(text)), `parameters of ${key}`).toEqual(new Set(Object.keys(given)));
  t(m!); // renders, nested messages included (strict in tests: no missing text or parameter)
}

/** Parameters compared as plain data: nested messages by key and parameters. */
function plain(p: unknown): unknown {
  return JSON.parse(JSON.stringify(p ?? null));
}

/** The keys of messages, for lists (skipped methods, steps). */
export const keys = (ms: { key: string }[]) => ms.map((m) => m.key);
