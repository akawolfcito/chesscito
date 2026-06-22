# Chesscito Lite — Transactional Loop Audit
**Fecha:** 2026-06-19  
**Rama:** main (`5a300dd9`)  
**Scope:** Exercises flow · Save Score · Receipt · Share · Leaders · Trophies

---

## 1. Diagnóstico

### 1.1 Flujo principal

| Paso | Estado | Notas |
|------|--------|-------|
| Abrir Lite → /exercises | ✅ | Funciona; dock sin Shop/Arena |
| Entrar a Daily / Pieces | ✅ | DailyTacticSlot + ExerciseDrawer operativos |
| Resolver ejercicio / laberinto | ✅ | Resultado de acierto/fallo visible |
| Acción para guardar | ⚠️ | Pin compacto "SAVE" al lado del tablero; visible pero poco prominente |
| Costo explícito antes de tocar SAVE | ❌ | El usuario no ve "3 gratis · luego 1 Peón" hasta que agota la quota |
| Continuar sin guardar | ✅ | Progreso local (stars) persiste sin acción del usuario |

### 1.2 Transacción actual

- **Mecanismo:** `POST /api/scores/save` → Supabase `save_basic_score` (off-chain)
- **Quota:** 3 saves gratis por wallet, luego 1 Peón/save
- **Trigger:** tap en pin "SAVE" (`submitScore`) dentro de `ContextualActionSlot`
- **Entrega de valor primero:** ✅ el score ya está calculado; el save lo registra en el leaderboard
- **Confirmación de éxito:** ✅ `ResultOverlay variant="score"` — "Score Saved! · Saved and live on the leaderboard. Ready to share."
- **Error / cancelación:**
  - `insufficient_peones` → `GetPeonesSheet` (payment rail, correcto)
  - `rate_limited` → toast con segundos de espera
  - `invalid` / `error` → overlay con "Try again"
- **Sin guardar:** progreso local (`PieceProgress`) intacto; el score no entra al leaderboard

### 1.3 Receipt

- **Off-chain saves (quota gratis / Peones):** sin `txHash` → sin link CeloScan. El overlay muestra stats (stars, Peones gastados, saves gratis restantes) pero NO un recibo verificable externo.
- **On-chain badge claim:** sí genera txHash → CeloScan link en overlay.
- **Gap:** en Lite, la acción más frecuente (save score) no produce un receipt on-chain visible. No hay "Training Log" como surface.

### 1.4 Share

- ✅ `ResultOverlay variant="score"` tiene CTA primario "Share" → `ShareModal`
- ✅ Share card URL: `/share/score?piece=...&stars=...` con OG image
- ✅ Copy share: `"I saved my {piece} score on Chesscito! {stars}/15 stars"` — no jargon problemático
- ⚠️ Badge share copy: `"Saved on Celo forever."` — OK para badge (es on-chain); no aplica al score save

### 1.5 Leaders y Trophies después de guardar

| Surface | Post-save score | Notas |
|---------|-----------------|-------|
| Leaderboard | ✅ optimistic | Entrada optimista en `sessionStorage`; visible en LeaderboardSheet al abrir |
| Trophies | ❌ vacío siempre | Trophies = Victory NFTs de Arena. Sin Arena en Lite, Trophies siempre vacío |
| Training Log | ❌ no existe | No hay surface de historial de saves de ejercicios |

### 1.6 Sin guardar — sentimiento del usuario

- Progreso local (stars, ejercicios completados) se conserva.
- El usuario puede continuar entrenando normalmente.
- No hay mensaje explícito de "no estás en el leaderboard" si elige no guardar.
- **No se siente castigado**, simplemente no publicado — comportamiento correcto para MVP.

### 1.7 Rastros de narrativa Full en el flujo Lite

| Elemento | Presente en Lite | Problemático |
|----------|-----------------|--------------|
| GetPeonesSheet (insuficientes) | ✅ sí | No — el payment rail debe quedar |
| Badge claim + "Badge Earned!" | ✅ sí | Leve: copy `firstStepHint` dice "digital collectible" |
| Copy del badge share | `"Saved on Celo forever."` | No — es on-chain y preciso |
| Copy badge claim `CLAIM_BADGE_COPY.firstStepHint` | `"Master the Rook. Claim your first digital collectible."` | ⚠️ Leve: "digital collectible" puede sonar a NFT-jargon |
| Shop / PRO / Founder | ❌ eliminados | ✅ correcto |
| "Top up" / ChesitoCard | ❌ eliminado | ✅ correcto |

---

## 2. Plan

Si se decide avanzar antes de Grants/MiniPay, los ajustes mínimos son:

### P0 — Antes de MiniPay/Grants

1. **Pre-save cost disclosure** — mostrar quota status (`X free saves left · luego 1 Peón`) visible ANTES de tocar SAVE, no como error post-tap. Puede ser un micro-label bajo el pin o en el MissionPanel.
   - Archivo: `exercises-screen.tsx` + `contextual-action-slot.tsx` + editorial
   - Riesgo: bajo (solo copy/badge, no lógica)

2. **Trophies vacío en Lite necesita copy honesto** — hoy dice "Play and improve your pieces" (training copy). Correcto. Pero si el usuario guarda scores y luego abre Trophies esperando ver historial, hay confusión. Agregar una línea: "Your leaderboard scores live in Leaders →" o simplemente confirmar que el wording actual es suficiente.
   - Archivo: `trophies-body.tsx` / `editorial.ts`
   - Riesgo: mínimo

