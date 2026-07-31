import { describe, expect, it } from "vitest";

import en from "../messages/en";
import es from "../messages/es";

/**
 * `bundle-parity.test.ts` proves ES has every EN *key*. This one proves the
 * values were actually translated — the other half of the same defect, and the
 * one that ships silently: the key resolves, the screen renders, and the only
 * symptom is English copy on a Spanish surface. That is exactly how
 * "Special Trainings" shipped, and `challenge-card-es-parity.test.ts` was the
 * single-namespace answer to it. This is that rule over the whole bundle.
 *
 * The rule is NOT "this key says X" — authored copy moves, and pinning it here
 * would make the test a second place to edit copy. The rule is: no ES value is
 * byte-identical to its EN counterpart once you remove the parts that are
 * supposed to match.
 *
 * Two things are supposed to match, and they are kept apart on purpose:
 *
 *  1. IDENTICAL_TOKENS — vocabulary that is the same string in both languages.
 *     Product names (Chesscito, PRO, Coach), chain names, and a handful of
 *     words Spanish spells the same way (Error, Mate, Coral). This list prunes
 *     itself: it is checked against the copy, not against a key path, so
 *     renaming a key or rewriting a sentence cannot make it stale.
 *
 *  2. NOT_COPY — keys that are not user-facing text at all. They live in the
 *     bundle only because `en.ts` does `{ ...editorial }` without filtering, so
 *     asset paths and CSS tokens became "translatable" by accident. Every entry
 *     here is a bug in the bundle's shape, not a translation decision, and the
 *     real fix is to get them OUT of the bundle. Until then they are named one
 *     by one so nobody "translates" `/art/redesign/pieces/w-rook`.
 */

/** Same string in both languages. Order matters: longest first, so that
 *  "Chesscito PRO" is consumed before "PRO" can nibble at it. */
const IDENTICAL_TOKENS = [
  // Product and brand names. The language brief keeps these in English.
  "Chesscito PRO",
  "Chesscito ID",
  "Chesscito Card",
  "Season Pass",
  "Training Pass",
  "Challenge Pass",
  "Chesscito",
  "Play Kingdom",
  "Mini Arena",
  "Coach",
  "Arena",
  "PRO",
  "Peones",
  "Peón",
  "Focus Stamp",
  "Knight's Tour",
  // Chain + org names.
  "Celo Alfajores",
  "Celo Sepolia",
  "Celo",
  "Den Labs",
  "GitHub Issues",
  "GitHub",
  "Telegram",
  // Language names are written in their own language, on purpose: the switcher
  // has to be readable to someone who cannot read the current locale.
  "English",
  "Español",
  "EN",
  "ES",
  // Loanwords Spanish uses as-is in this product's register.
  "Wallet",
  "HUB",
  "Mate",
  "K+R",
  "Build",
  // Units and notation.
  "pts",
  "tx",
  // Spanish spells these the same way.
  "Error",
  "Coral",
  "Tropical",
] as const;

/** Not user-facing copy. Each of these should eventually leave the bundle. */
const NOT_COPY = new Set([
  // Asset paths. `PIECE_IMAGES` is a path map that got swept in by the spread.
  "PIECE_IMAGES.rook",
  "PIECE_IMAGES.bishop",
  "PIECE_IMAGES.knight",
  "PIECE_IMAGES.pawn",
  "PIECE_IMAGES.queen",
  "PIECE_IMAGES.king",
  // CSS/design tokens consumed as class-name fragments.
  "HERO_CTA_COPY.newPlayer.variant",
  "HERO_CTA_COPY.dailyPending.variant",
  "HERO_CTA_COPY.defaultCaughtUp.variant",
  // A DOM id used by aria-labelledby.
  "HUB_V2_SPLASH_COPY.ariaTitleId",
  // URLs.
  "INVITE_COPY.url",
  "SHARE_COPY.url",
  "ABOUT_COPY.shareUrl",
  "PASSPORT_COPY.passportUrl",
  "SUPPORT_COPY.secondaryChannel.href",
  "SUPPORT_COPY.tertiaryChannel.href",
  "SUPPORT_COPY.tertiaryChannel.value",
  "WHY_PAGE_COPY.sponsors.githubUrl",
  // A handle and a version string.
  "ABOUT_COPY.handle",
  "ABOUT_COPY.version",
]);

