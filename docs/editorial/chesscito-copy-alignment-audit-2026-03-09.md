# Chesscito Copy Alignment Audit

Date: 2026-03-09

Source of truth:
- `docs/editorial/chesscito-ux-writing-brief-v1.md`

Audit scope:
- visible product copy
- CTA language
- onboarding and tutorial-adjacent copy
- move feedback
- score and claim flow
- metadata-related naming

## Executive summary

The current app copy is not aligned with the approved editorial direction.

Primary issues:
- visible copy mixes Spanish and English in the same surfaces
- terminology changes by component for the same concept
- CTA labels are icon-short and ambiguous in key action areas
- feedback states use internal or technical phrasing instead of player-first copy
- badge naming is not yet operationalized in app-facing language or metadata docs
- some helper copy still reflects QA or implementation framing rather than product framing

Highest-risk editorial issue:
- the app currently violates the approved localization rule of English-first visible product copy and English-only metadata by presenting mixed-language UI across the home screen, play hub, overlays, and flow messaging

## Findings by category

### 1. Localization conflicts

Examples:
- Home mixes English and Spanish in the same screen:
  - `Mini-juegos pre-ajedrecisticos...` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L9)
  - `Entrar al Play Hub` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L10)
  - `Play Hub centraliza challenge, compra y prueba on-chain.` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L16)
