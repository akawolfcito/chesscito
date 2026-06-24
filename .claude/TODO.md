## Session Plan — 2026-06-22 · B2.2a Stable Challenge Links

### Contexto del problema

`/challenge/daily?date=YYYY-MM-DD` resuelve el puzzle con `hashDate(date) % pool.length`.
Si el pool crece de 30→40, la misma fecha mapea a un puzzle diferente. Los links ya compartidos
se rompen. La promesa "the shared link is the game" deja de cumplirse.

---

### Auditoría de puntos de generación de URL (callsites exactos)

**URLs `/challenge/daily` que se generan hoy** (los únicos afectados):

| Archivo | Línea | URL generada |
|---------|-------|-------------|
| `challenge-daily-client.tsx` | 49 | `` `${origin}/challenge/daily?date=${today}` `` — falta `puzzle` |
| `challenge/daily/page.tsx` | 46 | `` `${origin}/challenge/daily?date=${date}` `` — falta `puzzle` (en canonical de OG) |

**URLs de OG card** (`/share/daily?piece=...&start=...&target=...`): ya son estables porque
encodean posición directamente, NO usan `hashDate % N`. No se tocan.

**`HubDailyTile`** (hub-daily-tile.tsx): no genera `shareLinkUrl` en absoluto —
pasa `shareUrl` + `shareSolvedUrl` (OG card) pero NO `shareLinkUrl` a `DailyTacticSheet`.
El spec requiere que el Hub también comparta el challenge link con puzzleId.

---

### Solución — Diseño

#### Regla de resolución en `/challenge/daily/page.tsx`

```
searchParams.puzzle presente y válido  →  ese puzzle exacto (pool-size agnostic)
searchParams.puzzle presente e inválido  →  fallback a getDailyTactic(date)
sin searchParams.puzzle  →  getDailyTactic(date)  (backwards compat — links viejos)
```

#### URL canónica después de B2.2a

```
/challenge/daily?date=2026-06-22&puzzle=dt-rook-3
```

---

### Files to Change — 4 archivos, 1 test file

#### 1. `apps/web/src/lib/daily/daily-puzzles.ts`

Agregar dos funciones puras:

```ts
export function getPuzzleById(id: string): DailyTacticData | undefined {
  return DAILY_TACTIC_PUZZLES.find((p) => p.id === id);
}

export function resolveDailyPuzzle(date: string, puzzleId?: string): DailyTacticData {
  if (puzzleId) {
    const byId = getPuzzleById(puzzleId);
    if (byId) return byId;
  }
  return getDailyTactic(date);
}
```

No se cambia `getDailyTactic`. No se rompe nada existente.

---

#### 2. `apps/web/src/app/[locale]/challenge/daily/page.tsx`

Cambios mínimos:

```diff
- type SearchParams = { date?: string };
+ type SearchParams = { date?: string; puzzle?: string };

  export default function ChallengeDailyPage({ searchParams }) {
    const today = resolveDate(searchParams.date);
-   const puzzle = getDailyTactic(today);
+   const puzzle = resolveDailyPuzzle(today, searchParams.puzzle);
    return <ChallengeDailyClient puzzleData={puzzle} today={today} />;
  }
```

En `generateMetadata` — actualizar canonical con puzzleId:
```diff
- const canonical = `${origin}/challenge/daily?date=${date}`;
+ const canonical = `${origin}/challenge/daily?date=${date}&puzzle=${puzzle.id}`;
```

---

#### 3. `apps/web/src/app/[locale]/challenge/daily/challenge-daily-client.tsx`

```diff
- const challengeUrl = `${origin}/challenge/daily?date=${today}`;
+ const challengeUrl = `${origin}/challenge/daily?date=${today}&puzzle=${puzzleData.id}`;
```

Una sola línea. `puzzleData` ya llega como prop — no hay nueva dependencia.

---

#### 4. `apps/web/src/components/hub/hub-daily-tile.tsx`

Agregar `shareLinkUrl` al `<DailyTacticSheet>`:

```diff
+ const origin = getShareOrigin();
+ const shareLinkUrl = `${origin}/challenge/daily?date=${today}&puzzle=${puzzleData.id}`;

  <DailyTacticSheet
    ...
    shareUrl={shareUrl}
    shareSolvedUrl={shareSolvedUrl}
+   shareLinkUrl={shareLinkUrl}
    isConnected={isConnected}
  />
```

`getShareOrigin` ya se importa en otros componentes del mismo folder.

---

