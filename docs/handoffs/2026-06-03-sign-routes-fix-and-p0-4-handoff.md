# Handoff — Sign-routes labyrinth env fix + P0-4 zero-click closure (2026-06-03)

**Session window:** 2026-06-03 (single session, ~4 hours)
**Cluster:** MiniPay readiness P0-4 + emergent sign-routes fix sub-cluster
**Status at close:** main = production = `6cd6fcab` (docs); functional HEAD = `08a50a72`
**Outcome:** P0-4 closed PASS, prod sign-routes restored, MiniPay readiness 6/9 → 7/9.

---

## 1. Estado final de branches

| Branch | HEAD | Notes |
|---|---|---|
| `origin/main` | `6cd6fcab` | docs-only ahead of production (no promote needed) |
| `origin/production` | `08a50a72` | Functional state — all signing routes restored |
| Diff main → production | 1 commit ahead (docs) | `6cd6fcab docs(audits): close MiniPay P0-4 zero-click runtime validation` |

Production HEAD `08a50a72` está vivo y firmando correctamente en `https://www.chesscito.com`.

---

## 2. Sub-cluster sign-routes — labyrinth env fix

### Root cause

Commit `ac149a1e feat(api): wire sign-labyrinth to LabyrinthBadges address` (sesión anterior, no esta) agregó `requireEnv("NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS")` al bloque eager de `getDemoConfig()` en `apps/web/src/lib/server/demo-signing.ts`.

Esa función la consumen **las 4 rutas de signing** (sign-score, sign-victory, sign-badge, sign-labyrinth), no solo sign-labyrinth. La env var Labyrinth no existe en mainnet (LabyrinthBadges sigue en Sepolia, D.2 mainnet promote queued — ver memoria `labyrinth-v02-phase-d1`).

Resultado: `getDemoConfig()` lanzaba `Missing required env: NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` antes de que cualquier ruta llegara a su lógica → **400 en sign-score, sign-victory y sign-badge en prod desde commit `ac149a1e` hasta hoy**.

### Síntomas observados durante P0-4 testing

- iOS + Android, preview + production:
  - `/exercises` → Save Score → `400 /api/sign-score` con UX "Signing service unavailable. Try again in a moment."
  - Arena mate real → Save Victory → `400 /api/sign-victory` con misma UX.
  - `/coach/[id]` Match Review Save Victory → mismo 400.
- Shop purchases funcionaban (path distinto, no consume `getDemoConfig`).
- Resign / Draw correctamente bloqueados en cliente (no llegaban al server).

### Fix shipped

| Commit | Rol | Notes |
|---|---|---|
| `8ce7ecf8 debug(api): temp log error message on sign-victory and sign-score 400` | Diagnóstico | 2 líneas `console.error` para surfacear el `{error}` exacto en Vercel runtime logs |
| `8c28c3d4 fix(api): scope labyrinth env requirement to sign-labyrinth route` | Fix | Refactor `getDemoConfig()` removiendo labyrinth eager req; nuevo export `getLabyrinthBadgesAddress()` invocado solo por sign-labyrinth; mocks de los 4 tests alineados |
| `08a50a72 revert(debug): remove temp 400 logs in sign-score/sign-victory` | Cleanup | Revierte las 2 líneas de debug una vez confirmada la causa raíz |

Vitest local: 5 files, 71/71 passing post-fix.

### Verificación

- Preview: Save Score + Save Victory → 200 con signature payload válido.
- Production smoke (post-promote): confirmado por usuario.
- sign-labyrinth sigue 400 en mainnet (correcto — contrato no existe ahí; saldrá del 400 cuando D.2 mainnet promueva).

### Memoria escrita

- `feedback_sign_routes_labyrinth_env_fix.md` — regla dura: nunca agregar `requireEnv` eager a `getDemoConfig` compartido; chain-specific env reqs van en getters dedicados.

---

## 3. P0-4 zero-click runtime — PASS

### Golden path 6/6

