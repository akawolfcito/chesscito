# Handoff — Chesscito Lite P0 Closure

**Date:** 2026-06-20
**Branch at close:** `main` @ `1c8c264e`
**Decision:** ✅ **Lite P0 CERRADO**

---

## 1. Resumen del cierre P0

El modo **Chesscito Lite** pasó su smoke final en `lite-preview` sin blockers.
Lite presenta una superficie reducida y focus-first (Daily Focus, Exercises,
Labyrinths, Trophies/Progress, Account) ocultando todo lo monetario/Arena
(Shop, PRO, Peones, Founder, Coach, Arena, NFT/mint). Full preview sigue sin
regresiones. Los P0.5 detectados en sesiones previas quedaron resueltos
(`a06f4f44`, `1c8c264e`) y los tres P0.5 restantes se evaluaron como no-blocker.

**Estado al cierre:**
- P0 Lite: **CERRADO** — smoke completo, sin regresión en Full
- **CSS ACCOUNT pill refinements closed:** flat burnt-amber PRO label
  (`rgba(180,83,9,.95)`) + MiniPay anti-flicker verified/closed.
- `production` no promovida en esta sesión

> **CSS ACCOUNT pill refinements closed:** (a) label PRO con color plano
> burnt-amber `rgba(180,83,9,.95)` (reemplaza el `#ffe66e` plano + sombra
> morada, y un gradiente metálico intermedio descartado) y (b) anti-flicker
> del icono flotante en MiniPay WebView (`transform: translateZ(0)` +
> `backface-visibility: hidden` para aislar el `drop-shadow` en su propia capa
> GPU; afecta CONNECT y ACCOUNT). Verificado/cerrado por el founder.

---

## 2. Checklist smoke final (lite-preview)

| # | Verificación | Resultado |
|---|---|---|
| 1 | Hub Lite sin Shop/PRO/Peones/Founder/Coach/Arena | ✅ |
| 2 | Dock Lite sin SHOP | ✅ |
| 3 | Daily Focus carga y es jugable | ✅ |
| 4 | Daily solved muestra overlay celebratorio | ✅ |
| 5 | Daily solved NO muestra Peones | ✅ |
| 6 | Exercises cargan y son jugables | ✅ |
| 7 | Labyrinths cargan y son jugables | ✅ |
| 8 | Trophies/Progress muestra solo Achievements | ✅ |
| 9 | No aparece My Victories ni Hall of Fame/Community | ✅ |
| 10 | Hero band muestra YOUR PROGRESS / SESSIONS | ✅ |
| 11 | Achievements empty hint NO menciona Arena | ✅ |
| 12 | Account solo muestra Wallet/Network/Language | ✅ |
| 13 | Stats sin NFT/mint/minting/Victory NFT/Victory Mints | ✅ |
| 14 | `/arena`, `/shop`, `/coach` redirigen a `/hub` | ✅ |
| 15 | `?sheet=shop` NO abre Shop | ✅ |
| 16 | Share flow funciona | ✅ |
| 17 | Full preview sin regresión visible | ✅ |

**P0.5 evaluados:**
- **P0.5-A** — no se confirmó como blocker durante el smoke.
- **P0.5-B** — `0 SESSIONS` en hero band se considera aceptable por ahora.
- **P0.5-C** — correcto: deep links Full-only bloqueados.

**P0.5 ya resueltos (sesiones previas):**
- Achievements Lite mostraban 7 logros Arena → filtrados a `earned`, counter
  oculto cuando `earnedCount === 0`, `emptyHintLite` visible (`a06f4f44`).
- ACCOUNT pill: gold-text PRO restaurado, flicker `proLoading` eliminado, icon
  jitter MiniPay resuelto moviendo `candy-tray-pill-icon--floating` al
  `<picture>` (`a06f4f44` + `1c8c264e`).

---

## 3. Evidencia / screenshots

**Pendiente de capturar** en `lite-preview` (para grant pack + archivo de cierre):

- [ ] Hub Lite (sin Shop/PRO/Peones)
- [ ] Daily Focus jugable
- [ ] Daily solved — overlay celebratorio
- [ ] Trophies/Progress — solo Achievements + hero band YOUR PROGRESS
- [ ] Account — solo Wallet/Network/Language
- [ ] Stats — sin lenguaje NFT/mint
- [ ] ACCOUNT pill (flat burnt-amber PRO label, sin flicker) en MiniPay

Guardar en `docs/grants/assets/` o `private/screenshots/lite-p0/` y enlazar
desde el grant pack (`docs/grants/2026-06-20-chesscito-lite-grant-pack.md`).

---

## 4. Riesgos pendientes (no bloqueantes)

- **Hero band "0 SESSIONS"** en Lite: `victoryCount` usa Arena victories;
  `heroEmptyHintLite` cubre el vacío. Mejorar requiere un contador de sesiones
  Lite real (candidato P1, se cruza con Focus Passport).
- **Achievements de foco**: `emptyHintLite` promete "Complete focus challenges
  to unlock achievements" pero aún no existen logros Lite — deben llegar en
  P1/P2.
- **Daily overlay en Full**: la animación Lite es focus-only (sin Peones).
  Llevarla a Full requeriría adaptar el overlay para Peones + contexto Arena
  (spec separado si se quiere).

---

## 5. Próximo paso

**Abrir spec P1 — Focus Passport** (SOLO spec, sin implementar). Preguntas a
responder en el spec:

- Qué cuenta como "focus day" (¿1 daily resuelto? ¿N exercises?).
- Cómo se ve el progreso de 7 días (UI: hero band, pills, calendario).
- Persistencia: local / off-chain / on-chain.
- Qué pasa si falla un día (¿reset de streak? ¿gracia?).
- Cómo se relaciona con Welcome Package (NO implementar ninguno todavía).

**Explícitamente NO en este alcance:** Focus Passport implementación, Welcome
Package, expansión de scope.

---

## Commits de la línea P0 (referencia)

| Commit | Descripción |
|---|---|
| `a06f4f44` | P0.5 — ACCOUNT pill gold-text PRO + kill flicker + Trophies hide locked Arena achievements |
| `1c8c264e` | ACCOUNT pill — move floating class to `<picture>` to stabilize icon layout |
