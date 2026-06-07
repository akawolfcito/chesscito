# Sprint 2 — Daily Tactic Evolution · Calibración

**Fecha:** 2026-06-06
**Autor:** John (Tech Lead, dirigido por Wolfcito)
**Estado:** Calibración pre-implementación. NO ejecuta código. Sirve como contrato para los commits de Sprint 2.
**Doc padre:** `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md` §3 Sprint 2.

---

## 1. Estado actual del Daily Tactic

### 1.1 Archivos

| Archivo | LOC | Responsabilidad |
|---|:--:|---|
| `apps/web/src/lib/daily/daily-puzzles.ts` | 211 | Pool de puzzles + selector `getDailyTactic(today)` |
| `apps/web/src/lib/daily/progress.ts` | 119 | Streak schema, pure helpers `computeNextProgress`, persistencia localStorage |
| `apps/web/src/lib/daily/puzzles.ts` | 120 | (legado o helper auxiliar — separado del pool actual) |
| `apps/web/src/components/daily/daily-tactic-card.tsx` | 77 | Tile presentacional (puzzleName, streak, completed badge) |
| `apps/web/src/components/daily/daily-tactic-sheet.tsx` | 234 | Sheet de play con board interactivo |
| `apps/web/src/components/daily/daily-tactic-slot.tsx` | 129 | Mount original (parece reemplazado por `hub-daily-tile.tsx`) |
| `apps/web/src/components/hub/hub-daily-tile.tsx` | ~80 | Mount canónico en `/hub` rail derecho |
| `apps/web/src/lib/daily/__tests__/progress.test.ts` | — | Tests de streak + computeNextProgress |

### 1.2 Pool actual (14 puzzles)

`DAILY_TACTIC_PUZZLES` constante con cobertura por pieza:

| Pieza | Puzzles | IDs |
|---|:--:|---|
| Rook | 3 | dt-rook-1, dt-rook-2, dt-rook-3 |
| Bishop | 1 | dt-bishop-1 |
| Knight | 3 | dt-knight-1..3 |
| Pawn | 4 | dt-pawn-1..4 |
| Queen | 3 | dt-queen-1..3 |
| **King** | **0** | **gap real** |

Cada puzzle es shape `{ id, name, piece, exercise: Exercise, hint }`. El `Exercise` es el mismo tipo que el de la senda (mismo motor de board, mismo `getValidTargets`).

### 1.3 Rotación por día UTC

`getDailyTactic(today)` selecciona puzzle vía `hashDate(today) % DAILY_TACTIC_PUZZLES.length`.

- `today` es `"YYYY-MM-DD"` en UTC (`todayUtc()` retorna `new Date().toISOString().slice(0,10)`).
- Hash: djb2 sobre el string de fecha → uint32 → modulo length del pool.
- Determinístico: todos los usuarios ven el mismo puzzle el mismo día UTC.
- **No hay puzzle "del lunes" semántico** — la rotación es por hash, no calendario.

### 1.4 Streak schema

localStorage key: `chesscito:daily-progress`. Shape:

```ts
{
  streak: number;            // entero ≥ 0
  lastCompletedDate: string | null;  // "YYYY-MM-DD" UTC
  totalCompleted: number;    // lifetime counter
}
```

Reglas de `computeNextProgress(prev, today)`:

- Si `prev.lastCompletedDate === today` → no-op (replay del mismo día).
- Si `prev.lastCompletedDate === yesterday(today)` → `streak + 1`.
- Si más viejo → `streak = 1` (reset).
- Siempre incrementa `totalCompleted`.

`isStreakLive()` → flame icon en HUD solo si última completion fue hoy o ayer.

### 1.5 Datos guardados

Únicamente lo de §1.4. **NO se guarda** qué puzzle se resolvió, cuántos movimientos, ni stars.

### 1.6 Superficies UI tocadas

| Surface | Componente | Comportamiento actual |
|---|---|---|
| `/hub` (right rail) | `HubDailyTile` | Tile presentacional + apertura del sheet |
| Sheet de play | `DailyTacticSheet` | Board + interacción + streak badge |
| Hub Hero CTA | (vía `getDailyHistoryCount`) | Branch "new player" si totalCompleted=0 |

---

## 2. Riesgos de Sprint 2

