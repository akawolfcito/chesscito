# Spec — Content Loop v1

**Date**: 2026-06-21
**Status**: ready for tdd

---

## 1. Problema

Chesscito Lite tiene un loop base funcional:

```
Daily Focus → Focus Passport → Achievements → Claim Gift → Exercises + Labyrinths → Progress/Stats
```

El loop funciona, pero el producto no responde a la pregunta del usuario después de cada acción:
**"¿Qué hago ahora?"**

- ¿Terminé el Daily Focus — qué sigue?
- ¿Ya reclamé el regalo — ahora qué?
- ¿Completé el ejercicio — hay algo más hoy?
- ¿Tengo 1★ en varios ejercicios — debería mejorarlos?
- ¿Qué hago cuando ya hice todo?

Sin respuesta clara, el usuario sale. Con una respuesta clara y ligera, el usuario continúa o vuelve mañana con intención.

---

## 2. Objetivo

Implementar un sistema puro de derivación (`deriveContentLoopAction`) que calcule el **Next Best Action** del usuario a partir de datos existentes en localStorage, y surfacear ese resultado como una `NextStepCard` ligera en el Hub Lite.

---

## 3. No objetivos

- No crear backend, DB, contratos ni nuevas env vars
- No agregar `completedDates[]` ni nuevas claves de localStorage
- No crear pantallas nuevas
- No crear sistemas de quests, misiones, calendarios ni push
- No implementar Challenge Link, Sponsor, PvP, social, AI, leaderboards nuevos
- No cambiar el core de Save Flow, Exercise Path Sequencing ni el grant pack
- No tocar pagos ni monetización
- No prometer beneficios cognitivos o de salud

---

## 4. Principios de producto

1. **Claridad sobre abundancia**: una sugerencia a la vez, no un dashboard de opciones.
2. **Progresión perceptible**: el usuario siempre debe sentir que hay un próximo paso alcanzable.
3. **Hábito first**: Daily Focus es siempre la acción más urgente si no se hizo hoy.
4. **Sin pantalla muerta**: incluso cuando todo está completo, hay un mensaje que cierra el día con dignidad.
5. **Pure y testable**: `deriveContentLoopAction` acepta datos como argumentos, nunca toca localStorage directamente.

---

## 5. Contratos (SDD)

