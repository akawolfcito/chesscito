# Red Team Review — identity-lite-pr1

**Date**: 2026-06-15
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation

- **[privacy/leak] Truncated `player` is still a wallet on the wire.** The spec
  keeps `LeaderboardRow.player = "0xABCD…1234"` as a "hidden fallback". That is
  still a (partial) raw wallet shipped to every client — the exact thing decision
  #4 wanted to stop. A truncated address is enough to fingerprint/correlate.
  **Resolve:** either drop `player` from the API entirely and key rows by `rank`
  (+ a server-issued opaque `rowId`), or keep it ONLY when the row is the caller's
  own (they already know their wallet). The acceptance test "no 40-hex in body"
  does NOT catch the truncated form — strengthen it to assert no `0x` substring at
  all in non-own rows. Why blocking: contradicts the privacy goal that justified
  the whole server-compute decision.

- **[own-row override] Decision conflict: server nickname vs client custom name on
  own row.** Behavior #9 says the client overrides its own row with the custom
  name, but the leaderboard is sorted/keyed server-side and the own row may also
  arrive via `?player=` (`fetchPlayerRank`). If the override changes only the label
  but the row is also present in the top-10 list, the user can see themselves
  twice with two different names. **Resolve:** define the dedupe/identity key
  (must be wallet-hash, not nickname) and specify that the own-row override mutates
  the single canonical row, not a duplicate. Why blocking: produces a visible
  double-identity bug.

- **[hydration] Guest variant + own custom name cause SSR hydration mismatch.**
  Header/profile render server-side with no localStorage; the client then injects
  guest id / custom name. Without an explicit client-gate this throws React
  hydration errors on the hub (the most-visited screen). The spec mentions it in
  edge cases but no acceptance criterion enforces it. **Resolve:** add an AC: "no
  hydration warning on hub/profile with (a) guest, (b) wallet+custom name" and
  specify the gate (e.g. `useEffect`-set state with a stable first-paint placeholder).
  Why blocking: console-error + potential UI flash on the primary surface.

### P1 — Should address

- **[i18n] `template` ordering is too naive for real locales.** `"{piece}
  {style} #{number}"` assumes adjective/noun order is the only difference. Some
  style words may need gender agreement in ES ("Reina Dorada" vs "Rey Dorado").
  Risk if ignored: grammatically wrong nicknames in ES. **Mitigate:** either pick
  style adjectives that are gender-invariant in ES, or store per-piece ES forms.
  Confirm with the editorial owner; cite `editorial.ts` DISPLAY_NAME_COPY pattern.

- **[determinism] FNV-1a slices are correlated.** Using `h`, `h>>>8`, `h>>>16`
  from one 32-bit hash means piece/style/number are not independent; visually
  clustered seeds can repeat pairs more than random. Risk: uneven distribution,
  many "X Knight" in a small cohort. **Mitigate:** hash three salted seeds
  (`seed+":p"`, `+":s"`, `+":n"`) or use a 64-bit mix. Add a distribution
  sanity test over N synthetic wallets.

- **[backward-compat] `LeaderboardRow.player` consumers.** Removing/changing
  `player` (per P0) breaks `leaderboard-sheet.tsx`, `stats-page.tsx`, and the
  `LeaderboardRow` re-export from the route. Risk: type errors / silent fallbacks.
  **Mitigate:** enumerate every consumer (Explore found 2 surfaces + 1 re-export)
  and update in the same PR; the on-chain `hasOnchain`/`isVerified` flags must
  survive.

- **[scope] Editing nickname is claimed in-scope (behavior #11) but PR1 is
  "read-only".** Wiring `validateNickname` into the existing dialog is an edit
  path. It is low-risk but blurs the PR boundary. Risk: scope creep / reviewer
  confusion. **Mitigate:** explicitly state validation-on-existing-localStorage-edit
  IS in PR1 (no new persistence), and the dialog already exists — confirm this is
  intended, not the PR2 edit modal.

- **[a11y] Avatar has no text alternative spec'd.** `PlayerAvatar` renders an
  image; screen readers need `alt`/`aria-label` (the nickname). Risk: unlabeled
  graphics. **Mitigate:** AC for `aria-label={name}` on the pill and `alt=""`
  (decorative) on the inner sprite when the pill already labels it.

### P2 — Nice to clarify

- **[perf] 6×3 = 18 piece image variants requested across a 10-row leaderboard.**
  `next/image` per cell is fine but verify no layout shift; consider a sprite/CSS
  mask. Minor at 390px.
- **[duplication] Two `truncateWallet` impls** (`display-name.ts` + inline in
  `stats-page.tsx:217`). Good moment to dedupe while touching both files.
- **[guest churn] Guest id regenerates if localStorage is cleared** → new identity
  each time. Acceptable for MVP; note it so it is not reported as a bug later.
- **[header avatar] Extending `ConnectedIdentity` with `variant`** touches a
  primitive guarded by a "growth rule / design-system owner sign-off" comment
  (`global-status-bar.tsx:15`). Flag it explicitly; it is a data-slot addition
  (allowed) not a new variant, but call it out in the PR.

## Categories audited

### Contract gaps
- Types are concrete (no `any`); `NicknameValidation` is a tagged union with
  reasons. `AvatarVariant` fully determines render — good. Gap: no error type for
  the API path (relies on existing 500 handler — acceptable).

### Behavioral ambiguity
- #9 (own-row override) is the main ambiguity → raised P0. Dedupe key undefined.

### Hidden assumptions
- Assumes `PublicStats` is server-built (OQ3) — if any part is client-side from
  `player` strings, those strings are full wallets today; verify before deriving.
- Assumes `w-<piece>` sprites have transparent background suitable for a colored
  disc — verify in visual QA (OQ2).

### Backward compatibility
- `resolveDisplayName` extension is additive + default-preserving → existing unit
  tests stay green. `LeaderboardRow` change is breaking → must update all consumers.

### Security & data
- No new PII store (good — no DB). Main risk is the truncated-wallet leak (P0).
  No rate limit / auth changes. `validateNickname` blocklist is the only input
  boundary and it is client-side only in PR1 (acceptable; real enforcement is PR2).

### Test coverage gaps
- Every AC is testable. Missing ACs added by findings: no-`0x`-in-body (strengthen),
  hydration-clean, a11y label, distribution sanity.

### Operational readiness
- Pure functions + no DB → trivial rollback (revert PR). No new env vars. VR
  baseline refresh is the only deploy-time artifact; follow the project VR
  discipline (clean `.next`, `--update-snapshots`).

## Verdict

**NEEDS REVISION → RESOLVED (READY)** — the 3 P0 findings were folded into the
spec on 2026-06-15:
- P0-1 (truncated-wallet leak): `LeaderboardRow.player` removed; opaque `rowId`
  replaces it as the key; `walletShort` only on the caller's own row. AC asserts
  no `0x` in foreign rows. (Founder confirmed "remove entirely".)
- P0-2 (own-row double identity): dedupe by `rowId`; custom-name override mutates
  the single canonical row.
- P0-3 (hydration): identity components client-gated + stable placeholder; AC
  added.
P1 folded: salted-seed derivation (independent piece/style/number) + distribution
sanity test; a11y label AC. Remaining P1/P2 (i18n gender agreement OQ1, consumer
enumeration, `truncateWallet` dedupe) tracked in-spec for the TDD pass.

**READY for /tdd.**