| # | Riesgo | Probabilidad | Mitigación |
|:--:|---|:--:|---|
| R1 | **Sistema paralelo accidental** — crear `daily-pool-v2.ts` o `training-daily-events.ts` separado del stack actual | Media | Hard rule: evolucionar `daily-puzzles.ts` + `progress.ts` in-place. Cero archivos nuevos en `lib/daily/*` salvo extensión natural (e.g., `__tests__/`). |
| R2 | **Romper streaks existentes** — usuarios con `chesscito:daily-progress` perdiendo `streak` o `totalCompleted` por schema migration | Baja | El schema actual no se modifica. Si agregamos campos (e.g., `lastPiecePlayed` para nueva UX), van opcionales + parseProgress los ignora por defecto. Test de regresión: `streak` y `totalCompleted` legacy se preservan verbatim. |
| R3 | **Meter Peones sin ledger** — Commit E acredita Peones reales en localStorage sin que Sprint 3 haya hecho el ledger Supabase → fork de moneda + reconciliation pesadilla | Alta si no se contiene | Reward stub explícitamente NO escribe ningún saldo. Solo UI/copy + evento telemetría con flag `simulated: true`. Ver §4. |
| R4 | **Guests vs connected confusión** — emitir `peones_earned` con `simulated: true` sin saber si el usuario está connected; si guest ve "+3 Peones" piensa que tiene saldo real | Media | Stub solo se muestra a usuarios connected. Guest ve copy alternativo "Connect wallet to earn Peones" CTA (sin números). Telemetría diferencia los dos via prop `audience`. |
| R5 | **Visual rompimiento en MiniPay/mobile** — agregar tag de dificultad y un toast de Peones cambia el card. Si el chip de difficulty desborda el tile del hub o el toast tapa el dock, regresión visual | Media | Commit B (`difficulty`) se ship sin renderizar nada visualmente en el primer pase — solo data. La visual del difficulty se hace en commit propio o al final, con smoke 390×844. Toast/preview de Peones se posiciona arriba del dock con z-index controlado. |
| R6 | **BFS verifier hard fail en commit A corta sprints futuros** — si Daily Tactic puzzles agregados en commit C tienen mismatch, todo el sprint queda blocked en verde | Media | Commit A se hace ANTES de C. Si el BFS detecta drift en los puzzles ya existentes (14), se resuelve antes de promover a hard fail. Commit A solo flips si la corrida vigente está 100% verde. |
| R7 | **Pool de 30 cambia el puzzle de hoy al deployar** — `hashDate % 30 ≠ hashDate % 14` para el mismo `today`. Usuario que ayer vio dt-pawn-3 hoy puede ver dt-king-2. UX no rompe streak pero genera "qué pasó con el puzzle de ayer" | Baja | No es bug, es comportamiento esperado. Documentar en release note. Smoke manual confirma que el nuevo puzzle del día es válido + jugable. Hash determinístico mantiene la propiedad clave: todos los usuarios ven lo mismo el mismo día. |
| R8 | **King daily authoring** — agregar King puzzles requiere pedagogía nueva (igual que Sprint 1 commit 5). Si no se piensa bien, sale repetitivo con la senda | Media | Daily debería ofrecer puzzles **complementarios** a la senda, NO duplicarlos. Cada King daily puzzle se diseña como mini-tactic (puzzle de 2-4 movs), no como traversal endurance. BFS verifier los valida. |

---

## 3. Plan Sprint 2 — Commits

### Commit A — `test(exercises): promote BFS verifier to hard fail`

**Scope estricto:**

- Cambiar `console.warn` + `mismatches.push` → `expect(bfs).toBe(ex.optimalMoves)` directo dentro del `it()`.
- Mantener el `afterAll` console.log de "All exercises pass" como feedback positivo.
- Verificar pre-flip que la corrida actual está 100% verde (no warnings) — si hay drift, resolver primero.
- Cero cambios de catálogo, cero cambios UI.

**Tests:** 34 (sin cambios numéricos) — el verifier sigue corriendo, solo asserta en lugar de log.

**Safe to ship?** Sí. La corrida actual del verifier reporta `All exercises pass optimalMoves verification ✅`. Flip es 1-line.

### Commit B — `feat(daily): add backward-compatible difficulty tag`

**Scope estricto:**

- Extender `DailyTacticData` con `difficulty?: "easy" | "medium" | "hard"` opcional.
- Asignar tag a los 14 puzzles existentes según pedagogía (la mayoría son 1-2 movs → "easy"; algunos 2-mov con detour → "medium"; reserved "hard" para puzzles futuros con captureTargets/obstacles).
- NO renderizar el chip visual todavía. Solo data.
- Helper `getPuzzleDifficulty(puzzle: DailyTacticData): "easy" | "medium" | "hard"` con default "easy" cuando undefined → garantiza UI futura sin null-checks.

**Tests:** asserts de catálogo — cada puzzle tiene difficulty o el default es "easy". Tests existentes pasan sin cambios (backward-compat).

**Safe to ship?** Sí. Pure data extension.

### Commit C — `feat(daily): expand pool from 14 to 30 with King + balance`

**Scope estricto:**

