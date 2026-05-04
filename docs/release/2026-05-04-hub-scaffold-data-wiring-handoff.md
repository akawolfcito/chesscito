# Hub scaffold — data wiring (Story 1.12.1) handoff

- **Fecha**: 2026-05-04
- **Owner**: Wolfcito
- **Branch**: `main`. 3 commits landed (`6bf1f6c` → `cda26e2`). Working tree limpio al cierre.

---

## 1. Estado final

- ✅ **Story 1.12.1 cerrada** — `<HubScaffoldClient>` hidrata `<HubScaffold>` con datos on-chain + PRO + progreso local detrás del flag `?hub=new`.
- ✅ **Commits atómicos**:
  - `6bf1f6c` — `deriveRewardTiles` pure util + 11 tests.
  - `ad3421d` — `<HubScaffoldClient>` (wagmi + useProStatus + localStorage stars) + 9 tests.
  - `cda26e2` — `apps/web/src/app/hub/page.tsx` ahora delega `?hub=new` al cliente.
- ✅ **Test suite verde**: 744/744 unit tests passing (+20 netos vs baseline 724).
- ✅ **Type-check clean**: `tsc --noEmit` exit 0.
- ✅ **Smoke**: `/hub` → 200, `/hub?hub=new` → 200; HTML del scaffold contiene `hub-scaffold`, `reward-column`, `premium-slot`, `primary-play-cta`, chip "Trophies: 0", aria "Start training".
- ⚠️ **Visual regression**: 2/3 passing — baseline match. `hub-shop-sheet-open` flaky pre-existente (predates `858a52a`, ver handoff anterior §4.2).

---

## 2. Decisiones tomadas

1. **Util pura `deriveRewardTiles` separada del componente**. Permite cubrir la lógica de unlock chain (rook→bishop→queen→knight→king→pawn) con tests deterministas sin DOM/wagmi. Reglas:
   - Pieza ya minteada → cae fuera del column.
   - `claimable` = stars ≥ threshold (default `BADGE_THRESHOLD=10`) y tier previo dominado.
   - `progress` = tier previo dominado pero threshold no alcanzado.
   - `locked` = tier previo aún no dominado.
   Tiles se devuelven en orden narrativo; `<RewardColumn>` ya hace slice(3) + overflow.

2. **`BADGE_PIECE_BY_INDEX` ≠ `REWARD_TILE_ORDER`**. El primero refleja la enumeración on-chain `BADGE_LEVEL_IDS = [1n..6n]` (rook, bishop, knight, pawn, queen, king). El segundo es la narrativa de progresión (rook→bishop→queen→knight→king→pawn). El cliente respeta ambos: lee badges en orden on-chain, deriva tiles en orden narrativo.

3. **PRO chip colapsa cuando inactivo** (contrato de `HudResourceChip`: `value=null` → `return null`). El parent expone el camino de upgrade vía `<PremiumSlot>` con CTA "Go PRO". Los tests fueron corregidos para asertar este contrato (no presencia del chip cuando inactivo, "Go PRO" visible en el slot).

4. **Sin sesiones de coach trackeadas** — se pasa `premiumUsed=0`, `premiumTotal=0` por ahora. La barra renderiza vacía con label "0/0". Aceptable para v1 wiring; conectar contador real cuando ship el feature de sesiones PRO.

5. **Handlers de tap apuntan a destinos legacy**. Trophy → `/trophies`, todo lo demás → `/hub` (legacy). Esto es deliberadamente transitorio: cuando 1.12 final flippee el flag, los handlers se rewirean a sheets in-scaffold. Mantener simple aquí evita scope creep.

6. **`useProStatus` sin inyección de mock prop**. Probé `useProStatusImpl?` como prop opcional pero requería `require()` dinámico que rompe rules-of-hooks y tree-shaking. Volví a import directo + `vi.mock` en tests — patrón estándar del proyecto.

---

