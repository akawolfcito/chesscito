# Spec — welcome-package-lite

**Date**: 2026-06-20
**Status**: ready-for-tdd (v2 — P0/P1 resolved)

---

## Resolved P0 findings (vs red-team v1)

| # | Finding | Resolution |
|---|---------|-----------|
| P0-1 | `WelcomePackageState` incompleto — faltaban `dismissed`, `dismissCount`, `autoShowCount` | Contrato expandido. Ver sección Contracts. |
| P0-2 | Mecanismo de encadenamiento al achievement no definido | Definido explícitamente: orquestador en Hub con `onFirstFocusDayUnlocked` callback. Ver User Flow. |
| P0-3 | Flow retroactivo ambiguo (usuario que ya tenía achievement al deployar) | Definido: inicialización `unlocked=true, claimed=false` sin overlay; pending en Trophies únicamente. |

## Resolved P1 findings (vs red-team v1)

| # | Finding | Resolution |
|---|---------|-----------|
| P1-1 | localStorage no garantiza permanencia | Lenguaje actualizado: "saved on this device". Riesgo documentado. |
| P1-2 | Doble-popup agresivo | Overlay sequencing definido: achievement tiene "Continue" que dispara el Package. |
| P1-3 | Full mode guard vago | Guard explícito en `useWelcomePackage()` con early return. |
| P1-4 | ES copy nice-to-have | ES copy es obligatorio en MVP. |
| P1-5 | Asset fallback no especificado | AC añadido: fallback textual si asset no carga. |
| P1-6 | "Trophies" sin ruta específica | Definido: superficie existente de Lite Achievements en `/(lite)/hub` o la ruta de trophies actual. |

---

## Problem

Chesscito Lite entrega valor real: Daily Focus construye hábito, el Passport lo visualiza, y los Achievements lo reconocen. El loop termina en "reconocimiento" sin una conclusión que ancle al usuario emocionalmente. El primer Focus Day es el momento de mayor motivación — si no hay un reward tangible, el usuario no tiene una razón sólida para volver mañana. El Welcome Package cierra ese gap.

Loop sin Package: Daily Focus → Passport → Achievement (nombre)
Loop con Package: Daily Focus → Passport → Achievement → Reward (tangible, guardado en el dispositivo)

## Goal

Entregar un reward cosmético de una sola vez, desbloqueado al confirmar el achievement "First Focus Day", que el usuario percibe como reconocimiento personal y no como transacción ni tienda.

## Non-goals

- No es una pantalla de Shop ni introduce economía de Peones.
- No es una transacción on-chain (ni siquiera suave) en MVP.
- No depende de backend, DB, wallet conectada ni auth.
- No aparece antes del primer Focus Day — no es onboarding ni tutorial.
- No es un popup de bienvenida al abrir la app.
- No es recurrente ni diario.
- No afecta el modo Full.
- No introduce PRO gating.
- No bloquea el Daily Focus si no se interactúa con él.
- No promete NFT, on-chain proof, mint ni token.
- No promete permanencia cross-device (localStorage es per-device).

---

## Diagnóstico de producto: selección de trigger

| Opción | Trigger | Pros | Contras | Veredicto |
|--------|---------|------|---------|-----------|
| A | Completar el primer Daily Focus | Inmediato, máxima energía | Interrumpe el flow antes de procesar el logro | No |
| **B** | **Desbloquear First Focus Day achievement** | **Reward llega con contexto, usuario ya procesó el logro** | Ninguno relevante | **Seleccionado** |
| C | Alcanzar 3-Day Rhythm | Compromiso demostrado | Delay innecesario, usuario pudo abandonar antes | No |
| D | Alcanzar 7-Day Focus | Retención probada | Demasiado tarde como "bienvenida" | No |

**Decisión: Opción B.** El orden emocional correcto:
> "Lo lograste" (Achievement) → "Y por eso te ganaste esto" (Welcome Package)

---