- Agregar 16 puzzles nuevos para llegar a 30. Distribución target:
  - Rook: 3 → 5 (+2)
  - Bishop: 1 → 4 (+3)
  - Knight: 3 → 5 (+2)
  - Pawn: 4 → 5 (+1)
  - Queen: 3 → 5 (+2)
  - **King: 0 → 6 (+6)** — gap real, prioridad
- Cada puzzle se asigna `difficulty` desde commit B.
- BFS verifier extendido a Daily Tactic pool: los 30 puzzles deben pasar.
- King puzzles diseñados como mini-tactics (2-4 movs con obstacles o captureTargets), NO como traversal endurance — complementan la senda, no la duplican.

**Tests:** verifier verde 30/30. Tests existentes de Daily Tactic siguen verdes (no cambia el shape, solo el length).

**Riesgos:** R7 (rotación del día cambia al deploy) y R8 (King authoring) aplican. Mitigaciones documentadas arriba.

**Safe to ship?** Sí, pero es el commit más grande del sprint (~16 puzzles autorados + BFS verification). Estimable en una sesión larga.

### Commit D — `feat(telemetry): daily tactic events`

**Scope estricto:**

3 eventos sobre `track()` (mismo stack que training events de Sprint 1):

1. `daily_tactic_started` — al abrir el sheet. Props: `puzzleId`, `puzzleDate`, `difficulty`, `pieceShown`, `currentStreak`, `isPro: boolean`.
2. `daily_tactic_completed` — al resolver. Props: lo anterior + `movesUsed`, `optimalMoves`, `starsEarned` (placeholder), `newStreak`, `peonesEarned` (placeholder; 0 si stub no activo).
3. `daily_streak_updated` — cuando `streak` cambia (subió, reset, primer día). Props: `newStreak`, `streakType: "first" | "extended" | "reset"`, `bonusPeonesEarned` (placeholder).

Dedup: emitter respeta el throttle existente de `track()`. Started fires una vez por sesión-sheet-open vía useRef.

**Tests:** mock `track`, 8-10 tests cubriendo cada evento + dedup + casos guest/connected.

**Safe to ship?** Sí. Sigue el mismo patrón del commit `feat(telemetry)` de Sprint 1.

### Commit E — `feat(daily): reward stub (UI + copy + telemetry, NO ledger)`

**Definición de "reward stub" — ver §4 abajo.**

**Scope estricto:**

- Mostrar UI/toast de "+3 Peones earned" en la completion de Daily Tactic. SOLO connected.
- Guest ve copy alternativo "Connect wallet to earn Peones" como CTA.
- Telemetría `peones_earned` con `simulated: true` flag.
- Cero localStorage de Peones, cero llamada a endpoint, cero ledger Supabase.
- Copy explícito "(coming soon)" o "preview" en el toast para que el usuario sepa que es preview, no real.

**Tests:** snapshot del toast/preview, telemetría dispara con `simulated: true`, guest no ve número.

**Safe to ship?** Sí, **solo si copy y framing dejan claro que es preview**. Sin eso, R3 + R4 explotan en producción cuando promovamos.

### Commit F — `feat(daily): PRO extras Friday + Sunday — plumbing only`

**Scope estricto:**

- Plumbing: helper `getProDailyExtras(today): DailyTacticData[]` que retorna 0, 1 o 2 puzzles extras según `dayOfWeek` (Friday = 1 extra, Sunday = 1 extra, otros días = 0).
- Gating UI: solo PRO users ven el slot extra. Reusa `useIsProActive()` (memory `pro-recognition-pattern`).
- **NO autoría nueva**: los puzzles extras vienen del pool de 30 (commit C), seleccionados con un hash distinto para que no sea el mismo del día normal.
- Si la complejidad del UI shift al agregar 1-2 tiles extra en HUB no es trivial, este commit se **parquea para Sprint 2.1** o un mini-cluster propio.

**Tests:** helper + 2 tests de gating (PRO vs no-PRO, Friday vs Monday).

**Safe to ship?** Condicional. Si el HUB layout no soporta 1-2 tiles extra sin refactor visual, este commit se difiere. Lo que NO se hace en Sprint 2: autoría de puzzles exclusivos PRO. Eso requiere commitment de contenido recurrente.

---

## 4. Reward stub — definición canónica

**Reward stub = preview funcional, NO economía real.**

