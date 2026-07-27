import { describe, expect, it } from "vitest";
import en from "@/lib/content/messages/en";
import es from "@/lib/content/messages/es";

/** The ES bundle spreads `...en.CHALLENGE_CARD_COPY` and overrides key by key.
 *  That spread is what makes a missing translation SILENT: the key resolves,
 *  the sheet renders, and the only symptom is English copy on a Spanish
 *  screen — exactly how "Special Trainings" shipped.
 *
 *  The rule under test is not "this key says X" (authored copy moves), it is
 *  "no ES value is byte-identical to its EN counterpart". The one legitimate
 *  collision is a value with nothing to translate: `"{count}"`, `"+{count}"`,
 *  `"{day}: {state}"` are pure placeholders and punctuation, and are supposed
 *  to match. That is decided by looking at the string, not by an allowlist that
 *  someone has to remember to prune. */
const hasTranslatableWords = (value: string): boolean =>
  /\p{L}/u.test(value.replace(/\{[^}]*\}/gu, ""));

describe("ES challenge-card copy is actually translated", () => {
  it("leaves no key rendering the English string", () => {
    const enCopy = en.CHALLENGE_CARD_COPY as Record<string, unknown>;
    const esCopy = es.CHALLENGE_CARD_COPY as Record<string, unknown>;

    const untranslated = Object.keys(enCopy).filter((key) => {
      const enValue = enCopy[key];
      const esValue = esCopy[key];
      if (typeof enValue !== "string" || typeof esValue !== "string") return false;
      return enValue === esValue && hasTranslatableWords(enValue);
    });

    expect(untranslated, `ES keys still showing English: ${untranslated.join(", ")}`).toEqual([]);
  });

  it("ignores values that are pure placeholders", () => {
    // The guard above is only trustworthy if this holds: otherwise the fix for
    // a real leak would be to "translate" `{count}`, which means nothing.
    expect(hasTranslatableWords("{count}")).toBe(false);
    expect(hasTranslatableWords("+{count}")).toBe(false);
    expect(hasTranslatableWords("{day}: {state}")).toBe(false);
    expect(hasTranslatableWords("{days} Days")).toBe(true);
    expect(hasTranslatableWords("Special Trainings")).toBe(true);
  });
});
