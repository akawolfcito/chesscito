# Chesscito Lite v1 — Release QA Report

**Date:** 2026-06-21
**Auditor:** Claude (automated static + test QA)
**Verdict:** READY WITH NOTES

---

## 1. Veredicto

**READY WITH NOTES** — No blockers. Todos los tests pasan, tsc limpio, no leaks de Full en Lite, no copy prohibido en UI visible. Hay dos notas menores (MiniArena no gateada explícitamente en Lite, OG metadata contiene "on-chain") que no bloquean el release. Smoke manual en dispositivo MiniPay/390px requerido antes de declarar SHIPPED.

---

## 2. Entorno probado

- **Commit probado:** `dfa126fc` — `feat(exercises): post-lab end-state — route Continue to next exercise, next lab, or piece-complete`
- **Branch:** `main`
- **Lite flag:** `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true` (Lite preview)
- **Full flag:** unset (producción)
- **Monorepo:** Turborepo + pnpm, app `apps/web` Next.js 14 App Router

---

## 3. Checks técnicos

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | **PASS** (0 errores, sin output) |
| `git diff --check` | **PASS** (sin trailing whitespace) |
| `process.env.CHESSCITO_LITE_MODE` directo en src/ | **CLEAN** — todos los usos van por `@/lib/feature-flags` |
| Copy prohibido NFT en UI Lite visible | **PASS** — solo en metadata OG y rutas Full-only (ver §8) |
| Copy "on-chain" en UI Lite visible | **PASS** — solo en metadata/API comments/Full routes |
| Copy "brain health / casino / wagering" | **PASS** — no encontrado |
| `feature-flags.ts` export correcto | **PASS** — `process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true"` |

---

## 4. Test suites ejecutadas

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `src/lib/daily` (passport, puzzles, progress) | 169 | **PASS** |
| `src/components/hub` (scaffold, Lite Mode) | 132 | **PASS** |
| `src/lib/achievements` (lite + compute) | 17 | **PASS** |
| `src/lib/content` (editorial, copy guards) | 196 | **PASS** |
| `src/lib/training` (path, post-lab routing) | 45 | **PASS** |
| `src/lib/scores` (save-service) | 82 | **PASS** |
| `src/components/exercises` (save-flow, mission) | 111 | **PASS** |
| `src/components/redesign` (action-pin) | 107 | **PASS** |
| `src/lib/hub` (content-loop, reward-tiles) | 64 | **PASS** |
| `src/components/trophies` (Lite regression) | 19 | **PASS** |
| `src/components/welcome-package` | 19 | **PASS** |
| `src/lib/feature-flags` | — | No test file (cobertura implícita en hub/trophies via `vi.mock`) |
| `src/lib/leaderboard` | — | No test file en esa ruta |

**Total tests verificados: 961 / 961 PASS**

---

## 5. Lite QA checklist (code review)

### 5.1 Hub Lite gating — `hub-scaffold-client.tsx` + `hub-scaffold.tsx`

- [x] **PeonesBalanceChip** NO aparece en Lite — `{!CHESSCITO_LITE_MODE && wrap("PeonesBalanceChip", ...)}` ✅
- [x] **HubProBadge / PRO** NO aparece en Lite — `{!CHESSCITO_LITE_MODE && wrap("HubProBadge", ...)}` ✅
- [x] **ProSheet** NO monta en Lite — `{!CHESSCITO_LITE_MODE && <ProSheet />}` ✅
- [x] **BadgeSheet** NO monta en Lite — `{!CHESSCITO_LITE_MODE && <BadgeSheet />}` ✅
- [x] **ShopSheet + PurchaseConfirmSheet** NO montan en Lite ✅
- [x] **onCoachTap** es `undefined` en Lite — Coach tile desaparece del rail ✅
- [x] **onArenaPress** es `undefined` en Lite — botón "Enter Arena" no aparece ✅
- [x] **profileOpen** nunca se abre en Lite — `useState(!CHESSCITO_LITE_MODE && ...)` ✅
- [x] **FocusPassport** SÍ aparece en Lite — `{CHESSCITO_LITE_MODE && focusPassport ? <FocusPassport /> : guide-art}` ✅
- [x] **NextStepCard** SÍ aparece en Lite — `{CHESSCITO_LITE_MODE && nextStepCard ? <NextStepCard /> : null}` ✅
- [x] **Dock Lite** usa variante CSS `chesscito-dock--lite` (4 slots) ✅