## Contracts (SDD)

```ts
// apps/web/src/lib/welcome-package/types.ts

export interface WelcomePackageState {
  version: 1;
  unlocked: boolean;
  unlockedAt: string | null;    // ISO 8601
  claimed: boolean;
  claimedAt: string | null;     // ISO 8601
  dismissed: boolean;
  dismissedAt: string | null;   // ISO 8601 del último dismiss
  dismissCount: number;         // cuántas veces cerró sin claim
  autoShowCount: number;        // cuántas veces se mostró automáticamente
}

// Reward es constante en código, no se guarda en storage
export const WELCOME_PACKAGE_REWARD = {
  id: "focus-stamp-day1",
  kind: "cosmetic",
  label: "Focus Stamp: Day 1",
  assetBase: "/art/welcome-package/focus-stamp-day1",
} as const;

export type WelcomePackageTrigger = "first_focus_day_achievement";

export interface WelcomePackageEvent {
  event:
    | "package_unlocked"
    | "package_viewed"
    | "package_claimed"
    | "package_dismissed";
  triggeredBy: WelcomePackageTrigger;
  source: "auto" | "trophies";
  timestamp: string;
}
```

**Storage key**: `chesscito:welcome-package`
**Estado inicial (nunca visto)**:
```ts
const DEFAULT_STATE: WelcomePackageState = {
  version: 1,
  unlocked: false,
  unlockedAt: null,
  claimed: false,
  claimedAt: null,
  dismissed: false,
  dismissedAt: null,
  dismissCount: 0,
  autoShowCount: 0,
};
```

**Hook API**:
```ts
// apps/web/src/lib/welcome-package/use-welcome-package.ts

interface UseWelcomePackageReturn {
  isUnlocked: boolean;
  isClaimed: boolean;
  isPending: boolean;        // unlocked && !claimed
  shouldAutoShow: boolean;   // unlocked && !claimed && autoShowCount < 2
  unlock: () => void;        // llamado por el orquestador al detectar First Focus Day
  claim: () => void;
  dismiss: () => void;
}
```

**Regla de Lite guard (en el hook)**:
```ts
// early return si no es Lite — no ejecuta nada, no escribe storage
if (!isLiteMode) {
  return {
    isUnlocked: false, isClaimed: false, isPending: false,
    shouldAutoShow: false, unlock: noop, claim: noop, dismiss: noop,
  };
}
```

---

## User Flow — Happy path (primera sesión)

```
[Usuario completa Daily Focus]
        ↓
[Passport actualiza streak]
        ↓
[Sistema de achievements detecta First Focus Day]
        ↓
[Achievement "First Focus Day" mostrado en pantalla]
  → Achievement UI tiene botón "Continue" (no cierre X)
        ↓
[Usuario toca "Continue" en el achievement]
        ↓
[Orquestador llama unlock() + muestra Welcome Package overlay]
  → autoShowCount++ (queda en 1)
  → Overlay: Focus Stamp visual + copy cálido + "Keep it" + "Later"
        ↓
[Usuario toca "Keep it"]
        ↓
[claim() → claimed=true, claimedAt=now]
[Overlay se cierra]
        ↓
[Regresa al Hub]
[Focus Stamp visible en Lite Achievements surface]
```

## User Flow — Dismiss path

```
[Welcome Package overlay visible (autoShowCount=1)]
        ↓
[Usuario toca "Later" o X]
        ↓
[dismiss() → dismissed=true, dismissedAt=now, dismissCount++]
[Overlay se cierra]
        ↓
[En Lite Achievements: Welcome Package como item "Pending" con indicador]
        ↓

--- Próxima apertura del Hub (autoShowCount < 2) ---
        ↓
[Orquestador detecta: unlocked && !claimed && autoShowCount < 2]
[Overlay aparece automáticamente una segunda vez]
  → autoShowCount++ (queda en 2)
        ↓
[Usuario puede:
  (a) "Keep it" → claimed=true, fin
  (b) "Later" → dismissCount++, overlay no vuelve a aparecer automáticamente]
        ↓
--- Si b: autoShowCount=2, no más auto-show ---
[Package queda como Pending en Lite Achievements indefinidamente]
[Usuario puede claimarlo desde ahí cuando quiera]
```