#### 5. `apps/web/src/lib/daily/__tests__/daily-puzzles.test.ts`

Agregar `describe("resolveDailyPuzzle")`:

```ts
describe("resolveDailyPuzzle", () => {
  it("getPuzzleById returns the correct puzzle for a known id", () => { ... });
  it("getPuzzleById returns undefined for an unknown id", () => { ... });
  it("resolveDailyPuzzle(date, validId) returns that exact puzzle", () => { ... });
  it("resolveDailyPuzzle(date, invalidId) falls back to getDailyTactic(date)", () => { ... });
  it("resolveDailyPuzzle(date) behaves identically to getDailyTactic(date)", () => { ... });
  it("pool expansion does not affect resolution when puzzleId is provided", () => {
    // El pool tiene 30 puzzles. Si el mismo `date` mapea a un índice diferente
    // tras expansión, el link con puzzle=ID sigue devolviendo el mismo puzzle.
    const knownId = DAILY_TACTIC_PUZZLES[0].id;
    const date = "2026-06-22";
    expect(resolveDailyPuzzle(date, knownId).id).toBe(knownId);
    // Simulación: no hay forma de cambiar el pool en runtime en el test,
    // pero el test prueba la propiedad: el resultado depende de id, no de date%N.
    expect(resolveDailyPuzzle("2025-01-01", knownId).id).toBe(knownId);
  });
});
```

---

### Tests a NO tocar

- BFS reachability `it.each` — no se tocó el pool
- Conteo de 30 puzzles — no se agregaron puzzles aún (eso es B2.2b)
- PRO extras — no se tocaron
- Rotación — sigue siendo correcta

---

### Risks

| Riesgo | Severidad | Mitigación |
|--------|-----------|-----------|
| Links antiguos (sin `puzzle=`) siguen funcionando | Ninguno — fallback a `getDailyTactic(date)` explícito | Test "sin puzzleId → comportamiento actual" |
| `searchParams.puzzle` con un id de otro surface (ej. `dt-rook-1` del exercises) | Bajo — el id existe en el pool → resuelve correctamente | Mismos IDs en `DAILY_TACTIC_PUZZLES` |
| `getShareOrigin()` sin import en `hub-daily-tile.tsx` | Bajo — función ya existe en `lib/og/share-urls`; verificar import | Typecheck lo detecta |
| `generateMetadata` en `page.tsx` necesita el puzzle para construir canonical | Ya se tiene — `puzzle` se resuelve antes del OG call | Sin riesgo |

---

### Out of Scope

- Los 10 puzzles nuevos (eso es B2.2b, se hace DESPUÉS)
- `/share/daily` — ya es estable por diseño (encoda posición)
- `DailyTacticSlot.shareLinkUrl` → apunta a `/share/daily` (OG landing), no a `/challenge/daily` — comportamiento diferente al del challenge, no se toca aquí
- Rediseño, rewards, economy, Content Loop v2

---

### Implementation Order (TDD)

1. **Red**: Agregar `describe("resolveDailyPuzzle")` en test file → fallan (función no existe)
2. **Green**: Agregar `getPuzzleById` + `resolveDailyPuzzle` en `daily-puzzles.ts` → tests verdes
3. Actualizar `page.tsx` — usar `resolveDailyPuzzle` + tipo `SearchParams` + canonical con puzzleId
4. Actualizar `challenge-daily-client.tsx` — una línea
5. Actualizar `hub-daily-tile.tsx` — agregar `shareLinkUrl`
6. `pnpm --filter web type-check` → 0 errores
7. `pnpm --filter web test` → suite completa verde
8. Commit: `feat(b2.2a): stable challenge links — puzzle param pins exact puzzle`
9. PR + auto-merge → main
10. Smoke manual (ver abajo)
11. Después: aprobar B2.2b (Content Pack)

---

### Smoke Manual

1. Resolver puzzle del día desde Hub (`/hub` → Daily Tile)
2. Tap "Share" — verificar que la URL copiada incluye `?date=...&puzzle=dt-xxx-N`
3. Abrir `/challenge/daily?date=2026-06-22&puzzle=dt-rook-1` → carga rook-1 exacto (no el puzzle de hoy)
4. Abrir `/challenge/daily?date=2026-06-22&puzzle=invalid-xxx` → carga el puzzle de hoy (fallback silencioso)
5. Abrir `/challenge/daily?date=2026-06-22` (sin puzzle) → carga el puzzle de hoy (backwards compat)
6. Confirmar que la URL en OG meta (`canonical`) incluye `puzzle=`
7. Confirmar que `/stats` sigue cargando sin error