### P1 — Después de lanzar MVP

3. **Receipt off-chain visible** — un "Saved · Score #{id}" sin CeloScan (no es on-chain), similar al Trophies ribbon pero para el leaderboard.
4. **Badge copy "digital collectible"** limpiar a "training badge" en contexto Lite.
5. **MissionPanel copy "Save score"** — ya existe `saveScoreCta: "Save score"` pero el pin solo dice "SAVE"; agregar sub-label de quota on-the-fly.

### P2 — Futuro

6. **Training Log** como surface separada (historial de saves de ejercicios).
7. **Claim training badge → focus on achievement, not collectible** en Lite.
8. **Streak Shield, Deep Hint, Focus Pass** — no recomendados hasta calibrar economía.

---

## 3. Archivos afectados (si se implementa P0)

| Archivo | Cambio |
|---------|--------|
| `src/lib/content/editorial.ts` | Agregar `savesLeftLabel: "{count} free · then 1 Peón"` en `FOOTER_CTA_COPY` / `MISSION_PANEL_COPY` |
| `src/components/exercises/contextual-action-slot.tsx` | Renderizar badge de quota bajo pin "SAVE" cuando `action === "submitScore"` |
| `src/hooks/use-save-score-state.ts` | Exponer quota restante para UI (requiere `/api/scores/quota` o derivación local) |
| `src/components/trophies/trophies-body.tsx` | Añadir link sutil a Leaderboard en empty state Lite |
| `src/lib/content/editorial.ts` | Ajustar `firstStepHint` badge en Lite si se decide limpiar "digital collectible" |

---

## 4. Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Pre-save disclosure requiere endpoint `/api/scores/quota` o llamada extra | Media | Derivar localmente con `lastSavedAt` + counter en localStorage como proxy (no cross-device, aceptable para MVP) |
| Trophies vacío puede confundir al usuario que guardó scores | Baja | Copy actual es entrenamiento-first; aceptable sin cambio urgente |
| `GetPeonesSheet` en Lite puede crear "compra sorpresa" después del free quota | Media | Debe aparecer, pero el usuario debe saber QUE va a costar ANTES de llegar ahí |
| Badge share copy on-chain language ("Saved on Celo forever") mal-atribuida al score save off-chain | Baja | Solo se activa post-badge-claim, no post-score-save; flujos separados |
| Cross-device: local quota cache no se sincroniza | Baja-Media | Aceptable en MVP; la server quota es autoritativa; el UI puede desincronizarse una sola vez |

---

## 5. Clasificación de momentos de transacción

| Momento | Clasificación | Justificación |
|---------|--------------|---------------|
| Save score after exercise | **P0 ya existe** | Core del loop; funcional pero necesita cost disclosure |
| Claim training badge | **P0 ya existe** | Funcional; on-chain; leve jargon "collectible" |
| Save best daily run | **P1** | Daily tactic existe; save de daily no verificado |
| Streak Shield (use) | **P1** | Ya existe `useShield`; Shop bloqueado pero shields previos usables |
| Deep Hint | **P2** | Infrastructure existe (dormida) |
| Focus Pass | **P2** | No especificado |
| Streak Shield (compra) | **No recomendado** en Lite | Shop bloqueado por diseño |

---

## 6. Smoke recomendado para Lite

1. **lite-preview.chesscito.com** — abrir en viewport 390px
2. **Train:** entrar a Pieces → resolver ejercicio → verificar que aparece pin "SAVE"
3. **Save:** tap SAVE → `ResultOverlay "Score Saved!"` → verificar stats pills (stars, free saves left)
4. **Share:** tap Share → ShareModal → copiar link → verificar OG card `/share/score?...`
5. **Leaders:** abrir LeaderboardSheet → verificar entrada optimista del score guardado
6. **Trophies:** abrir → verificar copy training-oriented ("Your training progress.") + CTA "PRACTICE PIECES"
7. **Sin guardar:** resolver otro ejercicio → cerrar sin tocar SAVE → verificar que stars persisten localmente
8. **Quota exhausta (3 saves):** en cuenta con ≥3 saves → tap SAVE → verificar que abre `GetPeonesSheet` correctamente
9. **Cancelar transacción:** en `GetPeonesSheet` → cancelar → verificar `ResultOverlay error.cancelled`
10. **Account:** abrir Account sheet → verificar que NO aparecen PRO/Coach/Shields/Founder/ChesitoCard → SÍ Wallet/Network/Language

---

## Veredicto final

> **"Falta P0 mínimo antes de estar listo"**

El loop existe y funciona (`Train → Solve → SAVE → Score Saved! → Share → Leaders`). La transacción principal correcta es `submitScore` (Save Score). 

**El gap crítico:** el usuario no conoce el costo (3 free → 1 Peón) **antes** de tocar SAVE. Esto puede crear fricción o sorpresa al abrir GetPeonesSheet tras agotar la quota. Con una línea de disclosure pre-tap, el loop es suficiente para MVP/Grants.

**Trophies en Lite:** aceptable hoy (copy training-first, CTA PRACTICE PIECES), pero deja al usuario sin historial de sus saves de ejercicios. No es bloqueante para Grants; sí es deuda UX a corto plazo.

**No hay rastros problemáticos de Shop/PRO/Founder/NFT en el flujo principal.** El badge claim en Lite tiene leve jargon ("digital collectible") pero no es bloqueante.