- Play hub uses Spanish labels for pieces and statuses while core piece naming in code is English:
  - `Torre`, `Alfil`, `Caballo` in [play-hub/page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/play-hub/page.tsx#L485)
  - `Mision`, `Estado`, `Wallet desconectada`, `Challenge completado` in [status-strip.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/status-strip.tsx#L29)
- Purchase and shop overlays mix English and Spanish:
  - `Arcane Store (USDC)` + `Selecciona un artefacto...` in [shop-sheet.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/shop-sheet.tsx#L34)
  - `Confirmar compra` + `Unknown transaction` warning in [purchase-confirm-sheet.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/purchase-confirm-sheet.tsx#L36)

Impact:
- breaks editorial consistency
- weakens first-30-second clarity
- makes metadata and product naming harder to stabilize

### 2. Terminology conflicts

Examples:
- The same concept is called `challenge`, `mission`, `trial`, `exercise`, and `piece path` across the repo:
  - `Challenge completado` in [status-strip.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/status-strip.tsx#L29)
  - `Mision` in [status-strip.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/status-strip.tsx#L35)
  - `Ejercicio` in [exercise-stars-bar.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/exercise-stars-bar.tsx#L38)
  - `Play Hub centraliza challenge...` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L16)
- The badge action is described as `Badge`, `Claim`, `Claim Badge`, and `claim badge`:
  - `label="Badge"` in [onchain-actions-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/onchain-actions-panel.tsx#L109)
  - `Claim en progreso` in [status-strip.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/status-strip.tsx#L51)
  - server and log strings use `claim badge` phrasing in [play-hub/page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/play-hub/page.tsx#L353)
- Score terminology shifts between `Score`, `Submit`, `pts`, `puntaje`, and `score`:
  - `label="Score"` in [onchain-actions-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/onchain-actions-panel.tsx#L117)
  - `Enviar puntaje` in docs/demo flow
  - `pts` in [leaderboard/page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/leaderboard/page.tsx#L30)

Impact:
- the user does not get one stable mental model per action
- engineering lacks a fixed content taxonomy for future features

### 3. CTA inconsistencies

Examples:
- Home CTA is Spanish and product-location oriented instead of action-first:
  - `Entrar al Play Hub` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L10)
- Play hub primary actions are icon-only with screen-reader labels `Badge` and `Score`, which are nouns rather than explicit actions:
  - [onchain-actions-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/onchain-actions-panel.tsx#L105)
- Shop CTA uses `Comprar`, which conflicts with English-first direction:
  - [shop-sheet.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/shop-sheet.tsx#L46)
- Purchase confirmation CTA uses `Confirmar compra`, which is clear but not aligned to English-first:
  - [purchase-confirm-sheet.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/purchase-confirm-sheet.tsx#L86)

Impact:
- core actions are less scannable than the approved CTA set
- icon-only action labels increase ambiguity on a mobile-first surface

### 4. Tone and clarity issues

Examples:
- Some copy reads like internal implementation guidance rather than product guidance:
  - `submitScore + claimBadge live in the next slices.` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L20)
  - `Mobile-first routes ready for MiniPay device testing.` in [page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/page.tsx#L24)
  - `Aqui se conectara el endpoint...` in [leaderboard/page.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/leaderboard/page.tsx#L11)
- Some feedback copy is functional but not yet aligned to the target tone:
  - `✓ ¡Correcto! Siguiente ejercicio...` in [mission-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/mission-panel.tsx#L30)
  - `✗ No era esa casilla, inténtalo de nuevo` in [mission-panel.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/mission-panel.tsx#L31)
- The warning `MiniPay puede mostrar "Unknown transaction"` is useful, but it should be normalized under a product-approved explanatory style:
  - [purchase-confirm-sheet.tsx](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/components/play-hub/purchase-confirm-sheet.tsx#L70)

Impact:
- visible copy sometimes sounds like staging text instead of production-ready UX writing
- some strings explain the system before the action

### 5. Metadata naming and glossary gaps

Findings:
- no checked-in badge metadata JSON appears to exist yet for the live badge set
- the approved naming system `Rook Ascendant`, `Bishop Ascendant`, `Knight Ascendant` is not yet formalized in implementation-facing docs outside the brief
- current action labels and piece labels do not yet reinforce the approved English-first badge system

Impact:
- metadata work could drift into alternate badge titles unless anchored now
- product, design, and engineering lack a shared reusable metadata vocabulary

### 6. Onboarding and first-move clarity gaps

Findings:
- the current first-entry home screen does not clearly explain:
  - what a `Trial` is
  - what a `Piece Path` is
  - what success looks like
  - what the next action is
- play hub feedback exists, but there is no clear English-first tutorial framing that introduces the current piece path before action

Impact:
- the first 30-second clarity goal is only partially satisfied

## Prioritized alignment plan

| Priority | Category | Issue | Current wording | Recommended wording or rule | Affected surface |
| --- | --- | --- | --- | --- | --- |
| P0 | Localization | Mixed ES/EN across visible product surfaces | `Entrar al Play Hub`, `Challenge completado`, `Tienda`, `Ver leaderboard completo` | Convert visible product copy to English-first. Do not mix Spanish and English on the same screen until a real localization layer exists. | Home, Play Hub, sheets, leaderboard, tx feedback |
| P0 | Terminology | Unstable concept naming for the same player action | `challenge`, `mision`, `ejercicio`, `leaderboard`, `puntaje` | Lock glossary terms from the brief. Use one term per concept: `Trial`, `Piece Path`, `Claim Badge`, `Submit Score`, `Progress`, `Leaderboard`. | App-wide |
| P0 | CTA system | Primary actions are not explicit verbs | `Badge`, `Score`, `Entrar al Play Hub`, `Comprar` | Use action-first CTAs. Preferred set: `Start Trial`, `Make Your Move`, `Try Again`, `Continue`, `Claim Badge`, `Submit Score`. | Home CTA, Play Hub action bar, shop, modal flows |
| P1 | Tone | Some copy sounds like staging or implementation text | `submitScore + claimBadge live in the next slices.` | Replace implementation-facing copy with user-facing value language. Rule: describe the action or outcome, never the roadmap or plumbing. | Home, leaderboard placeholder, helper text |
| P1 | Move feedback | Success and failure states are not yet aligned to English-first and glossary terms | `✓ ¡Correcto! Siguiente ejercicio...` | Normalize to concise, action-leading feedback, for example `Path complete. Continue.` and `Not this square. Try again.` | Move feedback, mission state |
| P1 | Onchain status copy | Status strings are mixed-language and partly system-first | `Estado:`, `Mision:`, `Claim en progreso` | Rewrite key state messages in English and explain the player action before system state. Example rule: `Claiming badge...` before technical confirmation detail. | Status strip, tx feedback cards |
| P1 | Metadata naming | Badge titles not yet operationalized in app docs and future metadata templates | none formalized outside brief | Create metadata templates that use only `Rook Ascendant`, `Bishop Ascendant`, `Knight Ascendant` and English-only descriptions and attribute labels. | Metadata workflow, IPFS prep |
| P2 | Shop tone | Shop naming leans more fantasy than the current subtle-magical brief allows | `Arcane Store`, `artefacto`, `Hechizo Lvl 3`, `Pocion de vida` | Keep magic subtle, not theatrical. Audit shop naming separately and decide whether shop inventory belongs inside the same editorial system or its own content system. | Shop sheet, purchase sheet, catalog data |
| P2 | Accessibility and clarity | Icon-only action buttons hide meaning visually | icon buttons with sr-only labels | Add short visible verb labels or compact text reinforcement for key actions, at least on primary onchain actions. | Action bar |
| P2 | Placeholder routes | Some screens still present draft-state copy to users | `Aqui se conectara el endpoint...` | Replace draft-state placeholder language with neutral user-facing copy or hide unfinished surfaces behind internal flags. | Leaderboard page |

## Recommended implementation sequence

1. Lock terminology and CTA vocabulary in code-facing docs.
   - Use the brief as the single source of truth.
   - Treat glossary terms as implementation constraints, not suggestions.

2. Align the highest-visibility surfaces first.
   - Home
   - Play Hub core state copy
   - Action bar labels
   - Status and transaction feedback

3. Operationalize badge metadata naming before assets and IPFS upload.
   - Create metadata templates using the approved badge titles.
   - Keep metadata English-only.

4. Normalize onboarding and move feedback.
   - Clarify piece, goal, and next action in the first-play path.
   - Standardize correct and wrong-move responses.

5. Audit secondary surfaces after the core flow is stable.
   - Shop
   - Leaderboard
   - Any remaining placeholder or QA-facing copy

## Recommended next actions for implementation

- Create a small content constants layer for approved glossary terms and CTA labels before broad rewrites.
- Convert the highest-traffic visible strings to English-first in a focused pass.
- Add badge metadata templates and descriptions only after the glossary pass is complete.
- Review shop vocabulary separately if the product intends to keep the fantasy layer; it currently risks overshooting the "subtly magical" tone.
- After the first rewrite pass, run a second audit to catch terminology drift and leftover Spanish strings.
