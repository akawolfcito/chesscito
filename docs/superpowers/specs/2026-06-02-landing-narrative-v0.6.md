# LANDING_COPY v0.6 — Narrative Shift: Beginners / Casual / Adults First

| | |
|---|---|
| **Status** | APPROVED + Phase A IMPLEMENTED 2026-06-02. Phase B (VR baselines) pending. |
| **Author** | Wolfcito (spec drafted with Claude) |
| **Date** | 2026-06-02 |
| **Supersedes** | `2026-04-25-landing-narrative-v0.5.md` (still LIVE on production) |
| **Trigger** | Copy audit `docs/audits/2026-06-02-copy-narrative-audit.md` §1 items #9, #10, #11, #12 |
| **Scope** | `LANDING_COPY.audiences.*`, `LANDING_COPY.problem.claims[1]` (HUB_V2_SPLASH_COPY.title removed from scope — future note only) |

---

## 1. Problem statement

Today's landing reads as "kids first, useful at any age." Three signals push that frame:

1. `audiences.cards[0].title = "Kids and teens (8–16)"` lists children as the **primary**
   audience. Order is signal: whichever audience is first owns the narrative.
2. `audiences.title = "Made to start early. Useful at any age."` reinforces an
   age-priority hierarchy ("early" is the verb that lands).
3. `problem.claims[1] = "The earlier you start, the easier the habit."` privileges
   childhood as the optimal window for forming cognitive habits.

The product reality (per the M1 monetization cluster, PRO target, MiniPay distribution
strategy) is that the primary user is an adult / casual player on mobile who wants to
turn passive screen time into mental training. Younger learners stay supported but
through an adult, not as the lead persona.

The narrative needs to shift without:

- claiming the app is "for adults only";
- weakening accessibility for younger learners with family / coach support;
- introducing medical or clinical claims;
- claiming official MiniPay availability;
- breaking the existing component layout (4 audience cards rendered as a grid).

---

## 2. Goals & non-goals

### Goals

- Move adult / casual / curious-beginner audience to **first** position.
- Reframe younger-learner card around **shared play with an adult or mentor**.
- Soften age claims in `audiences.title` and `problem.claims[1]`.
- Keep the four-card grid structure (no layout change).

**Out of scope for v0.6:** `HUB_V2_SPLASH_COPY.title`. Tracked as a future note
in §11 below, not part of this implementation. v0.6 ships landing copy only.

### Non-goals

- No restructuring of the rest of `LANDING_COPY` (hero, problem statement opener,
  solution, howItWorks, capabilities, plans, impact, founders, finalCta, footer
  all stay v0.5).
