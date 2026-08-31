/**
 * The `/dev` catalog — one clickable index of every dev surface.
 *
 * ## Why it exists
 *
 * There are 35 `/dev/*` routes and 16 of them take a `?variant=` (or `?state=`,
 * `?flow=`, `?theme=`) whose accepted values live in a `VARIANTS` Set inside
 * that page. Nothing listed them, so reaching a screen meant knowing a name you
 * could not look up — and the fallback is silent: an unknown variant renders the
 * DEFAULT one. A VR test naming a variant that does not exist photographs the
 * wrong overlay and records a green baseline under the new test's name. That
 * happened on 2026-08-08 and was caught only by opening the PNG.
 *
 * ## What `consumers` is for, and why it is not decoration
 *
 * The founder's question, and the reason this file carries more than routes:
 * *"if I restyle this screen, is it restyled everywhere that uses it?"*
 *
 * The answer is yes for every surface here except the one marked `fork`, because
 * these fixtures mount the PRODUCTION component. But "the change propagates" is
 * not the same as "you can see everything it touches": `arena/victory-popup-shell`
 * has 14 consumers and `scene-rooted/principal-button` has 18. Restyling either
 * from a single fixture moves screens you never opened. `consumers` puts that
 * blast radius on screen BEFORE the edit, instead of leaving it to be discovered
 * in a flow nobody thought to walk.
 *
 * ⚠️ A fixture mounts the real component but may pass it FEWER props than
 * production does — so the CHANGE always propagates, while what you SEE here can
 * be one state short of what ships ([[feedback_a_fixture_photographs_less_than_ships]]).
 *
 * ## The drift rule
 *
 * This list is declared, not derived: `src/` does not exist in a serverless
 * runtime, so a page cannot read the filesystem to build itself. Every field is
 * instead PINNED BY A TEST that re-derives it from the source
 * (`__tests__/dev-catalog.test.ts`) — routes, variants, mounted components and
 * consumers all fail the suite the moment they diverge. Same contract as
 * `scripts/check-dev-probes.sh`, except this one runs in vitest, so it cannot be
 * forgotten the way that script was (it sat 8 routes stale for months).
 */

/** How the index groups surfaces. Order here is the order on screen. */
export const DEV_GROUPS = [
  "exercises",
  "arena",
  "hub",
  "coach",
  "payments",
  "chips",
  "boards",
  "tools",
  "probes",
] as const;

export type DevGroup = (typeof DEV_GROUPS)[number];

export type DevSurface = {
  /** Route under /dev, without the prefix — "exercises-popups". */
  readonly id: string;
  /** Human name for the index. */
  readonly title: string;
  readonly group: DevGroup;
  /** One line on what the surface is for. */
  readonly blurb: string;
  /** Query param that switches states, when the page reads one. */
  readonly param?: string;
  /** Accepted values for `param`. Pinned against the page's own Set. */
  readonly options?: readonly string[];
  /** Production components the fixture mounts, as `@/components/<path>`. */
  readonly mounts?: readonly string[];
  /**
   * Production files that import those components — the blast radius of a
   * style edit made from this surface. Pinned against a real import scan.
   */
  readonly consumers?: readonly string[];
  /**
   * Set when the fixture renders its OWN copy instead of the shipped
   * component. An edit made here does NOT reach players.
   */
  readonly fork?: string;
  /** Set when opening the page does something beyond rendering. */
  readonly sideEffect?: string;
};

/**
 * Surfaces that render UI a player actually sees. These are the ones worth
 * restyling from, and the only ones the index gives a preview pane.
 */