| Step | Surface | Resultado |
|---|---|---|
| 1 | Open URL in MiniPay | ✅ landing renders 390px sin overflow |
| 2 | Detect MiniPay context | ✅ wallet auto-injectada, sin Connect modal |
| 3 | Auto-route → `/hub` | ✅ sin tap manual |
| 4 | `/hub` HUD without Connect | ✅ truncated address visible, no Connect CTA |
| 5 | Account sheet con address | ✅ sheet abre con wallet bound |
| 6 | Shop lee balance + permite compras | ✅ pricing visible, compras múltiples exitosas |

### Sign-off

- Production HEAD at close: `08a50a72`.
- Devices: Android primary; iOS smoke (no-blocker, todo OK).
- Results doc: `docs/audits/2026-06-03-minipay-zero-click-runtime-results.md`.
- Tester guide reusable para futuras re-validaciones: `docs/audits/2026-06-03-minipay-zero-click-tester-guide.md`.
- Technical checklist (Pass/Fail criteria, evidence format, failure triage): `docs/audits/2026-06-03-minipay-zero-click-runtime-checklist.md`.

---

## 4. Commits de la sesión (cronológico)

| # | Hash | Type | Rol |
|---|---|---|---|
| 1 | `9139c393` | docs | Persist 2026-06-03 session trail (4 docs huérfanos de clusters previos) |
| 2 | `8ce7ecf8` | debug | Temp console.error en sign-score/sign-victory para surfacear mensaje 400 en Vercel logs |
| 3 | `8c28c3d4` | fix | Scope labyrinth env req a sign-labyrinth route (root-cause fix) |
| 4 | `08a50a72` | revert | Remove temp debug logs (cleanup post-diagnóstico) |
| 5 | `6cd6fcab` | docs | Close MiniPay P0-4 zero-click runtime validation (3 docs P0-4) |

Promote a production ejecutado tras commit 4 (FF main → production en HEAD `08a50a72`). Commit 5 es docs-only, no requiere promote.

---

## 5. MiniPay readiness checklist actualizado

| # | Item | Estado | Notes |
|---|---|---|---|
| P0-1 | PageSpeed 90+ mobile `/hub` | 🟡 **79-83** | Gap 7-11 puntos al target; decisión binaria próxima sesión |
| P0-2 | Canonical `www.chesscito.com` | ✅ | Cerrado sesión previa |
| P0-3 | 360×640 viewport coverage | ✅ | Cerrado sesión previa |
| P0-4 | Zero-click connect runtime | ✅ | **Cerrado esta sesión** |
| P1-5 | `/stats` page MVP | ✅ | Cerrado sesión previa |
| P1-6 | CELO oculto MiniPay | ✅ | Cerrado sesión previa |
| P1-7 | Identity ODIS phone-first | ❌ | Scope mayor, no abrir sin cluster propio |
| P1-8 | Copy sweep extended | ✅ | Cerrado sesión previa |
| P1-9 | Low-balance → Add Cash | ✅ | Cerrado sesión previa |

**Score: 7 de 9 closed.** Sub-cluster sign-routes fix no estaba en el checklist pero era blocker silencioso de P0-4 — resuelto en paralelo.

---

## 6. Pendientes verdaderos para próxima sesión

### P0-1 — PageSpeed 79-83 vs ≥90 target

- Estado: 3-run median Lighthouse mobile contra `https://www.chesscito.com/hub`.
- Métricas finales: perf **79-83**, LCP **4165ms**, CLS 0 estable, single-fetch ✅, -140KB por visita.
- Wall pendiente: `HubDailyTile` gate `if (!hydrated) return placeholder` (`apps/web/src/components/hub/hub-daily-tile.tsx:81-89`).
- Opciones de cluster (ver `docs/handoffs/2026-06-03-hub-perf-p0-1-handoff.md` §6):
  - **A**: HubDailyTile SSR refactor — expected perf 88-92, half-day, riesgo medio.
  - **B**: Lazy wagmi/RainbowKit — expected perf 85-90, 1-2 días, riesgo alto.
  - **C**: Tailwind/CSS purge — +3-5 puntos, 1 día, no cierra el gap solo.

### P1-7 — Identity ODIS phone-first

- Scope mayor (cluster propio, no incremental).
- Sin acción esta sesión.

---

## 7. Recomendación para próxima sesión

### Primera decisión binaria