```ts
// lib/hub/content-loop.ts

import type { DailyProgress } from "@/lib/daily/progress";
import type { TrainingNode } from "@/lib/training/path";

/**
 * Pieza primaria en Lite v1. Exportada como contrato explícito — el Hub
 * nunca debe hardcodear "rook" inline; siempre importar esta constante.
 */
export const LITE_PRIMARY_PIECE = "rook" as const;
export type LitePrimaryPiece = typeof LITE_PRIMARY_PIECE;

/**
 * 8 variants en orden de prioridad decreciente.
 * La función devuelve EXACTAMENTE UNO — el más urgente disponible.
 */
export type ContentLoopVariant =
  | "daily-pending"        // Daily Focus no completado hoy → prioridad máxima
  | "claim-pending"        // Welcome Package desbloqueado pero sin reclamar
  | "continue-path"        // Ejercicios sin completar en la pieza actual
  | "labyrinth-ready"      // Laberinto desbloqueado y pendiente
  | "improve-stars"        // Todos los ejercicios jugados pero alguno < 3★
  | "next-piece"           // Pieza actual completa, hay otra pieza disponible
  | "come-back-tomorrow"   // Daily done + sin contenido urgente restante
  | "view-progress";       // Fallback — navega a /trophies, nunca pantalla muerta

export type ContentLoopAction = {
  variant: ContentLoopVariant;
  /** Ruta de destino al pulsar CTA. Null = no navegar (solo come-back-tomorrow). */
  destination: string | null;
  ctaEN: string;
  ctaES: string;
  subEN: string;
  subES: string;
};

export type ContentLoopInput = {
  /** DailyProgress desde localStorage (chesscito:daily-progress). */
  daily: DailyProgress;
  /** Fecha UTC "YYYY-MM-DD" — inyectada por el caller para testabilidad. */
  today: string;
  /**
   * Estado del Welcome Package. El caller debe leer useWelcomePackage() o
   * el hook equivalente disponible en el layout de Hub Lite (verificar antes
   * de implementar que el provider está montado en hub-scaffold.tsx).
   * No crear nueva fuente de datos ni nueva clave de localStorage.
   */
  welcomePackage: {
    unlocked: boolean;
    claimed: boolean;
  };
  /**
   * Pieza principal a evaluar. En Lite v1 usar siempre LITE_PRIMARY_PIECE.
   * El caller puede pasar otra pieza si Lite expande su catálogo.
   */
  primaryPiece: LitePrimaryPiece | string;
  /**
   * TrainingNode[] de la pieza principal, derivado de buildTrainingPath().
   *
   * El caller DEBE construirlo así:
   *   1. Leer PieceProgress desde localStorage: `chesscito:progress:{piece}`
   *   2. Leer labyrinthBests desde localStorage: `chesscito:labyrinth-best:{piece}`
   *      Formato: Record<labyrinthId, number | null> (null = no completado)
   *   3. Llamar buildTrainingPath({ piece, progress, labyrinthBests, badgeClaimed })
   *
   * Sin labyrinthBests correcto, `labyrinth-ready` nunca disparará aunque el
   * laberinto esté desbloqueado (todos los nodos labyrinth quedarán "locked").
   */
  primaryPath: TrainingNode[];
  /**
   * Siguiente pieza disponible si la pieza actual está completa.
   * Null si no hay más piezas o Lite no las expone todavía.
   */
  nextAvailablePiece: string | null;
};

export function deriveContentLoopAction(input: ContentLoopInput): ContentLoopAction;
```

### Tipos auxiliares derivados (no nuevos datos, solo lectura de TrainingNode[])

```ts
// Estas funciones son helpers puramente derivados de TrainingNode[]:

/** ¿Tiene la pieza ejercicios sin jugar (stars=0)? */
function hasAvailableExercise(path: TrainingNode[]): boolean;

/** ¿Tiene ejercicios jugados (stars>0) pero alguno < 3★? */
function hasImprovableExercise(path: TrainingNode[]): boolean;

/** ¿Está el primer laberinto desbloqueado y sin completar? */
function hasReadyLabyrinth(path: TrainingNode[]): boolean;

/** ¿Todos los ejercicios y laberintos de la pieza están completos? */
function isPieceFullyComplete(path: TrainingNode[]): boolean;
```

---

## 6. Comportamiento (prioridad de derivación)

Evaluación secuencial — se devuelve el primer variant que aplica:

```
1. daily-pending      → !isCompletedToday(today, daily)
2. claim-pending      → welcomePackage.unlocked && !welcomePackage.claimed
3. continue-path      → hasAvailableExercise(primaryPath)
4. labyrinth-ready    → hasReadyLabyrinth(primaryPath)
5. improve-stars      → hasImprovableExercise(primaryPath)
6. next-piece         → isPieceFullyComplete(primaryPath) && nextAvailablePiece !== null
7. come-back-tomorrow → daily.lastCompletedDate === today (todo primario done)
8. view-progress      → fallback final (no debería alcanzarse en flujo normal)
```

### Definiciones exactas

**`hasAvailableExercise`**: `path` tiene al menos un nodo `kind === "exercise"` con `status === "available"` (stars = 0, nunca jugado).

**`hasImprovableExercise`**: todos los nodos `kind === "exercise"` tienen `status === "complete"` (stars > 0) Y al menos uno tiene `stars < 3`.

**`hasReadyLabyrinth`**: al menos un nodo `kind === "labyrinth"` con `status === "available"` (desbloqueado, nunca completado). Equivalente a `getNextChallenge(path) !== null`.

