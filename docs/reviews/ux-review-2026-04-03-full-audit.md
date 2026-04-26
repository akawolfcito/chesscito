# UX Review Report — 2026-04-03

Full audit of all screens and components by 3 parallel reviewers.

---

## Critical (must fix)

### Score/Number Confusion (Play Hub)
1. **[page.tsx:785, mission-panel.tsx:137]** Score displays as raw number with no label. User sees "300" next to a star icon — no "Score", "Points", or context. The exercise drawer shows "3/15" for the same progress. Two unrelated-looking numbers for the same thing.

2. **[page.tsx:596-598, result-overlay.tsx:230]** "Submit Score" submits per-piece score (e.g., 300) but the post-submit overlay shows globalTotal (e.g., 900) labeled "Total: 900 pts". User thinks 900 was submitted but only 300 went on-chain.

### Broken States
3. **[editorial.ts:565]** Support email renders empty when `NEXT_PUBLIC_SUPPORT_EMAIL` is unset (which is the template default). `mailto:` link opens with no recipient. Privacy policy also references "our support team" with no contact info.

4. **[trophies/page.tsx:132-134]** "Connect wallet to see your victories" — but NO connect button on the page. Dead end with no actionable CTA.

5. **[tx-lab/page.tsx]** `/tx-lab` is publicly accessible with no auth, no navigation, no `noindex`. First-time user landing here sees raw blockchain jargon and has no way back to the app.

### Shared Victory Page
6. **[victory/[id]/page.tsx:89-135]** Shared victory URL has zero context about what Chesscito is. No tagline, no app description. A first-time visitor from a social share has no idea what they're looking at.

### Navigation Safety
7. **[victory-claiming.tsx:113-121]** "Back to Hub" is clickable during active NFT claim transaction. User can abandon transaction mid-flight with no warning. If deadline passes, claim is lost with no recovery.

### Design Tokens (Trophies)
8. **[trophies/page.tsx:96]** Hardcoded gradient `#0a2a3f` in header overlay.
9. **[trophy-card.tsx:75]** Hardcoded inline gradient `rgba(16,12,8,0.90)` outside token system.

---

## Major (should fix)

### Score UX
10. **[mission-panel.tsx:139-141]** Time display shows meaningless "1s" when not in success phase (hardcoded `1000n`). Only shows real time on exercise completion.
11. **[result-overlay.tsx:83-84]** Star visualization uses `Math.ceil(totalStars/3)` to map to 5 circles. Non-obvious conversion — user earned 6 stars out of 15 but sees 2/5 circles.

### Touch Targets
12. **[exercise-drawer.tsx:67-74]** Drawer trigger ~40px wide, below 44px minimum.
13. **[victory-claim-success.tsx:120-145]** Share buttons (X, WhatsApp, copy) are 36x36px (`h-9 w-9`), below 44px minimum.
14. **[trophies/page.tsx:148-153]** "Go to Arena" link in empty state is ~16px tall. Well below 44px.
15. **[trophy-card.tsx:114]** Share button 36x36px, below 44px.

### User-Facing Text
16. **[page.tsx:638]** Error exposes internal item ID: "Item 1 is not configured on-chain". Meaningless to users.
17. **[page.tsx:646]** "No accepted token with sufficient balance" is developer-speak. Should say "Not enough funds".
18. **[shop-sheet.tsx:69]** "Not configured" status shown to users. Should say "Coming soon" or hide the item.
19. **[purchase-confirm-sheet.tsx:67]** Raw chain ID fallback "Chain 12345" shown when chain name not found.
20. **[editorial.ts:335]** "Trophy Vitrine" — unusual English. Most users would expect "Trophy Case".
21. **[trophies/page.tsx:117-120]** "Trophies unavailable" with no explanation and no alternative action.

### Design Tokens
22. **[contextual-action-slot.tsx:23-53]** All CTA button colors are hardcoded hex (`#23C8F3`, `#F6A400`, `#9B59FF`, etc.) — ~12 values bypassing the token system.
23. **[mission-panel.tsx:217]** Inline `rgba(220,200,150,0.9)` not a token.
24. **[shop-sheet.tsx:62-67]** 5+ hardcoded RGBA values for featured item styling.
25. **[trophy-list.tsx:12]** Hardcoded `bg-[#121c2f]` in skeleton card.
26. **[support/page.tsx:21,37]** `bg-cyan-950/40` raw Tailwind, inconsistent with about page's `bg-white/[0.06]`.

### Visual Consistency
27. **[purchase-confirm-sheet.tsx:42-45]** Purchase confirm sheet lacks header zone treatment (no background, no border, no rounded top) — all other sheets have it.
28. **[result-overlay.tsx:80-81]** `EXERCISES_PER_PIECE` defined locally as `5` instead of imported — will break if exercise count changes.

### Navigation & Flow
29. **[page.tsx:486-491]** After completing all exercises with badge claimed, board resets to exercise 1 with no guidance. User may think game is broken.
30. **[page.tsx:469-477]** Badge earned prompt auto-dismisses after 15 seconds with no countdown indicator.
31. **[purchase-confirm-sheet.tsx:72-94]** No success or failure feedback after purchase. User must infer result.
32. **[shop-sheet.tsx:80-89]** Disabled buy button with no explanation of WHY it's disabled.
33. **[victory/[id]/page.tsx:105-111]** Wallet address shown as truncated hex with no label. Non-crypto user has no idea what it is.
34. **[victory/[id]/page.tsx:126-131]** "Back to Hub" link is low contrast (`text-white/50`), small, easy to miss — only way into the app from shared link.
35. **[editorial.ts:489]** Legal "Last updated: March 2026" — no specific date. Legal best practice requires a specific date.