## User Flow — Retroactive path (usuario ya tenía achievement al deployar)

```
[Al montar useWelcomePackage()]
  → Lee localStorage["chesscito:welcome-package"] → no existe (null)
  → Lee estado de achievements → firstFocusDay = true
        ↓
[Inicializar estado retroactivo]:
  unlocked=true, unlockedAt="retroactive", claimed=false,
  dismissed=false, dismissCount=0, autoShowCount=2  ← pre-satura auto-show
        ↓
[NO se muestra overlay automático]
[En Lite Achievements: Welcome Package como item "Pending"]
[Usuario puede claimarlo desde ahí]
```

**Razón de `autoShowCount=2` retroactivo**: evitar que un usuario que ya había completado su primer Focus Day semanas antes reciba un overlay sorpresa al actualizar la app. El Package está disponible, pero sin intrusión.

---

## Mecanismo de trigger — Orquestador

El Welcome Package NO se dispara desde dos hooks desconectados. Existe un orquestador explícito en el componente que ya coordina Daily Focus, Passport y Achievements.

**Patrón**:
```ts
// En el componente o hook que ya maneja la secuencia post-Focus

function handleFirstFocusDayUnlocked() {
  // 1. Mostrar achievement UI
  showAchievementOverlay("first_focus_day", {
    onContinue: () => {
      // 2. Al cerrar achievement → trigger Welcome Package
      welcomePackage.unlock();
      if (welcomePackage.shouldAutoShow) {
        setShowWelcomePackage(true);
      }
    },
  });
}
```

Si el sistema de achievements actual no tiene callback `onContinue`, se añade esa prop al componente de achievement. El spec no asume que existe — la implementación puede requerirlo como nuevo prop mínimo.

**Archivo candidato para el orquestador**: el componente o hook que hoy maneja la secuencia post-Daily Focus en `/(lite)/hub`. Identificar en TDD.

---

## Overlay sequencing

Para evitar dos popups simultáneos o en rápida sucesión:

1. Achievement UI se muestra primero.
2. Achievement UI tiene **"Continue"** (no X de cierre) como única salida.
3. El tap en "Continue" cierra el achievement Y dispara el Welcome Package en la misma interacción.
4. No hay delay artificial — el flujo de "Continue → Package" es intencional, no sorpresivo.

Si la implementación usa X para cerrar achievements (no "Continue"), la alternativa aceptable es un delay de 600ms entre el cierre del achievement y la apertura del Package. No mostrar ambos simultáneamente bajo ninguna circunstancia.

---

## Estados UI

### Estado 0: Not unlocked
- No existe en la UI.
- `useWelcomePackage()` retorna `isUnlocked=false`.

### Estado 1: Unlocked + auto-show (overlay visible)
- Overlay sobre el Hub.
- Muestra: Focus Stamp (o fallback textual si asset no carga), copy cálido, "Keep it", "Later".
- `autoShowCount` se incrementa al mostrar.

### Estado 2: Unlocked + pending (no claimed, auto-show agotado o dismissed)
- No hay overlay.
- En Lite Achievements surface: item "Welcome Package" con indicador visual "Pending" (punto/glow).
- Tap en ese item abre un mini-modal de claim desde Trophies.

### Estado 3: Claimed
- Overlay no vuelve a aparecer.
- En Lite Achievements surface: Focus Stamp como item permanente, sin indicador pendiente.
- Label: "Focus Stamp: Day 1".