**`isPieceFullyComplete`**: todos los nodos `kind === "exercise"` tienen `status === "complete"` Y todos los nodos `kind === "labyrinth"` tienen `status === "complete"` o `status === "locked"` (no hay laberinto pendiente).

---

## 7. Superficie UI

### Ubicación: `NextStepCard` en Hub Lite

**Posición**: debajo del Focus Passport en `hub-scaffold-center-stack`.

**Implementación**: componente nuevo mínimo `NextStepCard` dentro de `components/hub/`. No crea nueva ruta. No toca el dock.

**Estructura visual (mobile 390px)**:
```
┌─────────────────────────────────────┐
│  [icono variant]  Subtítulo         │
│  CTA label →                        │
└─────────────────────────────────────┘
```

Una sola línea de contexto (`subEN`/`subES`) + CTA como texto con flecha. No un botón grande. No una card prominente que compita con Daily Focus.

**Condición de render**:

- La card NO renderiza cuando `isHydrated === false` (retorna `null`). El caller en `hub-scaffold-client.tsx` expone `isContentLoopHydrated: boolean` que es `true` solo cuando los 3 inputs están disponibles: DailyProgress leído, WelcomePackage leído y `primaryPath` construido con `labyrinthBests`. Esto evita flash de variant incorrecto en el primer render.
- Cuando `isHydrated === true`, la card renderiza para TODOS los variants, incluyendo `view-progress` (que muestra una micro-card ligera apuntando a `/trophies`). No existe pantalla muerta.

### Estados visuales por variant

| Variant | Icono sugerido | Tono |
|---|---|---|
| `daily-pending` | 🔥 llama | Urgente / azul |
| `claim-pending` | 🎁 regalo | Ámbar destacado |
| `continue-path` | → flecha | Neutro / blanco |
| `labyrinth-ready` | 🏰 laberinto | Verde / teal |
| `improve-stars` | ★ estrella | Ámbar suave |
| `next-piece` | ♟ pieza | Blanco |
| `come-back-tomorrow` | 🌙 luna | Gris suave |
| `view-progress` | 🏆 trofeo | Gris suave (micro-card, menos prominente) |

Nota: los iconos pueden reutilizar assets existentes en `/art/`. No crear assets nuevos en v1.

`view-progress` es el único variant que representa un cierre de sesión sin contenido pendiente. Su card debe ser visualmente más pequeña/apagada que el resto para no competir con Daily Focus ni Passport. Destination: `/trophies`.

---

## 8. Copy recomendado

| Variant | ctaEN | subEN | ctaES | subES |
|---|---|---|---|---|
| `daily-pending` | "Today's Focus" | "Complete your daily tactic" | "Enfoque de hoy" | "Completa tu táctica diaria" |
| `claim-pending` | "Claim your gift" | "A reward is waiting for you" | "Reclama tu regalo" | "Tienes una recompensa esperando" |
| `continue-path` | "Keep going" | "Your path is growing" | "Continúa" | "Tu camino sigue creciendo" |
| `labyrinth-ready` | "Try the labyrinth" | "Next challenge unlocked" | "Prueba el laberinto" | "Siguiente reto desbloqueado" |
| `improve-stars` | "Improve your stars" | "Can you do better?" | "Mejora tus estrellas" | "¿Puedes hacerlo mejor?" |
| `next-piece` | "Start another piece" | "New moves await" | "Empieza otra pieza" | "Nuevos movimientos te esperan" |
| `come-back-tomorrow` | "Come back tomorrow" | "Today's focus is done" | "Vuelve mañana" | "El enfoque de hoy está hecho" |
| `view-progress` | "View progress" | "See what you've achieved" | "Ver progreso" | "Mira lo que has logrado" |

**Reglas de copy**:
- No usar: verified, proof, NFT, mint, on-chain como promesa central, brain health, improves memory, improves focus (claim médico), addiction, casino, wagering, prize.
- Evitar em/en-dashes en copy de usuario (anti-AI prose rule).

---

## 9. Datos usados (solo localStorage existente)