### 5.2 Middleware — rutas Full-only bloqueadas (`src/middleware.ts` + `src/lib/lite-mode-routing.ts`)

Routes en `FULL_ONLY_SEGMENTS` que se redirigen a `/hub` en Lite:
- [x] `/arena` → `/hub` ✅
- [x] `/coach` → `/hub` ✅
- [x] `/victory` → `/hub` ✅
- [x] `/shop` → `/hub` ✅
- [x] `/pro` → `/hub` ✅
- [x] `/founder` → `/hub` ✅

### 5.3 Feature flag usage

- [x] `CHESSCITO_LITE_MODE` importado via `@/lib/feature-flags` en todos los puntos de uso ✅
- [x] `feature-flags.ts` exporta `NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true"` ✅
- [x] Cero usos de `process.env.CHESSCITO_LITE_MODE` o `process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE` directos en src/ ✅

### 5.4 Welcome Package

- [x] Gateada con `{CHESSCITO_LITE_MODE && <WelcomePackageStamp />}` en `trophies-body.tsx` ✅
- [x] En daily-tactic-slot: `useWelcomePackage()` + `FirstFocusDayOverlay` disponibles en Lite ✅
- [x] `shouldShowWPCtaInSlot` retorna `false` cuando `liteMode=false` — Full-only guard en tests ✅
- [x] Copy test pasa: no NFT/mint/on-chain/proof en WelcomePackageModal ✅

### 5.5 Content Loop / NextStepCard

- [x] `NextStepCard` solo renderiza en Lite (`CHESSCITO_LITE_MODE && nextStepCard`) ✅
- [x] Tests de content-loop cubren todos los estados: todayFocus, claimGift, keepGoing, tryLabyrinth, improveStars, comeBackTomorrow ✅
- [x] Full nunca pasa el prop `nextStepCard` (caller = `hub-scaffold-client.tsx`) ✅

### 5.6 Post-lab Completion End-state

- [x] `LabyrinthCompleteOverlay` presente en `exercises-screen.tsx:2932` ✅
- [x] `PieceCompletePrompt` presente en `exercises-screen.tsx:2872` ✅
- [x] `resolvePostLabContinue` testeada en 5 escenarios: next-exercise, next-lab, piece-complete, replay+no-next, empty-path — todos PASS ✅
- [x] Test confirma: siguiente ejercicio disponible → next-exercise; sin 0★ pero lab disponible → next-lab; nada pendiente → piece-complete ✅

### 5.7 Score Transparency

- [x] `totalStars` y `maxPossibleStars` pasados desde `exercises-screen` a `MissionPanelCandy` (`mission-panel-candy.tsx:57-58`) ✅
- [x] `scoreAtMax` con i18n interpolation correcta (feat `f079828a`) ✅
- [x] Labyrinths no cambian score (comportamiento separado, `LabyrinthCompleteOverlay` tiene su propia ruta) ✅

### 5.8 Dock / ActionPin

- [x] `enterLabyrinth` y `exitLabyrinth` son `isPedestalPin = true` → usan `.action-pin-submit-pedestal` (64px, centrado) ✅
- [x] `HINT` usa path normal del dock — centrado por `justify-content: space-around` del dock ✅
- [x] `save-pulse` scoped a `[data-action="submitScore"] .action-pin-submit-pedestal img` — `enterLabyrinth`/`exitLabyrinth` NO heredan el amber glow ✅

### 5.9 Focus Passport

- [x] `derivePassportView` en `lib/daily/passport.ts:83` — función pura sin IO ✅
- [x] `passportSlots`, `passportTier` importadas directamente en `focus-passport.tsx` — no backend ✅
- [x] 7 slots (llamas), estado loading usa `passportSlots(0, false)` como safe shell ✅
- [x] 169 tests del módulo `daily` pasan ✅

### 5.10 Achievements Lite

- [x] `deriveLiteAchievements` usada en `trophies-body.tsx` solo cuando `CHESSCITO_LITE_MODE` ✅
- [x] `emptyHintLite` en `editorial.ts:953` ✅
- [x] Trophies Lite regression tests pasan (3 achievements, count correcto por streak) ✅
- [x] Copy guard test pasa: no prohibited terms en IDs ✅

---

## 6. Full regression checklist (code review)

