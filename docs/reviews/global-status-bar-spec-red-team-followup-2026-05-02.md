# `<GlobalStatusBar />` — Spec Re-Review (2026-05-02, follow-up)

> **Reviewer**: Adversary (re-review, 15-min focused pass; no investment in author's prior decisions).
> **Subject spec**: `docs/specs/ui/global-status-bar-spec-2026-05-02.md` after v1 amendment.
> **Amendment commit**: `ed9f7c5` — `docs(specs): harden GlobalStatusBar contract after red-team`.
> **Prior red-team review**: `docs/reviews/global-status-bar-spec-red-team-2026-05-02.md` (commit `4c5beb9`).
> **Method**: Verify each P0 from the prior review was actually closed (not just claimed), check rule consistency, stress-test P0-6 enforcement, audit carry-forward concreteness, sample-check 2 P1s, look for new regressions. Format mirrors `contextual-header-spec-red-team-followup-2026-05-01.md`.
> **Scope**: Spec only — no code yet.

---

## Verdict

**Approve with minor notes.**

All 6 P0 items are closed strictly enough to unblock implementation commit #1. The §5 growth rule reads cleanly across §3, §5, and §12 — no contradictions remain. The P0-6 four-layer enforcement is the strongest of the three Sally specs to date (Z2 had soft escalation, Z1 v1 has greppable trailer + automatic day-61 hard-close + named owner). The §17 carry-forward triggers are mostly concrete; one is soft but acceptable. P1 sample-check (P1-2 + P1-4) confirms both close cleanly.

Minor notes (none blocking):

1. **Spec front-matter still reads `Status: v0 — draft, awaiting red-team review.`** at line 5 — inconsistent with the amendment log claim "v0 → v1 amendment applied 2026-05-02." One-line typo, fix in commit #1.
2. **§12 risks row #2 (`onProTap` becomes load-bearing)** still uses the v0 phrase "Set a 60-day **soft** deadline … if Shop PRO sub-section hasn't shipped by then, **escalate**." This row should now point to §6.1's hard 4-layer enforcement instead of the old soft-escalation language. As written it contradicts the §6.1 row 1 hard-close rule. Fix in commit #1 (one sentence).
3. **§16 Q2 ("Is `onProTap` strictly necessary…")** is still listed as an open question for "the next reviewer." This is the post-red-team spec — the question has been answered (yes, kept; debt tracked with hard 4-layer enforcement). Leaving it as an open Q invites a future reviewer to re-litigate. Fix or annotate in commit #1.

None of these are P0/P1 contract or geometry blockers. Implementation commit #1 may start in parallel with rolling these into the same PR.

---

## Section A — P0 closure

### P0-1. Discriminated-union spread escape

- **Original defect** (paraphrase from prior review §2 P0-1):
  > "TypeScript does not narrow spread props against a discriminated union when the source object's declared type is wider than the literal."
- **Where the amendment claims to close it**: §5 lines 134–150 (TS coverage disclaimer + spread example) + §6 runtime-guard table line 171 (new "Spread-prop escape" row).
- **Does it actually close**: yes.
- **Evidence**:
  - §5 line 142 quotes:
    > "Important: TypeScript does NOT block discriminated-union escapes via spread props. Excess-property checks fire on inline literals only. A caller that builds the object first and spreads it bypasses the check"
  - §5 line 150: "The spec does not claim the type system is sufficient. Runtime guards in §6 are the safety net."
  - §6 line 171 row 1 specifies the literal trigger condition (`Object.hasOwn(props, key)` for any of `identity | proStatus | isProLoading | onProTap` when `variant === "anonymous"`) and the runtime-narrow behavior ("destructuring **only** the fields valid for the matched variant; extra keys are dropped, not honored").
  - The honesty fix is exactly what the prior review asked for: stop claiming TS catches the escape, and add the runtime guard. Better than the v1 ContextualHeader fragment claim, which was still over-claimed in the previous follow-up review.

### P0-2. Variant-explosion vs §3/§11/§12 contradiction

- **Original defect**: "§3 / §11 / §12 contradicted each other on whether new data slots arrive via new variants or new typed props."
- **Where the amendment claims to close it**: §5 lines 152–156 (single growth rule) + §3 line 50 (rewritten last bullet) + §12 line 320 (risks row #1 mitigation rewritten).
- **Does it actually close**: yes.
- **Evidence**:
  - §5 line 154 — single rule, quoted verbatim:
    > "Variants are reserved for structural layout differences only (today: anonymous vs connected — the wrapper renders different cluster geometry). Data slots (level, streak, currency, achievements, etc.) added in v2+ land as typed props on ConnectedProps, not as new variants."
  - §3 line 50: "v2+ may add a `level` slot **as a typed prop on `ConnectedProps`** (per the §5 growth rule — variants are for layout, not data)."
  - §12 line 320: "**Single rule** (per §5 growth rule): variants are reserved for structural layout differences (e.g., anonymous vs connected). Data slots (level, streak, currency) added in v2+ land as **typed props on ConnectedProps**, not as new variants."
  - All three sections now point to the same rule. The escape clause "new variant requires written justification + design-system owner sign-off" is consistent across §5 and §12.
  - See Section B for full quotes verifying consistency.

### P0-3. `--redesign-wood-gold` semantic-coupling bomb

- **Original defect**: "Reusing `--redesign-wood-gold` for an identity ring means a future palette shift on candy wood silently retints every PRO ring across every screen."
- **Where the amendment claims to close it**: §11 acceptance #3 (line 304) + §15 commit #1 line 416 + §16 Q12 line 487.
- **Does it actually close**: yes.
- **Evidence**:
  - §11 #3 line 304:
    > "**a single new token committed in commit #1**: `--pro-ring-gold: #FDD257`. **Reuse of `--redesign-wood-gold` is rejected** — that token is named after candy-game wood chrome, and reusing it for an identity ring would silently retint every PRO ring across every screen if the candy palette ever shifts."
  - §15 commit #1 line 416: "adds `--pro-ring-gold: #FDD257` to `globals.css` and documents it in `DESIGN_SYSTEM.md` §1 as the canonical premium-state gold (per acceptance §11 #3). No inline color literals; component reads only the variable. The decision to NOT reuse `--redesign-wood-gold` is intentional"
  - §16 Q12 line 487 rewritten: "Acceptance §11 #3 commits a new `--pro-ring-gold` token (rejecting reuse of `--redesign-wood-gold`)."
  - The mid-implementation decision branch is gone. Token is committed up front in commit #1. No "reuse first / fall back if visual review rejects" two-path language remains anywhere.
  - One residual P2-class note: the prior review also flagged that `amber-*` Tailwind palette is not mentioned. The amendment doesn't address it. Not a blocker for this re-review (it was P2 in the original); flagged only as a potential carry-forward for the v1 amendment of the contributor docs.

### P0-4. Dropping `mr-[140px]` would break ContextualHeader E2E geometry

- **Original defect**: "The existing `apps/web/e2e/contextual-header.spec.ts` asserts `box.height >= 51 && <= 65`; dropping `mr-[140px]` changes Z2 wrapper width 242→382px and the spec was silent on whether geometry assertions need updates."
- **Where the amendment claims to close it**: §15 commit #2 lines 438–441 ("Geometry subtasks (mandatory — dropping `mr-[140px]` is NOT neutral)").
- **Does it actually close**: yes.
- **Evidence**:
  - §15 line 439:
    > "Update `apps/web/e2e/contextual-header.spec.ts` assertions for the new Z2 wrapper width (382px content area, was 242px). The existing height-envelope assertion at lines 32–35 (`>= 51 && <= 65`) MUST continue to pass — re-baseline the assertion only if the rendered height **stays inside the 52–64px envelope**. The board-placement assertion at lines 99–122 (board y >= header y + header height − 1) MUST continue to pass."
  - §15 line 440 — explicit halt condition:
    > "**Halt condition**: if the canary build pushes Z2 height outside the 52–64px envelope OR if Z3/Z4/Z5 dimensions drift beyond ±2px from baseline, **the canary is wrong** — stop, refactor the wrapper (e.g., re-introduce a smaller right padding), do not blanket-update assertions to make red tests green."
  - §15 line 441 — new regression assertion in `global-status-bar.spec.ts`.
  - The "do not blanket-update assertions to make red tests green" line is the right anti-pattern guardrail. This closes cleanly.

### P0-5. Type-B destination sheets cover Z1 — re-render silent

- **Original defect**: "DESIGN_SYSTEM.md §8 specifies Type-B sheets render at h-[100dvh] covering Z1; spec was silent on whether Z1 re-renders inside them."
- **Where the amendment claims to close it**: §2 visibility table lines 32–33 (two new rows: Type-B sheets + Type-A overlays) + §3 non-goals line 56 (nested status bars).
- **Does it actually close**: yes.
- **Evidence**:
  - §2 line 32:
    > "**Z1 is NOT rendered inside Type-B sheets in v1.** Type-B sheets are `h-[100dvh]` per `DESIGN_SYSTEM.md` §8 and cover the entire viewport including Z1. Identity persistence inside Type-B sheets is **NOT a v1 goal** … A future spec may introduce a separate `<SheetHeader />` primitive … The §6 duplicate-instance dev warning fires if a Type-B sheet imports `<GlobalStatusBar />` directly."
  - §2 line 33 (Type-A overlays): "Z1 visibility decided per route in that route's migration commit. v1 canary does not mount Z1 here." — closes the `/arena` mid-match question too.
  - §3 line 56: "No nested status bars. … Type-B destination sheets do not render Z1 inside themselves (per §2 visibility row). Identity persistence inside sheets is explicitly out of scope for v1; a future `<SheetHeader />` primitive may address it."
  - Both ambiguous cases (Type-B sheets + Type-A overlays) are explicitly answered. Implementer cannot mistakenly mount Z1 inside a sheet without firing the §6 duplicate-instance dev warning.

### P0-6. `onProTap` 60-day deadline enforcement

- **Original defect**: "60-day deadline had no named owner, no escalation channel, no calendar artifact."
- **Where the amendment claims to close it**: §6.1 line 187 (4-layer enforcement column rewritten).
- **Does it actually close**: yes.
- **Evidence**: see Section C for layer-by-layer verification. The 4-layer enforcement is cited in full in §6.1 row 1.
  - **However**: §12 risks row #2 (line 321) still uses the v0 soft-escalation phrasing ("60-day **soft** deadline … if Shop PRO sub-section hasn't shipped by then, **escalate**"). This contradicts the §6.1 hard-close rule and is a Section F new defect. Not enough to fail the P0 (the load-bearing copy is in §6.1, not §12), but flagged below.

**P0 status counts**: 6 closed / 0 partial / 0 not closed.

---

## Section B — Rule consistency

The single growth rule must read consistently across §3, §5, and §12. Verified verbatim quotes:

**§3 (non-goals, line 50)**:
> "v2+ may add a `level` slot **as a typed prop on `ConnectedProps`** (per the §5 growth rule — variants are for layout, not data), after a product spec defines the level math."

**§5 (single rule, line 154)**:
> "**Variants are reserved for structural layout differences only** (today: `anonymous` vs `connected` — the wrapper renders different cluster geometry). **Data slots** (level, streak, currency, achievements, etc.) added in v2+ land as **typed props on `ConnectedProps`**, not as new variants. Adding a new variant requires a written justification in a spec PR + design-system owner sign-off; 'we have a new piece of data to show' is **not** a justification."

**§12 (risks row #1 mitigation, line 320)**:
> "**Single rule** (per §5 growth rule): variants are reserved for structural layout differences (e.g., `anonymous` vs `connected`). Data slots (level, streak, currency) added in v2+ land as **typed props on `ConnectedProps`**, not as new variants. A new variant requires a written justification in a spec PR + design-system owner sign-off; 'we have a new piece of data to show' is **not** a justification. This rule is restated in §3 (non-goals) and §5 (type contract) so reviewers catch drift."

**§12 risks row #7 (line 326)**:
> "Per the §5 growth rule, future data systems land as **typed props on `ConnectedProps`** (not new variants); the discriminated union is reserved for structural layout differences."

**Verdict**: consistent. All four mentions point at the same rule, name the same canonical location (§5), and use the same language ("typed props on `ConnectedProps`" vs "new variants"). No escape hatches; no leftover v0 prose. The "design-system owner sign-off" requirement is consistent in §5 and §12.

**Minor note**: §12 risks row #2 (the `onProTap` row) does NOT cite the §5 growth rule — it doesn't need to (different topic) — but it does still carry the soft-escalation language that contradicts §6.1. See Section F.

---

## Section C — P0-6 enforcement strictness

This is the load-bearing P0. Each layer verified individually:

### Layer 1 — Owner named explicitly

- **Result**: yes.
- **Evidence**: §6.1 row 1 line 187: "**Owner: Wolfcito.** … (3) Sally creates a calendar reminder in the project tracker on canary-deploy day."
- Both Wolfcito (decision owner) and Sally (calendar mechanic) have explicit named responsibility. Not "the team" or "reviewers."

### Layer 2 — Due-date language

- **Result**: yes.
- **Evidence**: §6.1 row 1 line 187: "**Due date: 60 days from the canary deploy date OR Shop PRO sub-section ships, whichever first.**"
- The "OR Shop PRO ships, whichever first" structure is preserved; the day-1 anchor is "canary deploy date" (concrete future event). This is **not** "60 days from today" or "60 days from spec approval" — it is anchored to a specific commit that will leave a timestamp in git history.

### Layer 3 — Greppable commit trailer

- **Result**: yes.
- **Evidence**:
  - §6.1 row 1 line 187: "(1) Commit #2 message includes the literal trailer `pro-tap-debt-due-by: <YYYY-MM-DD>` (canary-deploy-day + 60d) — greppable in any future log scan."
  - §15 commit #2 line 445: "**Commit message MUST include the literal trailer `pro-tap-debt-due-by: <YYYY-MM-DD>`** where the date is canary-deploy-day + 60 days (per §6.1 P0-6 closure). A grep for that string at any future Phase-2 review surfaces the deadline."
- The literal string `pro-tap-debt-due-by:` is mandated in commit #2 (the canary commit). A `git log --all | grep pro-tap-debt-due-by` will surface it at any future date.

### Layer 4 — Calendar / tracker artifact

- **Result**: yes (named, but soft on which-tracker).
- **Evidence**: §6.1 row 1 line 187: "(3) Sally creates a calendar reminder in the project tracker on canary-deploy day."
- "the project tracker" is not a literal URL/tool name. Marginally soft — but consistent with how the rest of the project references "the project tracker" generically. The line is good enough for v1; the spec correctly trusts Sally to know which tracker. If it were to be tightened, "GitHub issue with `pro-tap-debt` label, due: <date>" would be even harder; but P0-6 is closed because the trailer (Layer 3) is the load-bearing greppable artifact, and Layer 4 is a redundant reminder.

### Layer 5 — Day-61 hard-close behavior

- **Result**: yes.
- **Evidence**: §6.1 row 1 line 187:
  > "(4) On day 61 without resolution: **automatic hard-close** — `onProTap` is removed from `ConnectedProps`, the inactive PRO pill is removed entirely, the hit area is dropped. If Shop PRO has not shipped, PRO management remains reachable through Shop's main destination only; renew regression is accepted as the cost of debt expiration. Re-approval to extend requires a new section in this spec's Amendment log titled '60-day debt re-approval', with explicit rationale signed by Wolfcito — soft escalation in Slack/issues is not sufficient."
- Concrete + automatic. Three distinct removal actions named. Re-approval mechanism is **not** "ping in Slack" — it requires an Amendment-log entry signed by Wolfcito. This is materially harder than the v0 "escalate to Wolfcito" / Z2 `MissionDetailSheet` "soft deadline" pattern that left the Z2 debt open.

### Layer 6 — `DESIGN_SYSTEM.md` carry-forward mirror

- **Result**: yes (mandated; ships in commit #1 / commit #4 per spec).
- **Evidence**:
  - §6.1 row 1 line 187: "(2) `DESIGN_SYSTEM.md` §10.7 carries the same date in the carry-forward table."
  - §15 commit #1 line 430: "The §10.7 entry must call out the **`onProTap` transitional debt with its 60-day-or-Shop-PRO deadline** so the debt is visible in the design-system reference, not buried in the spec."
  - §15 commit #4 line 453: docs cross-link "Phase 2 follow-ons" subsection — `onProTap` removal trigger.
- Verified against current `DESIGN_SYSTEM.md`: the file does NOT yet contain `pro-ring-gold`, `pro-tap-debt-due-by`, or a §10.7 GlobalStatusBar entry. This is correct: the amendment mandates these to be added in commit #1 / #4, not in the amendment itself. The spec mandate is in place; commit #1's reviewer must check the docs were actually updated.

**All 6 layers**: yes / yes / yes / yes / yes / yes. **P0-6 enforcement is hard, not soft.** Materially stronger than the Z2 ContextualHeader `MissionDetailSheet` debt (which is still open at 2026-05-02 per project memory) — that one had no greppable trailer, no automatic hard-close, no spec-Amendment-log re-approval rule. The Z1 spec learned the right lesson.

**Implementation start: not blocked by P0-6.**

---

## Section D — Carry-forward concreteness

§17 has 5 items. Each trigger classified Concrete / Soft:

| # | Item | Trigger (paraphrased) | Classification |
|---|---|---|---|
| 1 | Keyboard navigation (Tab order, Enter, focus-visible) | "First Z1 consumer beyond the transitional PRO tap … OR before removing `onProTap` (whichever first)." | **Concrete** — both events are observable in git history (typed-prop addition PR; `onProTap` removal PR). |
| 2 | Focus-visible refinements | "Same as keyboard navigation above, OR the first general accessibility QA pass on the project (whichever first)." | **Concrete** (first half) / **Soft** (second half). The "first general a11y QA pass" is unscheduled and could be never. The first half (keyboard nav trigger) is enough to fire it; soft-half is a redundant fallback. Net: **Concrete** because the OR resolves on either event. |
| 3 | Screen-reader pronunciation of truncated wallet | "First a11y QA pass with real screen-reader testing. v1 sets no `aria-label` override; tests are run when a real user reports friction or the project commissions accessibility QA." | **Soft** — both arms ("first a11y QA pass" + "real user reports friction") are unscheduled. Could be never. The "Hard rule" at the bottom of §17 partially redeems this: "any item that becomes a real user complaint between v1 and its trigger gets promoted to a spec amendment immediately." That makes the user-complaint arm self-firing. The QA-commission arm is genuinely soft. **Net: Soft, but acceptable.** |
| 4 | RTL layout support | "When the i18n project demands RTL — at that point a separate spec defines mirroring rules for Z1 + Z2 + dock." | **Concrete** — the i18n project demand is a specific event (PR with RTL strings or a translation infrastructure spec). v1 sets `dir="ltr"` on the wrapper as an explicit defense, which is a concrete code mandate that protects against caller-driven RTL inversion in the meantime. |
| 5 | Keyboard behavior beyond the PRO tap | "Before merging the first PR that adds an interactive typed prop on `ConnectedProps`." | **Concrete** — the "first PR that adds an interactive typed prop" is observable in PR diffs. Reviewers can flag it. This is the cleanest of the five. |

**Soft count**: 1 (item #3 screen-reader pronunciation). All others Concrete.

**Verdict**: 4 Concrete / 1 Soft. Below the "2+ Soft = insufficient" bar set by the task. Carry-forward is **sufficient**. Recommend tightening item #3 in commit #1 by adding a calendar-quarter cadence (e.g., "review status of screen-reader testing every 3 months in DESIGN_SYSTEM.md §10.7 status review"), but not a blocker.

The additional "Hard rule" at §17 line 506 ("any of the above items that becomes a real user complaint between v1 and its trigger gets promoted to a spec amendment immediately") is the right safety net for soft-trigger items. Acceptable.

---

## Section E — P1 sample check

### P1-2 — PRO inactive treatment locked

- **Defect**: "Two implementers given 'tuned during visual QA' would ship two different visual treatments."
- **Where amendment claims closure**: §8 inactive row line 220.
- **Result**: closes cleanly.
- **Evidence** — §8 line 220 quotes the locked treatment verbatim:
  > "render a small muted-outline `PRO` affordance with the **exact treatment locked below** (no implementer-side tuning): `inline-flex items-center px-2 h-6 rounded-full text-[10px] font-bold uppercase tracking-wide text-white/40 ring-1 ring-inset ring-white/15 bg-transparent`. Label: `GLOBAL_STATUS_BAR_COPY.proInactiveLabel` (`'PRO'`). Visual QA **confirms** the resting hue against the canary background; it does not re-tune the values. Any future change requires a spec amendment."
- "no implementer-side tuning" + "Visual QA confirms (not re-tunes)" + "any future change requires a spec amendment" closes the v0 ambiguity. Two implementers reading this spec ship the same Tailwind class string. Closes.

### P1-4 — Layout-budget math (safe-area insets)

- **Defect**: "v0 ignored `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`. Real iOS-notch overhead ~306px not 232px; board ~334px not 408px; below the §14 'board ≥ 380px' bar."
- **Where amendment claims closure**: §12 risks row #4 line 323 + §14 split rows lines 397–398.
- **Result**: closes cleanly.
- **Evidence**:
  - §12 line 323 (corrected math, quoted):
    > "**Corrected math (v0 was optimistic — ignored safe-area insets):** … Worst case on iOS notch device at 360×640 (Safari): Z1 (36 content + ~44 inset-top) ≈ 80px; Z2 ≤ 64px; dock (72 content + ~34 inset-bottom) ≈ 106px; Z4 max present ≈ 56px. Total overhead ≈ 306px → ~334px remaining for Z3 on 640px-tall device. On Pixel-4-class Android (no notch), insets are ~24/0 → ~248px overhead → ~392px for Z3. **The acceptance bar in §14 ('board ≥ 380px') is ONLY achievable on Android-class devices; iOS notch devices target ≥ 330px for Z3.**"
  - §14 line 397: "/hub at 360×640 (Pixel-4-class Android — no notch): board ≥ 380px"
  - §14 line 398: "/hub on iOS notch fixture (e.g., iPhone 12 mini at 375×812 with safe-area-top 44 / bottom 34): board ≥ 330px (lower bar acknowledges safe-area insets)"
- Math + acceptance row both updated. Visual QA explicitly requires both fixtures. Closes.

**P1 sample**: 2 of 2 closed cleanly. No incidental issue noticed in the other P1 sections during this pass.

---

## Section F — New defects introduced by the amendment

### F-1. Spec front-matter not updated

- **Location**: line 5.
- **Defect**: still reads `> **Status**: **v0 — draft, awaiting red-team review.** No commits yet.`
- **Contradiction**: Amendment log (line 522) says "v0 → v1 amendment applied 2026-05-02" and the §17 + Status & next step block say "All 6 P0 closed. P1-1..P1-6 closed."
- **Severity**: P3 (cosmetic). One-line typo. Fix in commit #1.
- **Suggested fix**: change line 5 to `> **Status**: **v1 — amendment applied 2026-05-02; awaiting 15-min re-review pass.** No code commits yet.`

### F-2. §12 risks row #2 contradicts §6.1 hard-close

- **Location**: §12 line 321.
- **Defect**: still says "Set a 60-day **soft** deadline at canary deploy; if Shop PRO sub-section hasn't shipped by then, **escalate**." This is the v0 soft-escalation phrasing that the prior review specifically flagged as inadequate (P0-6). §6.1 row 1 now has hard 4-layer enforcement; §12 row #2 still says "soft" + "escalate."
- **Severity**: P2. Not a contract blocker (§6.1 is the load-bearing copy and is correct), but a contradiction between two rows of the same spec is exactly the kind of trip-wire a future PR will lean on. A future contributor reading §12 alone will conclude "ah, soft deadline, just escalate" and miss §6.1's automatic hard-close.
- **Suggested fix** (one sentence): replace §12 row #2 mitigation with: "The transitional debt has hard 4-layer enforcement (greppable commit trailer + DS doc mirror + calendar reminder + automatic day-61 hard-close per §6.1 row 1). v0's soft-escalation language is replaced; see §6.1 for the mechanism."

### F-3. §16 Q2 still listed as an open question

- **Location**: §16 line 477.
- **Defect**: "Is `onProTap` strictly necessary in v1, or can the canary ship without it (e.g., temporarily route PRO management via a dock destination)? If yes — the transitional debt in §6.1 evaporates."
- **Contradiction**: the §6.1 amendment closes the answer ("kept; debt tracked with hard 4-layer enforcement"). Listing Q2 as open invites re-litigation.
- **Severity**: P3. Either remove Q2 or annotate inline ("Answered in v1: kept; see §6.1 hard-close enforcement").
- **Suggested fix**: append to Q2 in §16: "**Answered (v1):** kept; transitional debt tracked with hard 4-layer enforcement in §6.1 row 1. Day-61 automatic hard-close removes `onProTap` if Shop PRO has not shipped."

### F-4. (Minor) §11 #3 self-references §11 #3

- **Location**: line 219 (§8 active state row).
- **Defect**: row reads "(token reused or, if missing, new `--pro-ring-gold` — see §11 acceptance #3)" — but §11 #3 has been amended to **always** use the new token (no reuse path). Leftover v0 phrasing.
- **Severity**: P3. Implementer reading §8 will see "token reused or" and wonder if there's still a path. Two-word fix.
- **Suggested fix**: change to "(via the canonical `--pro-ring-gold` token; see §11 acceptance #3)."

**No contract or geometry regressions introduced by the amendment.** F-1 / F-3 / F-4 are stale-prose typos; F-2 is a substantive intra-document contradiction but on a non-load-bearing row (§12 risks). Net: 4 P2/P3 prose fixes that can land in commit #1's PR.

---

## Final note + go/no-go for commit #1

**GO on commit #1 of the implementation plan.**

Pre-flight checks:

- All 6 P0 closed (Section A: 6/6).
- §5 growth rule consistent across §3/§5/§12 (Section B: clean).
- P0-6 enforcement is hard across all 6 layers (Section C: 6/6).
- Carry-forward is concrete (Section D: 4 Concrete / 1 Soft, below the 2+ Soft fail bar).
- P1 sample (P1-2 + P1-4) closes cleanly (Section E).
- No new contract / geometry / type defects (Section F: 4 P2/P3 prose fixes).

Halt criteria for commit #1:

- Any new TS error introduced (`pnpm tsc --noEmit` count must stay flat at branch tip).
- Any unit test failure on `apps/web/src/components/ui/__tests__/global-status-bar.test.tsx`.
- Any lint failure on the new file.
- `DESIGN_SYSTEM.md` §10.7 + §1 entries NOT shipped in the same commit (per acceptance #10 + commit #1 spec).
- `--pro-ring-gold: #FDD257` NOT added to `globals.css` in the same commit.
- `GLOBAL_STATUS_BAR_COPY` keyset NOT complete per §15 commit #1 keyset (line 419).

Halt criteria for commit #2 (canary):

- Z2 height leaves 52–64px envelope after `mr-[140px]` removal.
- Z3, Z4, or Z5 dimensions drift > ±2px from baseline.
- `<ProSheet>` open/close cycle broken.
- `apps/web/e2e/contextual-header.spec.ts` red after rebaselining (means the wrapper change broke geometry, not that the assertions are wrong).
- Commit #2 message missing the literal trailer `pro-tap-debt-due-by: <YYYY-MM-DD>`.
- iOS-notch fixture board < 330px or Pixel-4-Android board < 380px.

Recommended PR-body addition for commit #1: roll the 4 minor notes (F-1 spec front-matter, F-2 §12 row #2 contradiction, F-3 §16 Q2 stale-question, F-4 §8 token reuse stale phrasing) into the same commit's spec edit. None requires a separate amendment cycle.

The amendment is the strongest of the three Sally specs to date. Spec is **production-ready as a contract**. Proceed.

— Adversary