| Dato | Fuente | Clave localStorage |
|---|---|---|
| `daily.streak` | `getDailyProgress()` | `chesscito:daily-progress` |
| `daily.lastCompletedDate` | `getDailyProgress()` | `chesscito:daily-progress` |
| `daily.totalCompleted` | `getDailyProgress()` | `chesscito:daily-progress` |
| `welcomePackage.unlocked` | `useWelcomePackage()` | `chesscito:welcome-package` |
| `welcomePackage.claimed` | `useWelcomePackage()` | `chesscito:welcome-package` |
| `primaryPath` | `buildTrainingPath()` | `chesscito:progress:{piece}` + `chesscito:labyrinth-best:{piece}` |

**No se agrega ninguna clave nueva de localStorage en v1.**

### Cómo construir `primaryPath` en el caller

```ts
// hub-scaffold-client.tsx (dentro del useEffect de hidratación)

// 1. Progress de ejercicios (ya existe en el Hub via loadProgress)
const progress = loadProgress(LITE_PRIMARY_PIECE, pool);

// 2. labyrinthBests — DEBE leerse explícitamente antes de buildTrainingPath
//    Clave: "chesscito:labyrinth-best:rook"
//    Formato: Record<labyrinthId, number | null>  (null = nunca completado)
//    Si esta lectura se omite, todos los laberintos quedan "locked" en el path
//    y labyrinth-ready nunca dispara.
const labyrinthBestsRaw = localStorage.getItem(`chesscito:labyrinth-best:${LITE_PRIMARY_PIECE}`);
const labyrinthBests: Record<string, number | null> = labyrinthBestsRaw
  ? JSON.parse(labyrinthBestsRaw)
  : {};

// 3. Construir path puro
const primaryPath = buildTrainingPath({
  piece: LITE_PRIMARY_PIECE,
  progress,
  labyrinthBests,
  badgeClaimed: false, // Lite = wallet no requerida para Content Loop
});

// 4. Marcar hidratación completa
setIsContentLoopHydrated(true);
```

`deriveContentLoopAction` es puro y nunca toca localStorage — toda lectura ocurre en el caller.

---

## 10. Edge cases

1. **Hydration en SSR**: `deriveContentLoopAction` recibe datos del caller; la card no renderiza hasta que el caller haya hidratado desde localStorage (protegerse con un `isHydrated` flag, patrón ya establecido en `use-exercise-progress.ts`).

2. **DailyProgress corrupto**: `getDailyProgress()` ya maneja fallback a defaults — el input siempre llega limpio.

3. **Welcome Package no inicializado** (primera visita sin haber completado nada): `unlocked: false` → variant nunca es `claim-pending`. OK.

4. **PieceProgress corrupto** en localStorage: `loadProgress()` ya limpia a `emptyProgress` — `hasAvailableExercise` retorna true correctamente.

5. **`primaryPath` vacío** (catálogo no cargado aún): `hasAvailableExercise([])` = false, `hasReadyLabyrinth([])` = false → cae a `come-back-tomorrow` o `view-progress`. Aceptable como estado transitorio.

6. **Pieza con laberinto locked pero ejercicios pending**: `labyrinth-ready` no aplica, `continue-path` aplica correctamente.

7. **Pieza sin laberintos** (si Lite expone pieza sin laberintos): `hasReadyLabyrinth` = false, flujo sigue a `improve-stars` o `next-piece`. OK.

8. **`nextAvailablePiece: null`** y pieza completa: cae a `come-back-tomorrow`, no a `next-piece`. Correcto — no prometer contenido que no existe.

9. **`come-back-tomorrow`** cuando daily NO está done pero todo ejercicio está completo: `daily-pending` gana por prioridad. Correcto.

10. **Usuario nuevo sin nada**: `totalCompleted: 0`, `unlocked: false`, `hasAvailableExercise` = true → variant = `continue-path` (la pieza rook siempre tiene ejercicios disponibles desde el inicio). Correcto — invita a empezar.

---