/** Empty, and worth keeping empty. It briefly held two kinds of entry, both
 *  resolved on 2026-07-30 by deleting or fixing the thing rather than excusing
 *  it: 30 keys authored in Spanish inside the EN bundle (WHY_PAGE_COPY,
 *  LANDING_COPY and the `landing-cta-bar` ribbon surface — dead code, deleted),
 *  and `HUB_ACTION_RAIL_COPY.mateLabel`, which mirrored a label hardcoded in
 *  `app-mode-switch.tsx` and could not move alone without putting two words for
 *  the same destination on one hub (the switch reads APP_MODE_SWITCH_COPY now).
 *
 *  A new entry here is a promise to come back. Prefer fixing the leak. */
const EXCUSED: string[] = [];

const stripPlaceholders = (value: string): string =>
  value.replace(/\{[^}]*\}/gu, " ");

/** Case-insensitive on purpose: the same product name is written `Arena` in a
 *  sentence and `ARENA` on a button, and both are the same untranslated word. */
const stripIdenticalTokens = (value: string): string => {
  let out = value;
  for (const token of IDENTICAL_TOKENS) {
    out = out.replace(
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"),
      " ",
    );
  }
  return out;
};

/** True when something is left to translate after removing everything that is
 *  supposed to be identical. A single leftover letter is not a word: `"{days}d"`
 *  is a unit suffix, and Spanish abbreviates días the same way. */
const hasTranslatableWords = (value: string): boolean => {
  const remainder = stripIdenticalTokens(stripPlaceholders(value));
  return (remainder.match(/\p{L}/gu) ?? []).length > 1;
};

type Node = Record<string, unknown>;

function collectUntranslated(
  enNode: unknown,
  esNode: unknown,
  prefix: string,
  out: string[],
): void {
  if (typeof enNode === "string") {
    if (
      typeof esNode === "string" &&
      enNode === esNode &&
      hasTranslatableWords(enNode) &&
      !NOT_COPY.has(prefix)
    ) {
      out.push(`${prefix} = ${JSON.stringify(enNode)}`);
    }
    return;
  }
  if (enNode && typeof enNode === "object" && !Array.isArray(enNode)) {
    for (const [key, child] of Object.entries(enNode as Node)) {
      const esChild =
        esNode && typeof esNode === "object" ? (esNode as Node)[key] : undefined;
      collectUntranslated(child, esChild, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

describe("message bundle translation parity — ES must not render English", () => {
  it("leaves no key showing the English string on a Spanish screen", () => {
    const found: string[] = [];
    collectUntranslated(en, es, "", found);
    const untranslated = found.filter((entry) => {
      const path = entry.slice(0, entry.indexOf(" = "));
      return !EXCUSED.some((prefix) => path.startsWith(prefix));
    });

    expect(
      untranslated,
      `ES keys still rendering English:\n  ${untranslated.join("\n  ")}`,
    ).toEqual([]);
  });

  it("only forgives a match when nothing translatable is left", () => {
    // The guard above is only trustworthy if this holds. Otherwise the fix for
    // a real leak would be to "translate" a placeholder, which means nothing.
    expect(hasTranslatableWords("{count}")).toBe(false);
    expect(hasTranslatableWords("Chesscito PRO")).toBe(false);
    expect(hasTranslatableWords("{days} days left")).toBe(true);
    expect(hasTranslatableWords("Special Trainings")).toBe(true);
    // A brand token must not swallow the sentence around it.
    expect(hasTranslatableWords("Open your Coach review")).toBe(true);
  });
});
