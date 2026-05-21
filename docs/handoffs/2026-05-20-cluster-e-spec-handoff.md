---
date: 2026-05-20
session_type: spec-only
arc: post-domain-migration UX addendum
parent_handoff: docs/handoffs/2026-05-20-post-domain-migration-addendum-handoff.md
spec: _bmad-output/implementation-artifacts/spec-cluster-e-coach-re-entry-game-persistence.md
spec_status: ready-for-dev
commits_shipped: 11
test_suite_baseline: 1698/45
clusters_outstanding: E (implementation), F (release handoff)
---

# Session Handoff — Cluster E Spec Approved

## TL;DR

Two arcs in one session:

1. **MiniPay store submission** — 11 form questions answered into a working doc (`docs/submission/minipay-form-answers.md`), 4 supporting in-product changes shipped (max-balance stablecoin selector across 3 surfaces, "gas" → "Network fee" copy, Telegram support channel, independent-operator disclaimer on `/about` + Terms §1).
2. **Cluster E spec** — `bmad-quick-dev` produced the `ready-for-dev` spec for unconditional `GameRecord` persistence + Coach re-entry surfaces, frozen and pushed. **No implementation today.** Implementation lands in a dedicated session.

11 commits to `main`. Suite baseline preserved at 1698 passing / 45 baseline failing across all commits.

---

## MiniPay submission — what shipped

| Commit | Theme |
|---|---|
| `8117c81d` | `selectMaxBalanceToken` util + 10 unit tests |
| `2faf4090` | Shop sheet → max-balance selector |
| `991744a4` | Pending claims copy: `"gas only"` → `"Network fee only"` |
| `15109508` | PRO sheet → max-balance selector |
| `4c816603` | Arena (Victory NFT mint + Coach Pack) → max-balance selector |
| `c6e78c26` | `/support` Telegram channel (`@chesscito_app`) wired |
| `4b001539` | Operator disclaimer rendered on `/about` + prepended as Terms §1 |
| `77f8097d` | `docs/submission/minipay-form-answers.md` — working answers doc |
| `4f126401` | Brief Description (3 length variants) + "Add Cash" audit answer |
| `(this commit)` | Cluster E spec ready-for-dev + handoff |

Production env fixes resolved during the session: `SHOP_DEPLOY_BLOCK_CELO` reset to digits-only (was `37,800,000` with commas → BigInt SyntaxError tumbó el build); `NEXT_PUBLIC_SUPPORT_EMAIL` populated.

### Form answers status (`docs/submission/minipay-form-answers.md`)

11 questions answered with rich evidence + "Form-ready paste" snippets:

1. Preferred stablecoin (highest balance) — **YES**, util + 3 stablecoin addresses
2. Simplified language — **YES**, plus "Add Cash" audit (compliant by absence)
3. Methods accessed by users — 3 layers (routes / on-chain / read-only APIs)
4. Celoscan links to contracts — 4 Chesscito-deployed addresses on Celo Mainnet
5. Sample transactions per interaction — 5 verified mainnet hashes
6. Domains hosting JavaScript — `chesscito.com` (custom) + Vercel preview/legacy + `va.vercel-scripts.com`
7. Support model — Telegram + Web + Tickets (3-of-3)
8. Terms of Service link
9. Privacy Policy link
10. Operator Information — independent of Opera and MiniPay
11. Brief Description — short / medium / long variants

---

## Cluster E spec — approved scope

**Spec**: `_bmad-output/implementation-artifacts/spec-cluster-e-coach-re-entry-game-persistence.md` (`status: ready-for-dev`, ~1500 tokens, `<frozen-after-approval>` block locked).

**Core decisions** (the user-locked block):

- **Foreground await on `/api/games` POST** at every game-end, masked by `<TxProgressSteps variant="toast">` (commit `fc5ab87b`). §0.1 supersedes §2.4.1.
- End-state CTAs (`Mint Victory ▶`, `Get Coach Analysis`) mount `disabled` + `aria-busy="true"` until `gameRecordPersisted` is true.
- New `lib/coach/game-persistence.ts` module — distinct domain from `persistence.ts`. Encapsulates FIFO eviction with analyzed-game skip.
- 200-row cap (was 100). When at cap, evict oldest UNANALYZED game; analyzed games protected. All-analyzed → soft overflow + `game_persist_cap_overflow` telemetry.
- `/coach/history` renders `Analyze ▶` candy chip for entries lacking analysis row. Mixed chronological order (no Analyzed/Pending split).
- Arena end-state: `Get Coach Analysis` is **secondary** under Mint on win, **primary** on loss/draw/resigned.
- Every analyze call tags `source` dim: `immediate | history | victory-mint`.
- A11y contracts per §0.4 (`role="listitem"`, `aria-describedby` hidden span on victory secondary CTA, etc.).
- Preserve suite baseline 1698 / 45.

**Multi-goal decision**: user chose **[K] Keep** — single spec covering persistence + UI together. Token trim brought spec from ~2600 estimate down to ~1500.

---

## Next session opener

Pure implementation. The spec is locked; just execute.

```
Resume work on:
  _bmad-output/implementation-artifacts/spec-cluster-e-coach-re-entry-game-persistence.md

The spec is `ready-for-dev`. Follow bmad-quick-dev step-03-implement.md.
Touch only the Code Map files. Preserve suite baseline 1698 passing / 45
failing. After implementation, advance status to `in-review` and run the
adversarial review per step-04.
```

Estimated effort: ~1.5 days of focused work. Suggested commit split (decided by implementer during execution):

- `e1` — editorial.ts new copy block
- `e2` — `lib/coach/game-persistence.ts` + tests (TDD)
- `e3` — `/api/games` route wires the helper
- `e4` — `arena/page.tsx` persistence effect + toast
- `e5` — `arena/arena-end-state.tsx` dual-position Coach CTA
- `e6` — `coach/coach-history.tsx` Analyze chip
- `e7` — telemetry `source` dim across call sites

VR-5 visual baseline captured naturally during e4 + e5 (pills + toast on Victory mint).

---

## Open threads not in Cluster E

- **Cluster F** — closing release handoff doc under `docs/release/2026-05-2X-post-domain-migration-addendum-handoff.md`. Gated by Cluster E in `main`.
- **Visual snapshot batch** — `/support` Telegram block + `/about` operator disclaimer baselines deferred to "Option B" pragmatic refresh. Combine with VR-5/VR-7/VR-8 after Cluster E lands.
- **45 baseline test failures** — orthogonal cleanup sprint. Suite affected: arena-hud, arena-select-scaffold, coach-preview-card, coach-history-delete-panel, coach-panel, coach-paywall, contextual-action-slot, hub-scaffold-client. Not blocking submission or Cluster E.
- **Optional UX** — "Add Cash" CTA on insufficient-balance error states (6 call sites). User declined (compliant by absence is enough for MiniPay form).

---

## Pointers

- **Parent addendum**: `_bmad-output/planning-artifacts/ux-design-addendum-post-domain-migration-2026-05-20.md` §2.4 + §0.1
- **Red-team review**: `docs/reviews/2026-05-20-post-domain-migration-addendum-redteam.md` (C-1 race resolved by §0.1)
- **Prior session handoff**: `docs/handoffs/2026-05-20-post-domain-migration-addendum-handoff.md`
- **MiniPay form answers**: `docs/submission/minipay-form-answers.md`
- **Production**: `chesscito.com` (custom apex). Vercel deploy GREEN after env var fix. Suite baseline 1698 passing / 45 baseline failing.