export const DEV_SCREENS: readonly DevSurface[] = [
  // ── exercises ──────────────────────────────────────────────────────────
  {
    id: "exercises-popups",
    title: "Exercise popups",
    group: "exercises",
    blurb: "Every overlay the exercises screen can raise, one per variant.",
    param: "variant",
    options: [
      "piece-complete-final",
      "piece-complete-next",
      "piece-complete-badge-waiting",
      "piece-complete-keep-practicing",
      "labyrinth-king-solved",
      "labyrinth-consequence-worst-case",
      "labyrinth-minigame-complete",
      "score-saved",
      "score-saved-peones",
      "saved-chip",
      "save-cta",
      "reward-dual",
      "result-badge",
      "result-shop",
      "result-error",
    ],
    mounts: [
      "exercises/result-overlay",
      "exercises/labyrinth-complete-overlay",
      "exercises/saved-chip",
      "exercises/contextual-action-slot",
      "redesign/action-pin",
    ],
    consumers: [
      "components/exercises/contextual-action-slot.tsx",
      "components/exercises/exercises-screen.tsx",
    ],
  },
  {
    id: "inbox",
    title: "Inbox",
    group: "hub",
    blurb: "The Inbox with its three seed messages and no database behind it.",
    mounts: ["inbox/inbox-screen"],
    consumers: ["app/[locale]/inbox/inbox-client.tsx"],
  },
  {
    id: "rescue-modal",
    title: "Fail rescue modal",
    group: "exercises",
    blurb: "The four shield-rescue copies. Also takes ?shields=<n>.",
    param: "variant",
    options: ["A", "B", "C", "D"],
    mounts: ["exercises/fail-rescue-modal"],
    consumers: ["components/exercises/exercises-screen.tsx"],
  },
  {
    id: "phase-flash",
    title: "Phase flash",
    group: "exercises",
    blurb: "The completion flash — what an exercise raises instead of a modal.",
    param: "variant",
    options: ["success-plain", "success-consequence"],
    mounts: ["exercises/mission-panel-candy"],
    consumers: ["components/exercises/exercises-screen.tsx"],
  },

  // ── arena ──────────────────────────────────────────────────────────────
  {
    id: "arena-end-state",
    title: "Arena end state",
    group: "arena",
    blurb: "Every terminal state of a match, claim and save flows included.",
    param: "variant",
    options: [
      "resigned",
      "checkmate",
      "stalemate",
      "draw",
      "coach-cta-enabled",
      "coach-cta-disabled-short",
      "coach-cta-disabled-persisting",
      "win-celebration",
      "win-claiming",
      "win-success",
      "win-error",
      "win-timeout",
      "loss-save",
      "loss-save-claiming",
      "loss-save-success",
      "loss-save-error",
    ],
    mounts: ["arena/arena-end-state"],
    consumers: ["app/[locale]/arena/page.tsx"],
  },
  {
    id: "arena-rails",
    title: "Arena rails",
    group: "arena",
    blurb: "The player/rival rails either side of the board.",
    param: "variant",
    options: ["rival-idle", "rival-thinking", "you-active", "you-no-meta", "rails-pro"],
    mounts: ["arena/arena-player-rail"],
    consumers: ["app/[locale]/arena/page.tsx"],
  },
  {
    id: "arena-shields-chip",
    title: "Arena shields chip",
    group: "arena",
    blurb: "The shields counter inside the arena HUD.",
    mounts: ["arena/arena-hud"],
    consumers: ["app/[locale]/arena/page.tsx"],
  },
  {
    id: "persist-overlay",
    title: "Persist overlay",
    group: "arena",
    blurb: "The saving overlay over the arena end state.",
    param: "state",
    options: ["idle", "persisting", "persisted", "failed", "dismissed"],
    mounts: ["arena/arena-end-state"],
    consumers: ["app/[locale]/arena/page.tsx"],
  },
  {
    id: "tx-progress",
    title: "Tx progress steps",
    group: "arena",
    blurb: "The step rail every on-chain flow shows. Takes ?flow= and ?current=.",
    param: "flow",
    options: ["save-score", "claim-badge", "mint-victory", "shop-buy", "pro-buy"],
    mounts: ["redesign/tx-progress-steps"],
    consumers: [
      "app/[locale]/arena/page.tsx",
      "components/welcome-package/welcome-package-modal.tsx",
      "components/exercises/exercises-screen.tsx",
      "components/arena/arena-end-state.tsx",
    ],
  },

  // ── hub ────────────────────────────────────────────────────────────────
  {
    id: "learn-hub",
    title: "Learn hub",
    group: "hub",
    blurb: "The whole Learn hub, including the mini-games section.",
    param: "variant",
    options: ["guest", "habit", "active", "pro", "completed"],
    mounts: [
      "hub/hub-lite-scaffold",
      "hub/challenge-card",
      "inbox/inbox-trigger",
      "hub/hub-daily-trigger",
      "hub/minigames-section",
      "kingdom/reward-column",
    ],
    consumers: [
      "components/hub/hub-daily-tile.tsx",
      "components/hub/hub-lite-scaffold.tsx",
      "components/hub/hub-scaffold.tsx",
      "components/hub/learn-hub-client.tsx",
      "components/hub/learn-path-entry.tsx",
      "components/hub/minigames-slot.tsx",
      "components/inbox/inbox-chip.tsx",
      "components/payments/season-pass-celebration.tsx",
    ],
  },
  {
    id: "play-hub",
    title: "Play hub",
    group: "hub",
    blurb: "The Play side of the mode switch.",
    param: "variant",
    options: ["guest", "connected", "pro"],
    mounts: [
      "hub/play-hub-scaffold",
      "hub/hub-daily-trigger",
      "inbox/inbox-trigger",
    ],
    consumers: [
      "components/hub/hub-daily-tile.tsx",
      "components/hub/play-hub-client.tsx",
      "components/inbox/inbox-chip.tsx",
    ],
  },
  {
    id: "challenge-card",
    title: "Challenge card",
    group: "hub",
    blurb: "The daily challenge card.",
    mounts: ["hub/challenge-card"],
    consumers: [
      "components/payments/season-pass-celebration.tsx",
      "components/hub/hub-lite-scaffold.tsx",
    ],
  },

  // ── coach ──────────────────────────────────────────────────────────────
  {
    id: "coach-viewer",
    title: "Coach viewer",
    group: "coach",
    blurb: "The reviewed-game viewer, with and without hints.",
    param: "variant",
    options: [
      "viewer-win-unminted",
      "viewer-win-minted",
      "viewer-loss",
      "viewer-partial-replay",
      "viewer-win-credits-hint",
      "viewer-win-pro-hint",
    ],
    mounts: ["coach/game-viewer", "coach/game-actions-bar"],
    consumers: ["app/[locale]/coach/[gameId]/coach-game-client.tsx"],
  },
  {
    id: "coach-history",
    title: "Coach history",
    group: "coach",
    blurb: "The reviewed-games list. Takes ?credits=<n>.",
    param: "credits",
    mounts: ["coach/coach-history"],
    consumers: [
      "app/[locale]/coach/history/page.tsx",
      "app/[locale]/arena/page.tsx",
    ],
  },

  // ── payments ───────────────────────────────────────────────────────────
  {
    id: "season-pass-celebration",
    title: "Season pass celebration",
    group: "payments",
    blurb: "The purchase celebration. The model every other fixture imitates.",
    param: "variant",
    options: ["credited", "pending"],
    mounts: ["payments/season-pass-celebration", "arena/victory-popup-shell"],
    // ⚠️ 14 files. victory-popup-shell is the chrome behind nearly every
    // celebration in the app — restyling it from here moves all of these.
    consumers: [
      "app/[locale]/arena/page.tsx",
      "components/arena/arena-confirm-modal.tsx",
      "components/daily/streak-nudge-screen.tsx",
      "components/duel/duel-end-overlay.tsx",
      "components/exercises/exercises-screen.tsx",
      "components/exercises/labyrinth-complete-overlay.tsx",
      "components/exercises/result-overlay.tsx",
      "components/hub/language-chip.tsx",
      "components/mini-arena/mini-arena-result-ceremony.tsx",
      "components/payments/get-peones-sheet.tsx",
      "components/payments/season-pass-sheet.tsx",
      "components/progression/unlock-overlay.tsx",
      "components/welcome-package/first-focus-day-overlay.tsx",
      "components/welcome-package/welcome-package-modal.tsx",
    ],
  },
  {
    id: "victory-landing",
    title: "Victory landing",
    group: "payments",
    blurb: "The shared victory card — the page a link opens to.",
    param: "variant",
    options: ["easy", "medium", "hard"],
    mounts: ["victory/victory-landing-card"],
    consumers: ["app/[locale]/victory/[id]/page.tsx"],
  },

  // ── chips ──────────────────────────────────────────────────────────────
  {
    id: "peones-chip",
    title: "Peones chip",
    group: "chips",
    blurb: "The Peones balance chip, present on nearly every screen.",
    param: "variant",
    options: ["balance", "earn", "spend"],
    mounts: ["peones/peones-balance-chip"],
    consumers: [
      "app/[locale]/arena/page.tsx",
      "components/exercises/exercises-screen.tsx",
      "components/hub/play-hub-scaffold.tsx",
      "components/hub/hub-scaffold.tsx",
      "components/hub/hub-lite-scaffold.tsx",
    ],
  },
  {
    id: "pro-chip",
    title: "PRO chip",
    group: "chips",
    blurb: "The PRO badge, active and inactive.",
    param: "variant",
    options: ["active", "inactive"],
    mounts: ["hub/hub-pro-badge"],
    consumers: [
      "components/kingdom/kingdom-card.tsx",
      "components/hub/hub-scaffold.tsx",
    ],
  },
  {
    id: "chesito-card",
    title: "Chesito card",
    group: "chips",
    blurb: "The Peones detail card behind the chip.",
    mounts: ["peones/chesito-card"],
    consumers: [
      "components/peones/peones-balance-chip.tsx",
      "components/account/account-sheet.tsx",
    ],
  },
  {
    id: "button-gallery",
    title: "Button gallery",
    group: "chips",
    blurb: "Every button style at once. Principal-button alone has 18 consumers.",
    mounts: ["scene-rooted/principal-button"],
    consumers: [
      "app/[locale]/coach/history/page.tsx",
      "app/[locale]/victory/[id]/accept-challenge-button.tsx",
      "components/welcome-package/welcome-package-modal.tsx",
      "components/welcome-package/first-focus-day-overlay.tsx",
      "components/payments/season-pass-sheet.tsx",
      "components/payments/get-peones-sheet.tsx",
      "components/pro/pro-active-cta.tsx",
      "components/pro/pro-sheet.tsx",
      "components/trophies/trophies-body.tsx",
      "components/daily/streak-nudge-screen.tsx",
      "components/redesign/action-pin.tsx",
      "components/exercises/result-overlay.tsx",
      "components/exercises/exercises-screen.tsx",
      "components/exercises/labyrinth-complete-overlay.tsx",
      "components/exercises/mission-briefing.tsx",
      "components/progression/unlock-overlay.tsx",
      "components/mini-arena/mini-arena-result-ceremony.tsx",
      "components/hub/language-chip.tsx",
    ],
  },

  // ── boards (lane 2) ────────────────────────────────────────────────────
  {
    id: "safe-path",
    title: "Safe Path board",
    group: "boards",
    blurb: "Authoring surface: the game does not draw guarded zones, this does.",
    mounts: ["exercises/safe-path-board"],
    consumers: ["components/exercises/exercises-screen.tsx"],
  },
  {
    id: "promotion-run",
    title: "Promotion Run board",
    group: "boards",
    blurb: "Authoring surface. Draws guarded zones LIVE — they die on capture.",
    mounts: ["exercises/promotion-run-board"],
    consumers: ["components/exercises/exercises-screen.tsx"],
  },
  {
    id: "knight-tour",
    title: "Knight's Tour board",
    group: "boards",
    mounts: ["exercises/knight-tour-board"],
    blurb: "The real lane-2 knight board.",
    consumers: ["components/exercises/exercises-screen.tsx"],
  },
  {
    id: "queens",
    title: "N-Queens board",
    group: "boards",
    blurb: "The real lane-2 queens board.",
    mounts: ["exercises/queens-board"],
    consumers: ["components/exercises/exercises-screen.tsx"],
  },
  {
    id: "diagonal-run",
    title: "Diagonal Run board",
    group: "boards",
    blurb: "⛔ A COPY. Restyling here changes nothing a player sees.",
    fork: "components/dev/diagonal-run-spike.tsx — a forked spike, not the shipped board. Two implementations with nothing syncing them; edit the real board instead.",
  },
];

