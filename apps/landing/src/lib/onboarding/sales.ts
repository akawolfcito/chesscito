/**
 * Whether the landing may advertise the Season Pass.
 *
 * ⛔ THE SAME ENV VAR THE APP READS, AND THAT IS THE ENTIRE POINT.
 * `apps/web/src/lib/feature-flags.ts` gates the real sale on
 * `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED`; this reads the same name with the
 * same opt-IN semantics, so ONE decision moves both surfaces.
 *
 * It used to be a hardcoded `SEASON_PASS_SALES_PAUSED = true`. Pausing worked,
 * but RESUMING would not have: flipping the env var in Vercel would have turned
 * the sale back on in the app while this carousel stayed silent forever, with
 * nothing to reveal the mismatch. That is the same gap that let the paused pass
 * keep being quoted here for two days, reintroduced in the opposite direction.
 *
 * Why the pass is paused at all (2026-08-25): of 18 eligible wallets none ever
 * completed the 21 days, and 10 of 17 buyers never recorded a single day.
 *
 * ⚠️ TWO VERCEL PROJECTS, so the variable must be set in BOTH. This does not
 * make the VALUE shared — it makes the NAME and the MEANING shared, so a
 * mismatch is a missing setting somebody can look up rather than a second
 * source of truth living in code nobody remembers to edit.
 *
 * ⚠️ Absence means PAUSED. Anything other than the exact string "true" — unset,
 * empty, "1", "TRUE" — leaves sales off. A flag that decides whether money
 * changes hands must never be switched on by a typo.
 *
 * ⚠️ PAUSED, NOT DELETED. `SeasonPassBanner`, its styles and its strings in
 * both locales stay exactly where they are: bringing the pass back is a setting,
 * not a rebuilt slide.
 *
 * ⛔ `NEXT_PUBLIC_` is correct here and is not a secret leak: it is a boolean
 * about what the UI may show, on a page that is public anyway.
 */
export function isSeasonPassSalesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED === "true";
}