- No new namespaces, no new components, no new routes.
- No changes to Spanish-only files outside `messages/es.ts`.
- No legal copy changes (Terms / Privacy stay out of scope; tracked separately
  in audit §4.6 TODO #1).

---

## 3. Proposed copy — Before / After (EN)

### 3.1 `LANDING_COPY.audiences.title`

| | |
|---|---|
| **Before (v0.5)** | "Made to start early. Useful at any age." |
| **After (v0.6)** | "Made for any age. Built for daily practice." |

### 3.2 `LANDING_COPY.audiences.cards`

Card order rewrites the priority hierarchy. New order: casual-beginner first,
families second, younger learners (with adult) third, educators stays last.

#### Card 0 — replaces v0.5 "Kids and teens (8–16)"

| | |
|---|---|
| **Title (v0.5)** | "Kids and teens (8–16)" |
| **Body (v0.5)** | "A key stage to build cognitive habits that can last a lifetime." |
| **Title (v0.6)** | "Casual players & curious beginners" |
| **Body (v0.6)** | "For anyone curious about chess. Short, visual challenges make each session easy to start." |

#### Card 1 — "Families" (unchanged title, body softened)

| | |
|---|---|
| **Title (v0.5)** | "Families" |
| **Body (v0.5)** | "A light routine to share minutes of play, conversation, and personal growth, without endless scrolling." |
| **Title (v0.6)** | "Families" |
| **Body (v0.6)** | "A simple routine to share a few minutes of play instead of endless scrolling." |

#### Card 2 — new card replacing the kids-first slot

| | |
|---|---|
| **Title (v0.6)** | "Younger learners, with guidance" |
| **Body (v0.6)** | "A friendly way to learn when shared with a parent, coach, or mentor." |

#### Card 3 — "Educators and communities" (kept verbatim from v0.5)

| | |
|---|---|
| **Title** | "Educators and communities" |
| **Body** | "Playful material that complements classrooms, clubs, and community programs. No heavy install, no technical curve." |

### 3.3 `LANDING_COPY.problem.claims[1]`

| | |
|---|---|
| **Before (v0.5)** | "The earlier you start, the easier the habit." |
| **After (v0.6)** | "Steady practice builds the habit, at any age." |

### 3.4 `HUB_V2_SPLASH_COPY.title` — removed from v0.6 scope

`HUB_V2_SPLASH_COPY.title` is **not part of v0.6**. The splash sits under a
separate design-lock (§2.1) and needs its own coordination step. Tracked as a
future note in §11; do not edit in this spec's implementation.

---

## 4. Proposed copy — Before / After (ES)

ES lives in `apps/web/src/lib/content/messages/es.ts`. The keys mirror the EN
authoring source; only the override values change.

### 4.1 `LANDING_COPY.audiences.title`

| | |
|---|---|
| **Before (v0.5)** | "Hecho para empezar pronto. Útil a cualquier edad." |
| **After (v0.6)** | "Para cualquier edad. Pensado para practicar a diario." |

### 4.2 `LANDING_COPY.audiences.cards`

#### Card 0

| | |
|---|---|
| **Title (v0.5)** | "Niños y adolescentes (8–16)" |
| **Body (v0.5)** | "Una etapa clave para cultivar hábitos cognitivos que pueden acompañar a lo largo del tiempo." |
| **Title (v0.6)** | "Jugadores casuales y principiantes curiosos" |
| **Body (v0.6)** | "Para cualquiera con curiosidad por el ajedrez. Retos cortos y visuales para empezar sin presión." |

#### Card 1 — Familias

| | |
|---|---|
| **Title (v0.5)** | "Familias" |
| **Body (v0.5)** | "Una rutina ligera para compartir minutos de juego, conversación y crecimiento personal, sin pantallazos infinitos." |
| **Title (v0.6)** | "Familias" |
| **Body (v0.6)** | "Una rutina simple para compartir unos minutos de juego, sin pantallazos infinitos." |

#### Card 2 — nuevo card

| | |
|---|---|
| **Title (v0.6)** | "Jóvenes aprendices con guía" |
| **Body (v0.6)** | "Una forma amigable de aprender junto a un familiar, entrenador o mentor." |

#### Card 3 — Educadores y aliados (verbatim v0.5)

| | |
|---|---|
| **Title** | "Educadores y aliados" |
| **Body** | "Material lúdico que complementa actividades de aula, clubes y programas sociales. Sin instalación pesada, sin curva técnica." |

### 4.3 `LANDING_COPY.problem.claims[1]`

| | |
|---|---|
| **Before (v0.5)** | "Mientras antes empieces, más fácil es crear el hábito." |
| **After (v0.6)** | "La práctica constante construye el hábito, a cualquier edad." |

### 4.4 `HUB_V2_SPLASH_COPY.title` — removed from v0.6 scope

Out of scope for v0.6. See §11 future notes.

---

## 5. Narrative risk

| Risk | Mitigation |
|---|---|
| Existing users who came via kids/teens framing feel the product changed under them. | Hero, problem, solution, howItWorks, capabilities, plans, impact, founders, finalCta blocks are unchanged. The shift is in audiences ordering and tone, not in product promise. |
| Partners or educators who use Chesscito as a kids tool feel deprioritized. | Educators card stays. Younger learners card stays (repositioned, with adult-company framing that matches actual schoolroom usage). |
| ES localization sounds heavier than v0.5 short cards. | v0.6 ES strings are **shorter or equal** in character count to v0.5 (verified per card). |
| Younger-learners card reads exclusionary ("with adults" mandatory). | Body explicitly says "when shared," not "must be." Open to younger users on their own, but the framing nudges adult company without legal liability. |
| Drift between EN authoring (`editorial.ts`) and ES bundle (`messages/es.ts`). | Audit script `pnpm content:audit` already flags missing-ES; spec implementation step includes running it. |

---

## 6. Technical risk

| Area | Risk | Notes |
|---|---|---|
| `editorial.ts` edits | **Bajo** | String-only changes in an existing namespace; no new keys, no signature changes, no helpers added. |
| `messages/es.ts` edits | **Bajo** | Mirror overrides; spread `...en` fallback continues to cover any miss. |
| Components / rendering | **Cero** | `<LandingAudiences>` already iterates `cards[]` of arbitrary length; reordering and rewording is data-driven. |
| Tests | **Bajo** | A few tests may snapshot copy strings. Likely candidates: `apps/web/src/lib/content/__tests__/*` and any `landing*.test.ts`. Implementation step grep for "Kids and teens" / "start early" / "earlier you start" / "Welcome, friend" before editing. |
| VR baselines | **Medio** | Landing VR baselines will redden on any visible copy change. Same-PR baseline refresh per VR-baseline-discipline rule. Affected: landing audience grid section only (splash is out of scope). |
| i18n audit (`pnpm content:audit`) | **Bajo** | No new keys; no jargon terms added; no medical claims. |
| Anti-AI prose ceiling test | **Bajo** | All proposed strings are em-dash free. |
| Long-string-in-button-like-path audit | **Bajo** | No button keys touched. |
| `landing-narrative-v0.5.md` spec | **Marca como SUPERSEDED** | Spec front-matter updates only; cross-link both ways. |

---

## 7. Recommended phased rollout

### Phase A — Copy + spec (Day 0)

1. Update v0.5 spec front-matter: bump to `status: superseded` and add a
   pointer to this v0.6 doc.
2. Edit `LANDING_COPY.audiences.title`, `LANDING_COPY.audiences.cards`,
   `LANDING_COPY.problem.claims[1]` in `editorial.ts` (EN).
3. Mirror the same three keys in `messages/es.ts` (ES overrides).
4. Run `pnpm content:audit` and fix any flag (expected: zero).
5. Commit: `feat(landing): adopt v0.6 beginners-first narrative`.

### Phase B — Tests + VR baseline refresh (same PR as A)

1. Grep for snapshot references to the old strings; update or relax matchers.
2. Run `pnpm test` (unit + RTL).
3. Run `pnpm test:e2e:visual --grep landing` to refresh affected baselines.
4. Verify diff PNGs only show the expected text changes (no layout drift).
5. Commit baseline refresh as a separate commit (`chore(vr): refresh landing
   baselines for v0.6 narrative`).

### Phase C — Post-ship verification

1. Smoke landing on `chesscito.com` and on a MiniPay test device.
2. Verify ES locale renders the new card titles correctly.
3. Confirm OG image / share previews still render (no font width regression on
   the new card titles).
4. Update `MEMORY.md` index entry to point at the v0.6 spec.
5. Close the audit TODO `#9–#11` block in
   `docs/audits/2026-06-02-copy-narrative-audit.md` §4.6 (item #12 splash
   stays open as a future spec).

> Splash (`HUB_V2_SPLASH_COPY.title`) is intentionally not part of v0.6. See §11.

---

## 8. Out-of-scope (will not be touched in v0.6)

- `HUB_V2_SPLASH_COPY.title` (separate design-lock; see §11 future note).
- Hero, problem opener, solution, howItWorks, capabilities, plans, impact,
  founders, finalCta, footer, microcopy blocks.
- Tier pricing or PRO commercial copy (locked by M1 cluster).
- Terms of Service or Privacy Policy copy (tracked separately under audit
  §4.6 TODO #1, legal review required).
- MiniPay listing claims (covered by audit §4.6 TODO #3, vigente hasta listing
  oficial).
- Cognitive disclaimer wording (legal-adjacent, locked).
- Any layout, component, route, or asset changes.

---

## 9. Open questions

1. Card 0 EN title uses the ampersand ("Casual players & curious beginners")
   matching the v0.6 decision in §3.2. Confirm this is the final form before
   implementation; the alternative ("Casual players, curious beginners")
   stays available if Wolfcito prefers the comma.

---

## 10. Acceptance criteria

Spec v0.6 is considered "ready to implement" when:

- [ ] Q1 (ampersand vs comma) confirmed.
- [ ] No new medical, MiniPay-availability, or jargon claims slipped into the
  proposed strings.
- [ ] Wolfcito signs off on the new card order.

Spec implementation (Phase A onward) is gated on all of the above.

---

## 11. Future notes (post-v0.6)

- **`HUB_V2_SPLASH_COPY.title`** — out of scope for v0.6 by explicit decision.
  Stays as `"Welcome, friend"` / `"Bienvenido"` until a separate spec
  coordinates with the splash design-lock §2.1 owner. Candidate wording for
  that future spec: EN `"Welcome back"` (returning users) or
  `"Welcome to Chesscito"` (first visit); ES gender-neutral options like
  `"Hola de nuevo"` or `"Bienvenida/o"` to be decided with the locale team.
  Audit TODO item #12 remains open until that spec lands.