---

### Current State
- ✅ **B2.1**: suite 4327/4327, `408f30e6`
- ⏳ **B2.2a**: plan listo — esperando aprobación
- 🔒 **B2.2b**: bloqueado por B2.2a

---

## Session Plan — 2026-06-22 · B2.2 Daily Challenge Content Pack

### Existing Daily Content Inventory

**Pool activo** (`lib/daily/daily-puzzles.ts`): **30 puzzles** — `DAILY_TACTIC_PUZZLES`

| Pieza   | Cantidad | Dificultades                       |
|---------|----------|------------------------------------|
| rook    | 5        | easy×3, medium×2                   |
| bishop  | 4        | easy×3, medium×1  ← mínimo del pool |
| knight  | 5        | easy×3, medium×2                   |
| pawn    | 5        | easy×4, hard×1                     |
| queen   | 5        | easy×3, medium×2                   |
| king    | 6        | easy×2, medium×3, hard×1           |
| **Total** | **30** | easy×18, medium×10, hard×2        |

**Pool legacy** (`lib/daily/puzzles.ts`): 7 puzzles FEN (mate-in-1) — **NO conectado** a `/challenge/daily`.

---

### Puzzle Schema (campos reales)

`DailyTacticData`:
```ts
{
  id: string
  name: string
  piece: PieceId
  exercise: Exercise
  hint: string
  difficulty?: PuzzleDifficulty  // "easy" | "medium" | "hard" — REQUERIDO (test lo pina)
}
```

Helpers: `sq("a1")`, `defineLabyrinth({ id, start, target, obstacles?, captureTargets?, isCapture?, optimalMoves })`

---

### Behavior de fechas — ya correcto post-B2.2a

Tras B2.2a, `page.tsx` usará `resolveDailyPuzzle(today, searchParams.puzzle)`.
Con `puzzle` presente en el link → puzzle exacto siempre. Sin `puzzle` → `getDailyTactic(date)`.

---

### Content Pack — Pack 01 (10 puzzles nuevos → pool 40)

| Pieza   | +  | Total |
|---------|----|-------|
| rook    | +2 | 7     |
| bishop  | +2 | 6     |
| knight  | +2 | 7     |
| pawn    | +2 | 7     |
| queen   | +2 | 7     |
| king    | 0  | 6     |

Dificultad nuevos 10: 6 easy + 4 medium → totales: easy×24 / medium×14 / hard×2

Tests a actualizar: "has exactly 30 puzzles" → 40, distribución, dificultad.
BFS `it.each` auto-cubre los nuevos puzzles.

**IDs de continuación**: `dt-rook-6/7`, `dt-bishop-5/6`, `dt-knight-6/7`, `dt-pawn-6/7`, `dt-queen-6/7`

---

## Session Plan — 2026-06-22 · B2.1 Challenge Funnel Metrics

### Current State

- ✅ **Completado**: B2.0 Challenge Link en prod (`b0a044aa`). 5 eventos en `challenge-telemetry.ts`.
- ✅ **Completado**: B2.1 Challenge Funnel Metrics en main (`408f30e6`). Suite 4327/4327.

---

## Session Plan — 2026-03-28: Systems & Content Expansion (continued)

### Completed This Session

- PR-1 ✅ 6-piece foundation
- PR-2 ✅ Supabase bootstrap
- PR-3 ✅ Pawn exercises
- PR-4 ✅ Score re-submission
- PR-5 ✅ Unlock gating
- PR-6 ✅ Queen exercises
- PR-7 ✅ Practice move logging
- PR-8 ✅ Hall performance
- PR-9 ✅ King exercises
- PR-11 ✅ Global progress + unlock celebration + ? button removed

---

## Session — 2026-03-13

- ✅ #19 Passport gating
- ✅ Share Card
- ✅ Demo Video — Remotion promo video

---

## Session Plan — 2026-03-10 (session 2)

- ✅ #7 Cinematica Torre
- ✅ #8 Captura con Torres
- ✅ #20 Shop v1: Retry Shield

---

## Session Plan — 2026-03-10 (session 1)

- ✅ UX overhaul: 3-zone floating HUD layout
- ✅ BadgeSheet collection component
- ✅ On-chain verification: rook badge confirmed

---

## Session — 2026-03-09

- ✅ GitHub housekeeping: closed #22, #21, #14, #13, #10, #9, #4, #3
- ✅ Visual polish fixes