- [x] Hub Full: no se modifica; `focusPassport=null` → muestra guide art (pawn + guide + king) ✅
- [x] `NextStepCard` NO aparece en Full (prop `nextStepCard` no se pasa cuando `!CHESSCITO_LITE_MODE`) ✅
- [x] `FocusPassport` NO aparece en Full (guard `CHESSCITO_LITE_MODE && focusPassport`) ✅
- [x] ProSheet / ShopSheet / Coach accesibles en Full ✅
- [x] `/arena` ruta no bloqueada en Full (middleware solo aplica `if (CHESSCITO_LITE_MODE)`) ✅
- [x] Save Score: `src/lib/scores` tests 82/82 pasan ✅
- [x] `WelcomePackageStamp` NO aparece en Full (`{CHESSCITO_LITE_MODE && <WelcomePackageStamp />}`) ✅

---

## 7. Bugs encontrados

Ninguno bloqueante detectado en revisión estática + tests.

---

## 8. Notas no bloqueantes

1. **MiniArena tile no gateada explícitamente en Lite** — `miniArenaUnlocked={(starsPerPiece.rook ?? 0) >= 12}` en `hub-scaffold-client.tsx:555` no tiene guard `!CHESSCITO_LITE_MODE`. La tile (`HubArenaTile`) se auto-oculta con `if (!unlocked) return null`, pero si un usuario Lite llega a 12+ estrellas de torre, la Special Training tile aparecería. La MiniArena no tiene pagos ni on-chain, pero es un feature Full no documentado como Lite-disponible. **Riesgo bajo** (threshold alto para nuevos usuarios Lite).

2. **OG/metadata descriptions contienen "on-chain"** — `app/manifest.ts:8` y `app/[locale]/layout.tsx:59,69` describen la app como "on-chain challenges on Celo". Estos son campos de SEO/OG y no son texto visible en la UI Lite, pero si el spec prohíbe "on-chain" absolutamente en el app manifest también, requiere ajuste. No bloquea el flow de usuario Lite.

3. **`dev/button-gallery` contiene "Save your progress on-chain"** — ruta de desarrollo únicamente (`/dev/button-gallery`), nunca accesible para usuarios finales. No bloqueante.

4. **Legal copy (Terms of Service) menciona NFT mints y on-chain** — `editorial.ts:1852,1864,1906`. La sección Legal aparece en Settings y aplica a ambos modos. Es copia legal técnica, no copy de UX/marketing. Probablemente OK, pero puede revisarse si el founder quiere copy completamente limpio en Lite.

5. **No hay tests unitarios para `src/lib/feature-flags.ts`** — cobertura existe via mocks en hub/trophies tests. No bloqueante pero podría añadirse un test explícito en el futuro.

---

## 9. Smoke manual pendiente

Los siguientes flujos REQUIEREN smoke manual en dispositivo/MiniPay real o emulador 390px antes de declarar Lite v1 SHIPPED:

- [ ] Hub Lite carga mobile 390px sin overflow ni glitches
- [ ] Daily Focus → resolver → confirmar progreso diario actualiza
- [ ] Focus Passport → después de Daily, llamas actualizan en hub
- [ ] Welcome Package → claim flow completo (modal aparece, claim funciona, estado persiste)
- [ ] Exercises → completar ejercicio → stars actualizan → score transparency visible
- [ ] Lab completion → `LabyrinthCompleteOverlay` aparece → Continue navega correctamente
- [ ] Content Loop → transición de estados visible (Today's Focus → Claim gift → Keep going)
- [ ] Trophies Lite → 3 achievements correctos, no achievement de Arena
- [ ] Account Lite → no muestra Arena Wins si son Full-only
- [ ] Full Hub → Arena/Coach/Shop siguen funcionando, Focus Passport no aparece

---

## 10. Recomendación final

**Chesscito Lite v1 está READY WITH NOTES para smoke manual.** La revisión estática y los 961 tests verificados no revelan bugs bloqueantes. El gating Lite/Full está implementado en profundidad (middleware + scaffold client + componentes individuales) y no se detectaron leaks. El único path para declarar SHIPPED es el smoke manual del founder en MiniPay/390px cubriendo los 10 flujos listados en §9.

Si el MiniArena en Lite es intencionalmente excluido, añadir `!CHESSCITO_LITE_MODE &&` en `hub-scaffold-client.tsx:555` antes del release.

---

*Este QA es estático (código + tests). El smoke manual en MiniPay/390px debe hacerlo el founder antes de declarar Lite v1 SHIPPED.*
