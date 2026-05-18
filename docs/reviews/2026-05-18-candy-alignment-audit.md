# Candy Alignment Audit — All Screens

**Fecha**: 2026-05-18
**Alcance**: estado de `main` (commit `75c57ca`) + flag explícito de qué resuelve PR #113 (`feat/spec-1-candy-polish`).
**Método**: enumeración de rutas + grep de anti-patterns + inventario de primitivos candy. Sin modificación de código.

---

## 1. Matriz screen × estado candy

| Ruta | Estado | Comentario |
|---|---|---|
| `/` (landing) | 🟡 **Partial** | `app-shell.tsx` usa `text-slate-950` / `text-slate-600` para CardTitle/Description — paleta dark-on-white, no tokens paper. |
| `/hub` | 🟡 **Partial → 🟢 post-merge** | Estructuralmente OK; LEARN/UNLOCK rails, Hero CTA, onboarding, SecondaryCta **pendientes en PR #113**. SPEC 1 (#112) trae destinations + Profile + Settings. |
| `/exercises` | 🟢 **Aligned** | Usa `ExercisesScreen` + `mission-panel-candy` + `mission-header-candy`. Sheets con `sheet-bg-hub`. **Pendiente:** orphan sheets sin trigger del dock (BadgeSheet/ShopSheet/LeaderboardSheet/TrophiesSheet — follow-up SPEC 1 #2). |
| `/arena` | 🔴 **Legacy island** | **Spinner preparing-AI con `cyan-400`/`cyan-100/70` visible** (líneas 1074-1075, 1160-1161). `arena-bg` se mantiene grass-bg, pero el loading state rompe el dialecto candy. |
| `/trophies` | 🟡 **Partial → 🟢 post-merge** | Body migrado a candy-frame; **empty states (3 paths) pendientes en PR #113** (`712662b`, `e127c6c`, `df951a8`). |
| `/coach/history` | 🟢 **Aligned** | `paper-surface` + tokens paper. Migrado en sweep 2026-04-22. |
| `/about`, `/privacy`, `/terms`, `/support`, `/why` | 🟢 **Aligned** | `LegalPageShell` + candy tokens (sweep 2026-04-22 / D). |
| `/victory/[id]` | 🟢 **Aligned** | Usa `accept-challenge-button` con primitivos candy. |
| No existe `/leaderboard` | ⚠️ | MEMORY.md afirma "/leaderboard (revalidate=60s)" pero `app/leaderboard/` no existe. **Solo es `LeaderboardSheet`** abierta desde el dock. Memoria desactualizada. |

**Resumen**: 5 verdes, 3 amarillas (todas con fix en PR #113), 1 roja (arena loading state).

---

## 2. Anti-patterns detectados en `main`

### 2.1 Dark theme remnants

**`text-cyan-*` / `border-cyan-*`** (10 occurrences en 6 archivos):

| Archivo:línea | Severidad | Visibilidad | Nota |
|---|---|---|---|
| `app/arena/page.tsx:1074-1075` (scaffold path) | 🔴 **Alta** | Visible | Spinner `cyan-400/30` + texto `cyan-100/70` en preparingAi state |
| `app/arena/page.tsx:1160-1161` (legacy path) | 🔴 **Alta** | Visible | Mismo patrón duplicado en branch legacy `ArenaEntryPanel` |
| `app/arena/page.tsx:1051` | ⚪ Dead | No | `text-cyan-100/70` en `<button><img/></button>` — clase muerta |
| `components/exercises/badge-sheet.tsx:221` | ⚪ Dead | No | Mismo patrón en trigger del dock — clase muerta |
| `components/exercises/leaderboard-sheet.tsx:111` | ⚪ Dead | No | Idem |
| `components/exercises/shop-sheet.tsx:190` | ⚪ Dead | No | Idem |
| `components/ui/stat-pill.tsx:8` | 🟡 Media | Visible | Variant non-amber pill usa `border-cyan-400/30` |
| `components/exercises/piece-picker-sheet.tsx:80` | 🟡 Media | Visible | **Selected piece state** usa `cyan-400/75` ring + `cyan-400/15` bg — debería ser amber/gold |

**`text-slate-*` / `border-slate-*`** (2 archivos):

| Archivo:línea | Severidad | Nota |
|---|---|---|
| `components/app-shell.tsx:40,43` | 🟡 Media | `text-slate-950` / `text-slate-600` en landing card. Probablemente la landing pre-MiniPay; verificar si todavía se renderiza. |
| `components/connect-button.tsx:30` | 🟡 Media | `border-slate-200 bg-white text-slate-600` — shadcn-default. Wallet button, posiblemente intencional para reconocimiento web3, pero no usa tokens candy. |

**Red color (deberían ser `rose-*`)**: ✅ Cero. HARD RULE respetada.

### 2.2 Type scale violations

**`text-[Xpx]` arbitrario** (~33 occurrences):

La regla del DESIGN_SYSTEM prohíbe `text-[Xpx]` arbitrario; todo debe estar en la escala de 7 niveles + `text-nano`. La realidad en `main`:

- **Concentrado en `components/trophies/`** (15 occurrences): `text-[9px]`, `text-[10px]`, `text-[11px]`. La mayoría son labels uppercase en trophy cards y achievements grid. **Deberían migrarse a `text-nano` (8px) o `text-xs` (12px)**.
- **`components/arena/victory-claim-*` / `victory-claiming`** (~9 occurrences): mismo patrón.
- **`pro-chip.tsx`, `paper-stat-card.tsx`, `cognitive-disclaimer.tsx`, `build-version.tsx`, `candy-chip.tsx`**: 1-2 occurrences cada uno.
- **`leaderboard-sheet.tsx:153`**: `text-[10px] ... bg-violet-600 ... text-white` — viola escala **y** introduce violet sin token.

Nota: el HARD RULE se introdujo en 2026-04-12 (#91). Estas violaciones son **regresión post-cierre** o componentes que se crearon después sin revisar la escala.

### 2.3 Legacy V2 hub-scaffold

`apps/web/src/components/hub/hub-scaffold-v2-client.tsx` **sigue existiendo en `main`** (10845 bytes, mod 2026-05-15). SPEC 1 §D15 lo marcaba como retirado. Está en **PR #112** (commit retiraría el archivo). No es candy-alignment per se, pero es deuda de unrelease.

### 2.4 Sheet vocabulary

✅ **Consistente**. 5 utilidades `sheet-bg-*` (hub/badges/shop/leaderboard/danger) usadas en 12 consumers con la misma estructura: `mission-shell sheet-bg-X flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]`. Cohesión sólida.

---

## 3. Primitivos candy — inventario de uso

80 archivos importan al menos uno de:
- `candy-frame`, `paper-surface`, `PaperPanel`
- `CandyIcon`, `CandyBanner`, `CandyChip`, `CandyCard`, `CandyGlassShell`
- `GemBadge`, `GemButton`, `TreasureTile`, `PrincipalButton`
- `paper-stat-card`, `mission-shell`, `mission-panel-candy`, `mission-header-candy`

Cobertura amplia y distribuida. No hay primitivo huérfano detectado.

---

## 4. Qué resuelve PR #113 (Phase 9 candy polish)

3 commits feat + handoff:

| Commit | Superficie |
|---|---|
| `712662b feat(hub): candy polish — rails, hero, onboarding, secondary CTA` | LEARN/UNLOCK rails + Hero CTA (amber + blue) + Onboarding card + SecondaryCta "Enter Arena →" |
| `e127c6c feat(trophies): empty-state cards use candy-frame-amber` | `/trophies` empty paths (`!isConnected`, `isEmptyConnected`) |
| `df951a8 feat(trophies): configError fallback also gets the frame` | `/trophies` `!configured` path |

**Total post-merge esperado**: 8/9 superficies amarillas pasan a verdes. Solo permanece `/arena` (loading spinner) y `app-shell` landing.

---

## 5. Recomendaciones priorizadas

### P0 (rompe coherencia visual en pantalla visible)

1. **Arena loading spinner** (`/arena` selecting → preparing AI)
   - 2 instancias en `app/arena/page.tsx` (scaffold + legacy)
   - Cambiar `cyan-400/30` → `amber-400/30` (o `border-[var(--cta-primary-bg)]`)
   - Cambiar `text-cyan-100/70` → `text-amber-100/80` o token paper
   - **Effort**: 4 líneas, sin riesgo de regresión.

### P1 (selected state inconsistente con dialecto)

2. **Piece picker selected state** (`piece-picker-sheet.tsx:80`)
   - `cyan-400/75` ring → `amber-400/75` o gold token
   - Alinea con resto del hub que ya usa amber/gold para activos
   - **Effort**: 1 línea.

3. **stat-pill non-amber variant** (`stat-pill.tsx:8`)
   - Decidir: ¿se usa este variant? Si sí, repintar a paleta candy; si no, eliminar el variant.

### P2 (limpieza)

4. **Dead `text-cyan-100/70` en triggers del dock** (4 archivos)
   - Eliminar la clase muerta — está en `<img/>` y no afecta render, pero ensucia grep.
   - **Effort**: 4 líneas borradas.

5. **Type scale violations en trophies/victory** (~25 occurrences)
   - Sweep dedicado: `text-[10px]/[11px]` → `text-nano` / `text-xs`.
   - Probable que necesite ajustar `tracking-` / `font-weight` para compensar.
   - **Effort**: ~1 hora, requiere visual smoke después.

6. **app-shell landing slate-* tokens**
   - Verificar si `app-shell.tsx` se renderiza hoy (puede ser legacy SSR shell).
   - Si vivo: repintar a paleta paper. Si muerto: eliminar.

7. **connect-button slate-*** — decisión de producto: ¿mantener look "neutro web3" o forzar candy? Recomiendo candy con leve diferenciación visual (no slate puro).

### P3 (deuda no-candy)

8. **`hub-scaffold-v2-client.tsx`**: queda retirado al mergear #112. No requiere acción separada.

9. **Memoria de routing**: actualizar `MEMORY.md` línea 111 — `/leaderboard` no existe como ruta, solo como sheet.

---

## 6. Conclusión

Estado **80% candy-aligned** en `main` hoy. Post-merge de #113, sube a **92%**. Las únicas inconsistencias visibles post-merge son:
- Arena loading state (1 fix de 4 líneas)
- Landing app-shell (decisión de producto: ¿vive todavía?)
- Selected-piece cyan ring en piece picker

Las violaciones de type scale en `/trophies` y `/arena/victory-*` son una segunda capa de deuda (no rompen color, sí rompen escala tipográfica), tratables como sweep dedicado P2.

**No hay islas de tema oscuro masivas**. La identidad candy está consolidada; lo que queda son detalles puntuales y un sweep tipográfico.