### Transiciones
```
[State 0: Not unlocked]
    → (First Focus Day achievement confirmed by user → onContinue)
    → [State 1: Unlocked + overlay visible, autoShowCount=1]
        → (claim tap)   → [State 3: Claimed]
        → (dismiss tap) → [State 2: Pending]
            → (Hub re-open, autoShowCount < 2) → [State 1: overlay visible, autoShowCount=2]
                → (claim tap)   → [State 3: Claimed]
                → (dismiss tap) → [State 2: Pending — sin más auto-shows]
            → (claim from Trophies) → [State 3: Claimed]

[State 0 retroactive init]
    → (existing achievement detected, no storage)
    → [State 2: Pending — autoShowCount=2, sin overlay]
        → (claim from Trophies) → [State 3: Claimed]
```

---

## Reward MVP

**Focus Stamp: Day 1** — constante en código, no en storage.

```ts
const WELCOME_PACKAGE_REWARD = {
  id: "focus-stamp-day1",
  kind: "cosmetic",
  label: "Focus Stamp: Day 1",
  assetBase: "/art/welcome-package/focus-stamp-day1",
} as const;
```

- **Visual**: sello circular/cuadrado redondeado, warm amber/teal, coherente con paleta Lite
- **Tamaño**: 64×64px display
- **Asset triplete**: `.png` + `.webp` + `.avif` (regla image-three-formats)
- **Fallback**: si ningún formato carga, mostrar texto "Focus Stamp: Day 1" en lugar del asset
- **Path**: `apps/web/public/art/welcome-package/focus-stamp-day1.{png,webp,avif}`

**Rewards fuera de MVP:**
- Avatar frames, backgrounds, themes
- Sticker animado / Lottie
- Badges con rareza o tier
- Peones, tokens

---

## Persistencia

**Key**: `chesscito:welcome-package`
**Storage**: `localStorage` — sin backend, sin DB, sin on-chain
**Lenguaje correcto**: "saved on this device" — no "permanente", no "cross-device"
**Riesgo aceptado**: si el usuario limpia storage o cambia de dispositivo, el Package aparece como no-claimed. En ese caso, el retroactive path detecta el achievement existente y lo muestra como pending sin overlay. El usuario puede re-claimarlo. No hay valor económico perdido — es cosmético.
**P2**: si existe backend de perfil, sincronizar `claimed` y `claimedAt` para cross-device.

**Lectura con migration guard**:
```ts
function getWelcomePackageState(): WelcomePackageState {
  const raw = localStorage.getItem("chesscito:welcome-package");
  if (!raw) return { ...DEFAULT_STATE };
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1) return { ...DEFAULT_STATE }; // future migration point
  return parsed as WelcomePackageState;
}
```

---

## Relación con Lite Achievements

- El trigger es el achievement "First Focus Day" — el Package es un bonus encadenado, no el achievement en sí.
- El Welcome Package NO reemplaza al achievement — ambos coexisten.
- La surface donde se muestra el Package pending/claimed es la misma donde ya viven los Lite Achievements (ruta actual de Trophies/Progress en Lite, sin crear nueva sección).
- Welcome Package = one-time unlock, sin importar cuántos Focus Days completen.

---

## Relación con Focus Passport

- El Passport muestra la racha; el Package recompensa el primer día de ella.
- No compiten visualmente: el Package es un overlay temporal, no vive en el Passport mismo.
- P2 (fuera de MVP): micromark sutil en el slot Day 1 del Passport si `claimed=true`.

---

## Relación con tx suave (futuro, no MVP)

El `claimedAt` timestamp en `WelcomePackageState` puede servir como punto de anclaje para una futura tx suave ("First Focus Day verificado on-chain"). No implementar en MVP. Solo tendría sentido post-listing con usuarios reales activos que quieran "Focus Proof" como diferenciador. La firma sería opcional, no requerida para el reward cosmético.

---

## Copy EN/ES (ambos obligatorios en MVP)

### Overlay