## 11. Criterios de aceptación

- [ ] `LITE_PRIMARY_PIECE = "rook" as const` exportada desde `lib/hub/content-loop.ts`
- [ ] `deriveContentLoopAction` es una función pura exportada desde `lib/hub/content-loop.ts`
- [ ] Acepta `ContentLoopInput` y devuelve exactamente un `ContentLoopAction`
- [ ] Los 8 variants tienen cobertura de test unitario (incluyendo boundary conditions)
- [ ] La prioridad es determinista: mismos inputs → mismo output siempre
- [ ] `NextStepCard` NO renderiza cuando `isHydrated === false` (retorna `null`)
- [ ] `NextStepCard` renderiza en Hub Lite debajo del Focus Passport cuando `isHydrated === true`
- [ ] `NextStepCard` no renderiza en Hub Full (gated por `CHESSCITO_LITE_MODE`)
- [ ] `view-progress` renderiza una micro-card con destination `/trophies` (nunca null)
- [ ] `come-back-tomorrow` destination es `null` (único variant sin navegación)
- [ ] Caller lee `chesscito:labyrinth-best:{piece}` antes de llamar `buildTrainingPath()`
- [ ] Caller usa `LITE_PRIMARY_PIECE` en lugar de `"rook"` hardcodeado
- [ ] Caller verifica que `useWelcomePackage()` está disponible en layout Hub Lite antes de implementar
- [ ] No se agrega ningún nuevo key a localStorage
- [ ] tsc `--noEmit` 0 errores con los nuevos tipos
- [ ] `hero-cta.ts` existente no se modifica (Content Loop es aditivo, no reemplaza)

---

## 12. Tests requeridos

### Unit — `lib/hub/__tests__/content-loop.test.ts`

```
describe("deriveContentLoopAction")
  ✓ new user with no daily and no exercises → continue-path (rook always has exercises)
  ✓ daily not done today → daily-pending (highest priority)
  ✓ daily done, welcome package unlocked but not claimed → claim-pending
  ✓ daily done, no pending reward, exercises available → continue-path
  ✓ daily done, no pending reward, labyrinth unlocked → labyrinth-ready
  ✓ daily done, all exercises played, some < 3★ → improve-stars
  ✓ daily done, piece fully complete, next piece available → next-piece
  ✓ daily done, piece fully complete, no next piece → come-back-tomorrow
  ✓ empty path, daily done, no reward, no next piece → view-progress
  ✓ priority: daily-pending beats claim-pending when both true
  ✓ priority: claim-pending beats continue-path
  ✓ priority: labyrinth-ready beats improve-stars
  ✓ corrupted stars (0 entries) → hasAvailableExercise = true
  ✓ view-progress action has destination "/trophies" (never null)
  ✓ come-back-tomorrow action has destination null

describe("hasAvailableExercise")
  ✓ returns true when any exercise node status === "available"
  ✓ returns false when all exercise nodes status === "complete"
  ✓ returns false for empty path

describe("hasImprovableExercise")
  ✓ returns true when all exercises complete but one has stars < 3
  ✓ returns false when all exercises have 3★
  ✓ returns false when any exercise is still "available"

describe("hasReadyLabyrinth")
  ✓ returns true when any labyrinth node status === "available"
  ✓ returns false when all labyrinths are locked or complete
  ✓ returns false when labyrinthBests was NOT passed to buildTrainingPath (all locked)
```

### Unit — `components/hub/__tests__/next-step-card.test.tsx`

```
describe("NextStepCard")
  ✓ renders null when isHydrated=false (no flash)
  ✓ renders null when isHydrated=false even if action is daily-pending
  ✓ renders CTA text for each of the 8 variants when isHydrated=true
  ✓ view-progress variant renders micro-card (smaller visual weight)
  ✓ view-progress CTA navigates to /trophies
  ✓ come-back-tomorrow renders without clickable CTA (destination null)
  ✓ does not render in Full mode (CHESSCITO_LITE_MODE=false)
```