Antes de cualquier código, decidir:

**A) Aceptar 79-83 como MVP floor para submission** y mover P0-1 a estado "DEFERRED — acceptable for initial listing". Pasar directamente a P1-7 ODIS o a otras priorities (handoff doc, marketing, etc.).

**B) Abrir cluster mayor HubDailyTile SSR** para cerrar el gap perf hacia ≥90. Requiere spec → red-team → TDD → VR baselines refresh. Half-day a 1 día.

Bias actual del usuario (memoria `bundle-dont-defer`, `vr-baseline-discipline`): si el cluster cabe en una sesión limpia, ir por B; si no, A + P1-7.

### Surfaces prohibidos sin abrir cluster explícito

Mantener vigentes las prohibiciones del cluster P0-1 + las que se agregaron esta sesión:

- `/stats` — cluster cerrado, no más polish.
- `/api/founder-status` — mitigado, cura real diferida a C1 Redis write-through.
- Labyrinth (Phase D contract mainnet) — standby por decisión usuario.
- **Sign-routes (sign-score, sign-victory, sign-badge, sign-labyrinth)** — recién estabilizados; cualquier cambio requiere re-validación P0-4 light.
- ODIS / phone-first identity (P1-7) — scope mayor.
- wagmi/RainbowKit, RewardColumn SSR, KingdomAnchor, HubActionTile, `globals.css` purge — surfaces P0-1 prohibidos.
- Perf profunda (re-encoding de assets, lazy bundles, etc.) sin VR baseline plan.

Si alguno de estos surfaces aparece en el scope de la próxima sesión, **abrir spec + red-team antes de editar**.

---

## 8. Memoria sync hecha esta sesión

| Archivo | Tipo | Rol |
|---|---|---|
| `feedback_terse_action_bias.md` | feedback | User flagged "te quedas pensando mucho"; bias to execute approved actions |
| `feedback_sign_routes_labyrinth_env_fix.md` | feedback | Hard rule: nunca eager `requireEnv` en `getDemoConfig` compartido |
| `project_minipay_zero_click_p0_4_pass_2026_06_03.md` | project | P0-4 PASS state + readiness 7/9 + cross-ref al labyrinth fix |

MEMORY.md actualizado con 3 entradas (1 línea cada una bajo Key Conventions + Project Memory).

---

## 9. Documentos generados esta sesión

- `docs/handoffs/2026-06-03-sign-routes-fix-and-p0-4-handoff.md` (este archivo)
- `docs/audits/2026-06-03-minipay-zero-click-runtime-checklist.md`
- `docs/audits/2026-06-03-minipay-zero-click-tester-guide.md`
- `docs/audits/2026-06-03-minipay-zero-click-runtime-results.md`

Más el persist del trail de sesiones previas en commit `9139c393`.

---

## 10. Open questions (para próxima sesión)

1. **P0-1 perf decision** — A (aceptar floor) vs B (HubDailyTile SSR cluster). Requiere alineación de submission timeline.
2. **Labyrinth D.2 mainnet promote** — sigue queued (memoria `labyrinth-v02-phase-d1`). Sin urgencia inmediata mientras Sepolia cubre testing.
3. **Founder-status cura real (C1 Redis write-through)** — cluster propio, no urgente mientras volumen on-chain sea bajo.
4. **Sign-routes test coverage** — los tests pasaron post-fix, pero el regression de `ac149a1e` no fue captada por suite alguna. Considerar agregar integration test que ejecute `getDemoConfig()` real con env vars mínimas (sin labyrinth) y valide que no lanza.

---

## Closing note

Sesión cerrada con un blocker P0 silencioso de producción resuelto (sign-score/sign-victory/sign-badge) + P0-4 oficialmente cerrado a 7/9 readiness. Bug colateral del cluster Labyrinth quedó documentado como hard rule para no repetirlo. Cero regresiones (71/71 vitest passing en las 5 suites tocadas).

Próximo gate decision-binaria: **aceptar perf floor o invertir media-jornada más en HubDailyTile SSR**. La sesión que retome puede arrancar directamente con esa decisión, sin re-explorar el código de signing ni el path P0-4.