| Elemento | EN | ES |
|----------|----|----|
| Título | "You did it." | "Lo lograste." |
| Subtítulo | "Your first Focus Day is complete." | "Completaste tu primer Focus Day." |
| Body | "Here's something to mark the moment." | "Esto es tuyo para recordar el momento." |
| CTA | "Keep it" | "Es tuyo" |
| Dismiss | "Later" | "Después" |
| Stamp label | "Focus Stamp: Day 1" | "Focus Stamp: Day 1" |
| Fallback (sin asset) | "Focus Stamp: Day 1" | "Focus Stamp: Day 1" |

### Trophies — pending

| Elemento | EN | ES |
|----------|----|----|
| Label | "Welcome Package" | "Welcome Package" |
| Hint | "Tap to claim your reward" | "Toca para reclamar tu reward" |

### Trophies — claimed

| Elemento | EN | ES |
|----------|----|----|
| Label | "Focus Stamp: Day 1" | "Focus Stamp: Day 1" |
| Description | "Saved on this device. Earned on your first Focus Day." | "Guardado en este dispositivo. Ganado en tu primer Focus Day." |

**Reglas hard**: sin "mint", "NFT", "on-chain", "proof", "verified", "blockchain", em-dashes, claims médicos.

---

## Métricas futuras

| Evento | Cuándo | Properties |
|--------|--------|-----------|
| `package_unlocked` | Al llamar `unlock()` | `triggeredBy`, `timestamp`, `retroactive: boolean` |
| `package_viewed` | Al mostrar overlay | `source: "auto" \| "trophies"`, `autoShowCount` |
| `package_claimed` | Al tap "Keep it" | `source`, `dismissCount` previo |
| `package_dismissed` | Al tap "Later"/X | `source`, `dismissCount` nuevo, `autoShowCount` |

---

## Riesgos restantes

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Storage limpiado → re-trigger confuso | Media | Baja | Retroactive path detecta achievement, no re-overlay |
| Achievement sin callback onContinue | Media | Alta | Spec define que se añade como prop mínimo; alternativa: delay 600ms |
| Scope creep en overlay design | Alta | Media | MVP = asset estático + 2 botones; sin animaciones |
| Promesa cross-device implícita en copy | Baja | Media | Copy dice "saved on this device" explícitamente |
| Overlay en Full mode por bug | Baja | Alta | Guard en hook retorna early antes de cualquier cómputo |

---

## Acceptance criteria (actualizados)

**Trigger y unlock**
- [ ] `unlock()` solo se llama desde el orquestador post-achievement "First Focus Day"
- [ ] `unlock()` es no-op si `unlocked` ya es `true`
- [ ] En Lite mode: al detectar achievement existente sin storage → retroactive init con `autoShowCount=2`
- [ ] En Full mode (`CHESSCITO_LITE_MODE=false`): `useWelcomePackage()` retorna noop sin tocar localStorage

**Overlay auto-show**
- [ ] Overlay aparece después del achievement "Continue" (no simultáneamente)
- [ ] `autoShowCount` se incrementa a 1 al primer auto-show
- [ ] Overlay no aparece si `autoShowCount >= 2`
- [ ] Overlay no aparece si `claimed=true`

**Claim**
- [ ] Tap "Keep it" guarda `claimed=true, claimedAt=<ISO>` en `chesscito:welcome-package`
- [ ] Post-claim: overlay no vuelve a aparecer en ninguna sesión

**Dismiss**
- [ ] Tap "Later" guarda `dismissed=true, dismissedAt=<ISO>, dismissCount++`
- [ ] Primer dismiss: en próxima apertura de Hub, overlay vuelve a aparecer (autoShowCount < 2)
- [ ] Segundo dismiss: overlay no vuelve a aparecer automáticamente (autoShowCount=2)
- [ ] Post-dismiss: Package visible como "Pending" en Lite Achievements surface

**Trophies / Lite Achievements surface**
- [ ] Package pending aparece en la surface existente de Lite Achievements (sin nueva ruta)
- [ ] Tap en item pending abre flujo de claim
- [ ] Post-claim: item muestra "Focus Stamp: Day 1" sin indicador pending