## 3. Verificación

- ✅ `pnpm test`: **744/744 passing** (+20 netos: 11 derive + 9 client).
- ✅ `pnpm tsc --noEmit`: exit 0.
- ✅ `pnpm next lint`: 0 warnings nuevos en archivos tocados.
- ✅ Secret scan: limpio en cada commit.
- ✅ Smoke `pnpm dev`: `/hub` → 200, `/hub?hub=new` → 200; primitives presentes en HTML.
- ⚠️ `pnpm test:e2e:visual`: 2/3 passing — baseline match con la sesión anterior. `hub-shop-sheet-open` pre-existing flaky.

---

## 4. Pendientes inmediatos (orden recomendado)

### 4.1 Cierre de Story 1.12 (flag flip)

- **Pre-requisito**: validar visualmente el scaffold en MiniPay físico con wallet conectado y badges/PRO en distintos estados.
- **Acción**: cuando layout se sienta canonical, flippea default a scaffold en `apps/web/src/app/hub/page.tsx` (`hubFlag === "legacy"` → legacy fallback transitional, scaffold por default).
- **Riesgo**: cuando flippeemos, los handlers `onProTap`, `onPlayPress`, `onPremiumTap` que hoy van a `/hub` legacy van a quedar en loop si no los rewireamos. Hay que decidir destinos finales antes del flip:
  - `onPlayPress` → ¿router a piece-selector sheet? ¿persistir última pieza jugada?
  - `onProTap` / `onPremiumTap` → abrir `<ProSheet>` (necesita portar el sheet al scaffold o levantar el state al layout).
  - `onTrophyTap` → ya OK (`/trophies`).
  - Reward tile tap → abrir `<BadgeSheet>` con la pieza pre-seleccionada.

### 4.2 Story 1.13 — Telemetría

- Eventos: `mission_ribbon_viewed`, `primary_cta_clicked`, `premium_slot_tapped`, `kingdom_anchor_rendered`, `reward_tile_tapped` (nuevo, candidato).
- Wirearlos en `<HubScaffoldClient>` antes del flag flip para tener baseline desde día 0.

### 4.3 Tracker de sesiones PRO

- Hoy `premiumUsed=0`, `premiumTotal=0` quemados. Cuando ship el contador real, leer de Supabase / contrato y pasar al scaffold.
- Mismo problema en legacy `<PlayHubRoot>`, así que vale la pena un hook compartido `usePremiumSessions(address)`.

### 4.4 `hub-shop-sheet-open` flaky

- Pre-existente desde `858a52a`. No bloquea cierre de 1.12.1 pero conviene investigar antes del flag flip — si el flip cambia el rendering del dock, el flaky podría empeorar.

---

## 5. No hacer todavía

- ❌ **No flippear el flag** sin antes definir destinos finales de los tap handlers.
- ❌ **No baseline visual snapshots del scaffold** hasta que la composición sea canonical (mismo razonamiento que en handoff anterior §5).
- ❌ **No agregar mutaciones on-chain (claim/mint) al scaffold** — eso es scope de 1.12 final post-flip o stories posteriores.

---

## 6. Referencias clave

- Util: `apps/web/src/lib/hub/derive-reward-tiles.ts`
- Cliente: `apps/web/src/components/hub/hub-scaffold-client.tsx`
- Tests: `apps/web/src/lib/hub/__tests__/derive-reward-tiles.test.ts`, `apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx`
- Page: `apps/web/src/app/hub/page.tsx`
- Handoff anterior: `docs/release/2026-05-04-arena-primitives-and-hub-scaffold-handoff.md`
- Epic: `_bmad-output/planning-artifacts/epics.md` Story 1.12.x

---

**Fin del handoff.** Próxima sesión: definir destinos de tap handlers + telemetry (1.13), o avanzar Epic 2 con Story 2.3 (`/arena` migration). Ambos siguen freeze-safe.