| Aspecto | Stub (Sprint 2) | Real (Sprint 3) |
|---|---|---|
| Acredita Peones reales | ❌ NO | ✅ Sí |
| Toca Supabase ledger | ❌ NO | ✅ Sí (write a `peones_ledger` con attestation_hash) |
| Crea economía real | ❌ NO | ✅ Sí (saldo gastable) |
| UI muestra "+3 Peones" toast | ✅ SÍ (con framing "preview" o "coming soon") | ✅ SÍ (sin framing — es real) |
| HUD chip de saldo de Peones | ❌ NO renderiza saldo numérico | ✅ Renderiza saldo real |
| Telemetría emite `peones_earned` | ✅ SÍ con `simulated: true` | ✅ SÍ sin flag |
| localStorage de saldo Peones | ❌ NO | ❌ NO (saldo vive en Supabase, no localStorage) |
| Caps diarios aplican | ❌ NO (no hay nada que capar) | ✅ Sí (max 10/día) |

**Función del stub:** validar el UI, el copy, el funnel y la telemetría antes de Sprint 3. Si el usuario en preview reacciona mal al "+3 Peones earned" (cree que ya tiene saldo, busca dónde gastarlo), Sprint 3 ajusta el real antes de wire-up.

**Riesgo si el copy falla:** usuario asume que tiene saldo, intenta gastar en Coach, choca con el paywall sin saldo real. UX horrible. Mitigación: copy explícito "+3 Peones (coming soon)" o "Preview reward — full economy lands next sprint".

---

## 5. Parqueo explícito (NO Sprint 2)

| Ítem | Razón | Cuándo |
|---|---|---|
| Lesson-path estilo Duolingo | Discovery UX, no implementación inmediata | Sprint 3 framing o Milestone B labyrinths |
| Catalog-driven exercises (JSON/Supabase) | Requiere infra backend + admin tools | Milestone B (cuando ledger Peones esté maduro) |
| Badge Earned visual parity | Pre-existing visual debt, no causada por Sprint 2 | Cluster visual separado, pre-promote prod |
| `result-overlay.tsx X/15` (StarsRow piece prop) | Solo se toca si bloquea UX de King en preview de hub. Si en `/exercises?piece=king` el "27/15" confunde durante smoke, fix CSS chico en Sprint 2. Si no, espera Sprint 3 | Sprint 3 (default) o Sprint 2 condicional |
| Generator DSL parametrico | Sueño largo plazo, requiere solver/verifier maduro | Post-Sprint 4 retrospective |
| Authoring puzzles exclusivos PRO Friday/Sunday | Compromiso de contenido recurrente; espera validación de hábito | Post-validation Sprint 4 KPIs |

---

## 6. Recomendación final

### 6.1 ¿Sprint 2 seguro de arrancar?

**Sí, con dos guardrails:**

1. **Commit A antes de B/C.** El BFS hard fail debe estar live antes de autorar 16 puzzles nuevos — si el verifier suelta mismatches al agregar King daily puzzles, queremos que el test falle inmediatamente, no después de muchas líneas de autoría.
2. **Commit E (reward stub) requiere review de copy ANTES de implementar.** El copy del toast es la mitigación de R3+R4. Wolfcito debe aprobar el wording exacto antes de que ship.

### 6.2 Primer commit propuesto

`test(exercises): promote BFS verifier to hard fail`

Justificación:
- Riesgo mínimo (1-line change en el test file).
- Verificable en segundos (corrida actual ya está verde).
- Desbloquea el resto del sprint (commit C necesita verifier confiable).
- No bloquea ningún otro frente.

### 6.3 Bloqueos detectados

**Cero bloqueos hard.** Dos cosas requieren tu input antes de ship:

- **Copy del reward stub (commit E)** — ¿"+3 Peones (coming soon)" o "Preview reward earned!" o algo distinto? Necesito tu wording antes de implementar.
- **PRO extras Friday/Sunday (commit F)** — ¿shippeas como plumbing-only (sin layout change visible) o esperamos a un visual cluster que diseñe el HUB con 1-2 tiles extra? Recomendación: plumbing-only, decisión visual diferida.

### 6.4 Sequencing recomendado

```
A → B → C → (smoke King daily) → D → E (con copy aprobado) → F (condicional)
```

Después de C: smoke manual breve confirmando que el puzzle del día rendera bien con King incluido + dificulty tags asignados.
Antes de E: aprobación de copy.
Después de F (o skip si parqueamos): smoke manual final + push a `origin/main`. Producción sigue en hold hasta Sprint 4 retrospective.

---

## 7. Cross-references

- **Sprint 1 closure handoff:** `docs/handoffs/2026-06-06-sprint-1-training-economy-alpha-smoke.md`
- **Decisions doc (parent):** `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md`
- **Engagement direction (grandparent):** `docs/product/chesscito-training-engagement-direction-2026-06-05.md`
- **Daily Tactic actual:** `apps/web/src/lib/daily/*` + `apps/web/src/components/daily/*` + `apps/web/src/components/hub/hub-daily-tile.tsx`
- **Telemetry stack:** `apps/web/src/lib/telemetry.ts` + `apps/web/src/app/api/telemetry/route.ts`
