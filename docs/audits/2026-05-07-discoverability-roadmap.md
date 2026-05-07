# Roadmap — Discoverability + Hub Cleanup (2026-05-07)

> **Origin**: Manual smoke 2026-05-06/07 after Coach Session Memory bundle shipped. PRO user surfaced multiple discoverability + integration gaps. This doc consolidates open work into priority order and answers "what next" until the next sprint.

---

## Status snapshot — what's working

| System | State | Source |
|---|---|---|
| Coach analysis (PRO + Free) | ✅ Live, OpenRouter wired | This session |
| Coach session memory (Supabase) | ✅ 365-day retention, PRO only | PR 1-5 (`36cf637`–`ebccb27`) |
| Coach paywall gate respects PRO | ✅ Fixed via `useProStatus()` cached + fallback | `154f806`/`ad084ea` |
| Claim cancel copy (empathetic) | ✅ "Saved for later" + amber tone | `cd9eb1a` |
| Build SHA chip | ✅ Visible bottom-right, deploy verifier | `196dad5`+ |
| `/api/cron/coach-purge` | ✅ Daily 03:00 UTC TTL purge | `8f4ecc3` |
| `/privacy` Coach disclosure | ✅ 4 paragraphs of `PRIVACY_COACH_COPY` | `04db1bc` |
| Arena scaffold (no prize pool placeholder) | ✅ Default at `/arena`; legacy via `?arena=legacy` | `af160bb` |
| Build/deploy/DB infra | ✅ All in sync, `LOG_SALT` ready | This session |

---

## Open backlog (consolidated)

### A · Discovery (highest user impact)
| ID | Item | Why critical |
|---|---|---|
| **D1** | Coach has NO entry point from `/hub` | Users only find Coach post-game. PRO subscribers paid $1.99 for value they have to dig for. |
| **D2** | "Past Sessions" only visible inside Coach panel | History is session-buried. Should be a dock or hub chip. |
| **D3** | New hub redesign migration ~80% — broken/orphan links | Users hit dead ends. |

### B · Hub navigation (broken in 2026-05-06 smoke)
| ID | Item | Severity |
|---|---|---|
| **B2** | Pass Training "Play in Arena" CTA stuck (chip + sheet) | P0 — paying user upsell broken |
| **B5** | Hub Play button routes to legacy `/play-hub` instead of unified `/hub` | P1 |
| **B6** | `design/new-assets-chesscito/principalbutton.png` not integrated | P1 (visual identity) |
| **B7** | Queen / King / Pawn mastery → all to `/badges` (no per-piece) | P2 |
| **B8** | Shield ×N chip → Arcane Store (verify intent) | P2 |

### C · Coach UX polish
| ID | Item | Severity |
|---|---|---|
| **C1** | Coach Analysis screen layout (dense, no board snapshots) | P1 |
| **C2** | "Personalized coaching is live" first-run banner placement | P2 (works, may be dismissable better) |
| **C3** | Mismatch banner copy when LLM upstream fails | P2 (already shipped, polish text) |
| **C4** | LLM model selection: cheap free → quality paid | P2 — currently `openai/gpt-oss-120b:free` |

### D · Engine + assets (older backlog)
| ID | Item | Source | Severity |
|---|---|---|---|
| **#67** | Exercise world map — visual progression | GH issue | P2 |
| **#92** | M31 sound effects | GH issue | P2 |
| **#101** | Prize pool distribution v2 (contract) | GH issue | P2 |
| **#104** | Treasure hunt — pieza única móvil | GH issue | P1 (future) |
| **#105** | Caballo errante — knight puzzles | GH issue | P1 (future) |
| **#109** | hub-shop-sheet-open visual regression timeout | GH issue | P2 |

### E · Specs unimplemented
| ID | Item | Source |
|---|---|---|
| **E1** | MiniPay transaction UX fluidity | spec `2026-04-26` (no matching plan) |
| **E2** | Phase 0.5 narrative coherence | plan exists `2026-05-03`, execution status unclear |

### F · Hygiene
| ID | Item | Severity |
|---|---|---|
| **F1** | TODO in `analyze/route.ts` — replace inline `console.info` with telemetry helper | P3 |
| **F2** | Migrate Coach LLM client to Vercel AI SDK (vendor abstraction) | P3 |
| **F3** | Polling logic in coach analyze → Vercel Workflow (durable execution) | P3 |

---

## Recommended priority order

### Sprint 1 (this week — high ROI, unblocks paying users)
1. **D1** — Coach entry chip on `/hub` (top right or in dock as 5th item)
2. **B2** — Pass Training nav repro + fix (Playwright spec from triage plan Phase 3)
3. **D2** — "Past Sessions" promoted to dock or hub link
4. **B5** — Audit `/play-hub` legacy: alias to `/hub` or kill
5. **C1** — Coach Analysis screen polish: board snapshots at key moments + better lessons formatting

### Sprint 2 (next week — UX consistency)
6. **B6** — Integrate `principalbutton.png` in hub
7. **B7** — Mastery buttons per-piece pages (Queen / King / Pawn distinct)
8. **B8** — Shield chip nav: confirm intent or rewire
9. **D3** — Complete hub redesign migration (close the 80%→100% gap)

### Sprint 3 (when discovery is solid — gameplay expansion)
10. **#104** — Treasure hunt mini-game
11. **#105** — Caballo errante puzzles
12. **E2** — Phase 0.5 narrative coherence

### Backlog (long-tail)
- **#67**, **#92**, **#101**, **#109**, **C2-C4**, **F1-F3** — pick up between sprints

---

## Persistence reference (from user question)

| Data | Storage | TTL |
|---|---|---|
| Game record (FEN, moves, result) | Redis | 30 days |
| Coach analysis — Free user | Redis | 30 days |
| Coach analysis — PRO user | Supabase `coach_analyses` | **365 days** |
| Victory NFT | Celo on-chain | Permanent |
| PRO subscription | Redis `coach:pro:<wallet>` | 30 days from purchase |
| Coach credit balance | Redis `coach:credits:<wallet>` | Persistent (no TTL) |

---

## Decision needed from PM

1. **Sprint structure**: do we adopt this 3-sprint cadence or stay on-demand?
2. **Coach UX investment**: how much energy into polishing Analysis screen (C1) vs shipping new gameplay features (#104, #105)?
3. **Hub migration close-out**: kill `/play-hub` legacy now or alias for backwards compat?
4. **LLM tier strategy**: stay on `gpt-oss-120b:free` for dev, switch to paid `gpt-4o-mini` when opening to public?