/**
 * Tools and chain probes. No preview pane: these write, sign or send, so the
 * index links out rather than mounting them in an iframe.
 */
export const DEV_TOOLS: readonly DevSurface[] = [
  {
    id: "labyrinth-builder",
    title: "Labyrinth builder",
    group: "tools",
    blurb: "Authors the lane-2 content.",
    sideEffect: "Writes content/*.json through api/dev/* (local only).",
  },
  {
    id: "theme-builder",
    title: "Theme builder",
    group: "tools",
    blurb: "Theme slot authoring. Takes ?theme=<id>.",
    param: "theme",
    sideEffect: "Writes theme assets (local only).",
  },
  {
    id: "board-procedural",
    title: "Board procedural",
    group: "tools",
    blurb: "⚠️ The only route still gated on NODE_ENV — 404s in preview.",
  },
  {
    id: "reset",
    title: "Reset local state",
    group: "tools",
    blurb: "A clean local client for the SAME remote identity — not a new account.",
    sideEffect:
      "Deletes every chesscito* key from localStorage. Leaves badges and Peones untouched, so it can produce badgeClaimed:true with stars:0 — a profile no real player has.",
  },
  {
    id: "duel-link-probe",
    title: "Duel link probe",
    group: "probes",
    blurb: "Duel invite links.",
  },
  {
    id: "rail-smoke",
    title: "Payment rail smoke",
    group: "probes",
    blurb: "Exercises the payment rail.",
    sideEffect: "Touches the payment rail.",
  },
  {
    id: "permit-probe",
    title: "Permit probe",
    group: "probes",
    blurb: "ERC-2612 permit signing.",
    sideEffect: "SIGNS with the connected wallet.",
  },
  {
    id: "sign-probe",
    title: "Sign probe",
    group: "probes",
    blurb: "Raw message signing.",
    sideEffect: "SIGNS with the connected wallet.",
  },
  {
    id: "tx-error-probe",
    title: "Tx error probe",
    group: "probes",
    blurb: "Exposed MiniPay's real error shape.",
    sideEffect: "SENDS real transactions.",
  },
  {
    id: "minipay-raw-send",
    title: "MiniPay raw send",
    group: "probes",
    blurb: "Raw eth_sendTransaction against MiniPay.",
    sideEffect: "SENDS real transactions.",
  },
  {
    id: "minipay-no-approve-poc",
    title: "MiniPay no-approve PoC",
    group: "probes",
    blurb: "Spend without a separate approve.",
    sideEffect: "SENDS real transactions.",
  },
];

/** Every catalogued surface, screens first. */
export const DEV_CATALOG: readonly DevSurface[] = [...DEV_SCREENS, ...DEV_TOOLS];

/** `/dev/exercises-popups?variant=score-saved` for a surface + option. */
export function devSurfaceHref(surface: DevSurface, option?: string): string {
  const base = `/dev/${surface.id}`;
  return option && surface.param
    ? `${base}?${surface.param}=${encodeURIComponent(option)}`
    : base;
}
