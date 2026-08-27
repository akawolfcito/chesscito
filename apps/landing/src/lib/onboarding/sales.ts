/**
 * What the landing is allowed to advertise.
 *
 * ⛔ THE SEASON PASS IS PAUSED, so the landing must not price it. Sales stopped
 * on 2026-08-25: of 18 eligible wallets none ever completed the 21 days, and 10
 * of 17 buyers never recorded a single day. `apps/web` hides the offer behind
 * `isSeasonPassSalesEnabled()`, and `/pricing` never lists it — but slide 2 of
 * this carousel kept showing "21-Day Season Pass · $0.99" to every first-time
 * visitor. A price quoted where nothing can be bought is the worst version of
 * the problem, because the visitor is being asked to remember an offer that
 * will not be there when they look for it.
 *
 * ⚠️ PAUSED, NOT DELETED — deliberately. The banner component, its styles and
 * its strings in both locales all stay exactly where they are. Bringing the
 * pass back is flipping this constant to `false`, not rebuilding a slide. The
 * app's flag works the same way, and for the same reason.
 */
export const SEASON_PASS_SALES_PAUSED = true;