### Smoke manual (post-deploy)

1. Hub Lite — usuario nuevo → card muestra "Keep going / Your path is growing"
2. Hub Lite — Daily Focus hecho, no claim → card muestra "Claim your gift"
3. Hub Lite — Daily Focus pendiente → card muestra "Today's Focus"
4. Hub Lite — todos los ejercicios completados con 1★ → card muestra "Improve your stars"
5. Hub Lite — Daily hecho, todo completo, sin siguiente pieza → card muestra "Come back tomorrow"
6. Hub Lite — Daily hecho, path vacío → card muestra micro-card "View progress" → navega a /trophies
7. Hub Full — card NO aparece
8. Recargar Hub Lite en mobile — NO se ve flash de variant incorrecto antes de hidratar

---

## 13. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Hydration mismatch (SSR vs client) | Media | Medio | Usar `isHydrated` flag antes de renderizar card |
| `buildTrainingPath` no montado en Hub → primaryPath vacío | Baja | Bajo | Fallback a `view-progress` o no renderizar |
| `come-back-tomorrow` persiste entre días si localStorage no se limpia | Baja | Bajo | `isCompletedToday` ya checa fecha UTC — el día siguiente daily-pending gana |
| NextStepCard compite visualmente con Focus Passport | Media | Medio | Diseño lightweight: texto + flecha, no card grande |
| next-piece variant apunta a pieza que Lite no expone | Baja | Medio | `nextAvailablePiece` lo provee el caller — si Lite no expone pieza, caller pasa `null` |

---

## 14. Fuera de scope (v1)

- Múltiples piezas en Lite (v1 solo rook como pieza primaria)
- Historial de actions tomadas (no persistir qué card se mostró)
- Animaciones de transición entre variants
- A/B testing de copy
- Push notifications / email
- Cross-device sync del loop state
- Challenge Link / Sponsor / PvP
- Nuevos achievements derivados de Content Loop
- Badge/Mastery milestone card como variant separado (se cubre por `improve-stars` + `view-progress`)

---

## 15. Plan de implementación recomendado

**Commits atómicos, en orden:**

1. `feat(content-loop): add ContentLoopInput/Action types + deriveContentLoopAction pure fn`
   - Crea `lib/hub/content-loop.ts` con tipos + función + helpers
   - Tests en `lib/hub/__tests__/content-loop.test.ts`
   - tsc clean

2. `feat(content-loop): add NextStepCard component`
   - Crea `components/hub/next-step-card.tsx`
   - Recibe `ContentLoopAction` como prop
   - Renderiza variant UI con copy EN/ES
   - No lógica de derivación dentro del componente

3. `feat(content-loop): wire NextStepCard into hub-scaffold-client (Lite only)`
   - En `hub-scaffold-client.tsx`: leer DailyProgress, WelcomePackage, buildTrainingPath
   - Llamar `deriveContentLoopAction`, pasar resultado a `NextStepCard`
   - Gated por `CHESSCITO_LITE_MODE`

4. `test(content-loop): smoke + VR baseline update`
   - Ejecutar smoke manual (5 estados)
   - Si VR toca Hub Lite → actualizar baseline con rationale

---

## 16. Agente/modelo recomendado para implementación

- **Modelo**: `claude-sonnet-4-6` (suficiente — implementación es straightforward, función pura + componente simple)
- **Agente**: principal (no sub-agente), la task es secuencial y pequeña
- **Skill a usar**: `/tdd` después de aprobación del spec
- **Referencia obligatoria antes de implementar**:
  - `lib/training/path.ts` — `buildTrainingPath`, `getNextChallenge`, `TrainingNode`
  - `lib/daily/progress.ts` — `isCompletedToday`, `DailyProgress`
  - `lib/welcome-package/types.ts` — `WelcomePackageState`
  - `lib/hub/hero-cta.ts` — no modificar, solo entender el patrón existente

---

## 17. Self red-team

Ver `docs/specs/content-loop-v1-redteam.md`.
