import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("theme runtime catalog coverage", () => {
  it("keeps every active catalog slot on the resolver", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/audit-theme-runtime-coverage.mjs", "--check"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "../../docs/audits/2026-07-18-theme-runtime-inventory.json"),
        "utf8",
      ),
    );
    // The audit scopes itself to slots the web app owns. The landing.* slots
    // render in apps/landing, so they are excluded here and covered by
    // landing-assets.test.ts instead.
    // 167 = 162 + the three Focus Passport flames + the Season Pass story
    // arrow (cataloged 2026-07-22) + coach.share-trophy, the dedicated Match
    // Review share icon split off shared.trophy-epic (2026-07-22).
    // 168 (2026-07-23): + payments.offer-bg, the dedicated Season Pass offer
    // sheet background. Consumed as a CSS background, so it counts as excluded
    // (excludedSlots 12 → 13), not a new resolver slot (connectedSlots stays 155).
    // 169 (2026-07-23): + board.blocker.stone, the exercise obstacle art.
    // Consumed via the resolver (useCurrentThemeAsset) in board.tsx +
    // diagonal-run-board.tsx, so it lands in category A: connectedSlots 155 →
    // 156, initial B 72 → 73, excludedSlots unchanged.
    // 171 (2026-07-25): + bg.login-learn / bg.login-play, the web access gate
    // wallpapers. Emitted through the resolver by WebAccessThemeVariables (which
    // mounts above the gate, where the app-wide ThemeCssVariables cannot reach),
    // so both land in category A: connectedSlots 156 → 158, initial B 73 → 75,
    // excludedSlots unchanged.
    // 172 (2026-07-25): + brand.title-login, the wordmark inside the Privy
    // login modal, carved off brand.title so a Replace can move one without the
    // other. Consumed via the resolver in web-wallet-provider.tsx, so it lands
    // in category A: connectedSlots 158 → 159, initial B 75 → 76, excludedSlots
    // unchanged.
    // 173 (2026-07-25): + hub.focus-passport-calendar, independently editable
    // from the other ChallengeCard benefits. Resolver-connected: A 159 → 160,
    // initial B 76 → 77.
    // 177 (2026-07-26): + Arena Warm-up and three KingdomCard benefit slots.
    // All four are resolver-connected PLAY assets: A 160 → 164, initial
    // B 77 → 81.
    // 178 (2026-07-26): + shared.tour-help. The tour reuses the established
    // shared.close mission control; shared.close-candy remains cataloged for
    // CandyIcon's composed-path vocabulary.
    // 181 (2026-07-28): + the three mini-tour PRO benefit slots. Own slots on
    // purpose: the KingdomCard trio they replaced describes hub navigation,
    // not what PRO buys, and reusing it rendered the same strip on the tour's
    // context step and its sale step. Resolver-connected via TileIconSlot:
    // A 164 → 167, initial B 82 → 85.
    // 180 (2026-07-29): − daily.welldone. The retired art baked an English
    // headline into a picture; the Daily celebration renders live text now,
    // so the slot lost its only consumer: A 167 → 166, initial B 85 → 84.
    // 183 (2026-08-15): + los tres arena.duel-lobby-*, que el duelo resuelve
    // por useThemeAsset y muestra solo si tienen archivo.
    expect(report.totalSlots).toBe(183);
    expect(report.initialCategoryCounts).toEqual({
      A: 2,
      B: 87,
      C: 26,
      D: 38,
      E: 19,
      F: 11,
      G: 0,
    });
    // 170 (2026-08-15): + los tres arena.duel-lobby-*, conectados por
    // useThemeAsset desde useDuelLobbySlides.
    expect(report.connectedSlots).toBe(170);
    expect(report.excludedSlots).toBe(13);
    expect(
      report.slots.filter(
        (slot: { category: string; currentConsumerState: string }) =>
          slot.category !== "F" && slot.currentConsumerState !== "resolver",
      ),
    ).toEqual([]);
    // Empty on purpose: an "exception" is an asset nobody can replace from
    // the builder. All three former ones are registered slots now.
    expect(report.exceptions).toEqual([]);
    // No `/art/...` literal in the source resolves to a real file that no
    // slot declares — the catalog covers the web app with nothing left over.
    expect(report.literalDiff.unregisteredExistingAssets).toEqual([]);
  }, 20_000);
});