**Asset fallback**
- [ ] Si ningún formato del Focus Stamp carga, el overlay muestra texto "Focus Stamp: Day 1"
- [ ] El overlay no se rompe ni queda en blanco si falta el asset

**Copy**
- [ ] Overlay muestra copy EN y ES según locale
- [ ] Copy no contiene: "mint", "NFT", "on-chain", "proof", "verified", "blockchain", em-dashes

---

## TDD checklist para implementación futura

### Fase 1 — Tipos y storage (sin UI)
- [ ] Escribir `lib/welcome-package/types.ts` con contrato completo
- [ ] Escribir `lib/welcome-package/storage.ts` (`getWelcomePackageState`, `setWelcomePackageState`, migration guard)
- [ ] Tests: DEFAULT_STATE, migration guard v1, retroactive init, round-trip JSON

### Fase 2 — Hook
- [ ] Escribir `lib/welcome-package/use-welcome-package.ts`
- [ ] Tests: guard Lite/Full, unlock idempotente, claim, dismiss, autoShowCount, shouldAutoShow, retroactive detection

### Fase 3 — Overlay component
- [ ] Escribir `components/welcome-package/welcome-package-modal.tsx`
- [ ] Tests: render con asset, render fallback textual, botón claim, botón dismiss

### Fase 4 — Integración orquestador
- [ ] Identificar componente/hook que maneja secuencia post-Daily Focus en Hub Lite
- [ ] Añadir `onContinue` callback al achievement "First Focus Day" si no existe
- [ ] Conectar `onContinue` → `unlock()` → `shouldAutoShow` → mostrar overlay
- [ ] Tests: secuencia completa happy path, no-op si Full mode

### Fase 5 — Trophies surface
- [ ] Añadir Welcome Package item en Lite Achievements surface (pending/claimed states)
- [ ] Tests: render pending, render claimed, tap pending abre claim

### Fase 6 — Asset
- [ ] Producir `focus-stamp-day1.png` + `.webp` + `.avif` (diseño externo)
- [ ] Verificar triplete en `apps/web/public/art/welcome-package/`

---

## Archivos a tocar en implementación

```
apps/web/src/lib/welcome-package/
  types.ts
  storage.ts
  use-welcome-package.ts

apps/web/src/components/welcome-package/
  welcome-package-modal.tsx
  welcome-package-stamp.tsx        # Focus Stamp en Trophies

apps/web/src/app/(lite)/hub/
  page.tsx (o componente de orquestación post-Focus)

apps/web/src/app/(lite)/<ruta-achievements>/
  page.tsx o componente de Lite Achievements

apps/web/public/art/welcome-package/
  focus-stamp-day1.png
  focus-stamp-day1.webp
  focus-stamp-day1.avif

apps/web/src/lib/content/editorial.ts   # strings EN/ES
```

---

## Out of scope / future

- **P2**: Micromark en slot Day 1 del Focus Passport
- **P2**: Indicador dot en Hub HUD cuando Package es pending
- **P2**: Sincronizar `claimed` con backend de perfil (cross-device)
- **P2**: Animación reveal del stamp (CSS keyframe, sin Lottie)
- **P3**: CTA "Save on-chain" para Focus Proof (tx suave opcional)
- **Post-listing**: Welcome Package como punto de entrada a identity on-chain

---

## Open questions (residuales, no bloqueantes para TDD)

1. **¿Qué ruta exacta es la surface de Lite Achievements?** Confirmar en codebase al iniciar TDD. El spec asume ruta existente — no crear nueva.
2. **¿El achievement "First Focus Day" ya tiene botón "Continue" o solo X?** Si solo X, usar delay 600ms como alternativa (AC ya cubre ambas).
3. **¿El asset Focus Stamp lo produce diseño antes del TDD o se usa placeholder?** TDD puede arrancar con fallback textual y swap de asset después.