### Mobile Layout
36. **[tx-lab/page.tsx:288-312]** `<pre>` blocks with no `max-h` constraint. Large JSON payload expands indefinitely on 390px screen.

---

## Minor (nice to fix)

37. **[mission-panel.tsx:36-38]** Phase flash uses `text-emerald-300`/`text-rose-300` instead of CSS variables.
38. **[exercise-drawer.tsx:35-38]** Star colors use bare Tailwind `fill-amber-400 text-amber-400`.
39. **[mission-panel.tsx:132]** Divider `bg-white/[0.08]` vs gameplay-panel `rgba(255,255,255,0.07)` — two opacities for same element.
40. **[contextual-action-slot.tsx:95 vs result-overlay.tsx:165]** CTA buttons use different border-radius (`rounded-2xl` vs `rounded-xl`).
41. **[result-overlay.tsx:165]** Share button uses `py-3` (~44px) vs explicit `h-[52px]` on other CTAs.
42. **[gameplay-panel.tsx:27,37]** Dividers use inline `rgba(255,255,255,0.07)` instead of `--shell-divider` token.
43. **[page.tsx:737-738]** Target label shows chess notation "e4" with no explanation for pre-chess beginners.
44. **[page.tsx:243]** "Practice mode" label is `text-[0.6rem]` — easy to miss.
45. **[page.tsx:778-779]** Queen/King permanently locked with no "Coming soon" text or unlock criteria.
46. **[contextual-action-slot.tsx:79-83]** CTA area disappears entirely when action is null. Empty space where button should be.
47. **[leaderboard-sheet.tsx:108]** Score column has no header label.
48. **[leaderboard-sheet.tsx:103]** Wallet addresses shown as truncated hex with no "Player" label.
49. **[arena-hud.tsx:77]** `bg-white/12` inconsistent notation (should be `bg-white/[0.12]`).
50. **[difficulty-selector.tsx:42-43]** `bg-white/12`, `bg-white/5`, `bg-white/8` inconsistent opacity steps.
51. **[arena-hud.tsx:85,124]** Confirm-state text `text-[0.65rem]` (~10.4px) — hard to read during time pressure.
52. **[promotion-overlay.tsx:13-17]** Piece labels hardcoded instead of using `PIECE_LABELS` from editorial.ts.
53. **[victory-claiming.tsx:40]** Victory claiming view replicates panel styling with raw Tailwind instead of `panel-showcase` class.
54. **[arena-end-state.tsx:122]** Loss/draw overlay has different padding (`px-8 py-8`) than victory (`px-6 pb-6 pt-8`).
55. **[arena/page.tsx:432-448]** No loading state between difficulty selection and game start. `ARENA_COPY.preparingAi` exists but is never rendered.
56. **[purchase-confirm-sheet.tsx:42]** Uses `border-slate-700` instead of `border-white/[0.10]` (inconsistent with other sheets).
57. **[shop-sheet.tsx:68-69]** Price shown as "0.1 USDC" (no $) but confirm sheet uses `formatUsd()` with $. Inconsistent.
58. **[purchase-confirm-sheet.tsx:84]** No cancel button during purchase — only dismiss via swipe.
59. **[legal-page-shell.tsx:20]** Back navigation uses `router.push()` instead of `<Link>`. Breaks iOS back-gesture.
60. **[about/page.tsx:31-34]** Version `v0.1.0` at `text-[10px]` with `text-cyan-300/30` (~1.5:1 contrast). Fails WCAG AA.
61. **[trophies/page.tsx:177]** Roadmap arrow `->` looks like a navigation element users may try to tap.
62. **[victory/[id]/page.tsx:100]** "Checkmate in N moves" shown for exercise victories that aren't checkmates.
63. **[trophy-card.tsx:90]** Token ID `#47` shown with no explanation that it's an NFT ID.
64. **[trophies/page.tsx:127,159]** Section headings use inline `textShadow` instead of `--text-shadow-label` token.
65. **[about/invite-link.tsx:22]** `bg-cyan-950/40` on invite button — inconsistent with about page's `bg-white/[0.06]` for same row style.

---

## Passed
- Board interaction (hit-grid, piece selection, move highlighting) is consistent and responsive
- Footer dock navigation works correctly across all states
- Retry shield flow (purchase, use, deplete) is clear
- Arena difficulty selection is intuitive
- Victory NFT mint flow (when wallet is connected) is straightforward
- Mobile viewport constraint `max-w-[var(--app-max-width)]` is consistently applied on main screens
- Safe area insets handled on trophies page

---

## Summary

- **Screens audited**: 17 (9 pages + 8 overlays/sheets/drawers)
- **Critical**: 9
- **Major**: 27
- **Minor**: 29
- **Total findings**: 65

### Top 5 Priorities

1. **Score clarity** — Label what each number means, show what "Submit Score" will submit, don't show globalTotal as if it was the submitted value
2. **Support email fallback** — Broken email CTA when env var is unset
3. **Trophies dead end** — "Connect wallet" with no connect button
4. **Victory share page** — Zero onboarding context for new visitors
5. **tx-lab public access** — Developer tool exposed without protection
