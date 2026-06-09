# Handoff — Rotation Engine Smoke + Cluster Close (2026-06-08)

**Cluster:** Rotation Engine (consume el contenido 10/15 con tier progression + daily rotation).
**Status:** Implementado **detrás de flag (default OFF)**. Legacy bit-idéntico con flag off. Listo para merge/promote de bajo riesgo.
**Branch:** `main`. **Calibration:** `docs/product/chesscito-rotation-engine-calibration-2026-06-08.md`.

---

## 1. Resumen ejecutivo

El rotation engine reemplaza progresivamente la senda lineal fija por **rotación diaria gated por tier**, consumiendo el contenido 10/15 ya listo. Todo vive detrás de `ENABLE_EXERCISE_ROTATION` (default OFF): con el flag apagado el path legacy es **bit-idéntico**; con el flag encendido `/exercises` muestra ≤5 ejercicios del día por pieza, seedeados por `wallet/session + UTC date + piece`, navegables por tier desbloqueado (no por índice lineal). El progreso sigue keyed por pool index / exerciseId — la rotación solo cambia **qué** ejercicios son visibles/navegables, nunca **cómo** se escribe el progreso. El badge sigue across-pool (10★), explícito vía helper.

---

## 2. Commits del cluster

| Slice | Hash | Commit |
|---|---|---|
| Calibration doc | `2ee910c0` | docs(product): rotation engine implementation calibration |
| B — Selectors | `a9c1aab4` | feat(exercises): add rotation selector helpers |
| C — Progress adapter | `1d4fa2cb` | feat(exercises): add dual progress adapter for rotation engine |
| D — Integration tests | `649dad30` | test(exercises): add rotation engine integration tests |
| E — UI behind flag | `12ad87c0` | feat(exercises): wire rotation UI with flag-gated hook access |
| F — Mastery helper | `2b52047e` | refactor(exercises): use mastery helper for badge star threshold |
| G — Smoke + handoff | (este) | chore(qa): smoke and handoff rotation engine |

---

## 3. Estado actual (flag)

- **Flag:** `ENABLE_EXERCISE_ROTATION` — `apps/web/src/lib/exercises/rotation-flag.ts`.
- **Default:** **OFF**.
- **Opt-in:** `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION=true` (dev/preview).
- Constante única, sin framework de flags. Pensada para borrarse al cierre del cluster cuando la rotación sea default.

---

## 4. Qué funciona con flag ON

- `/exercises` muestra **≤5 ejercicios visibles** del día por pieza (no los 10).
- **Guest 0★** → canonical 5 (primeros 5 del pool).
- **Wallet conectada** → set rotado por `hash(wallet, UTC date, piece)`, gated por tier.
- **Tier gating:** Easy desde 0★; Medium @ 5★; Hard @ 9★ (solo si la pieza tiene Hard — hoy solo King).
- **Bias** hacia ejercicios menos completados; **determinístico** por seed/date/piece; reshuffle al cambiar UTC date.
- **Navegación non-linear:** se puede abrir un ejercicio visible aunque no sea el siguiente índice lineal; usa el **pool index real**.
- **Steer:** el board activo se reposiciona al primer visible incompleto cuando el índice persistido cae fuera del set.

## 5. Qué queda legacy con flag OFF

- Senda lineal: drawer lista el pool completo; `isLocked = index > lastCompleted+1`; `goToExercise` con la guarda lineal.
- Sin filtro de visible set, sin steer. **Bit-idéntico al pre-cluster** (verificado: con flag off `computeVisibleExerciseIds → null`, el effect del screen early-returns, el drawer usa el path legacy).

---

## 6. Smoke results

**Visual (Playwright, `--project=minipay` 390×844, flag ON, guest 0★):**
- `/exercises` board: header Exercises, Rook, misión "Move to h1", 0★, tablero, dock — UI mobile limpia, sin rotura.
- Drawer: **exactamente 5 filas** (rook-1..5, Easy), fila 1 activa, "Badge at 10 stars". rook-6/rook-8 **ausentes del DOM** (confirmado ≤5, no 10). Spec efímero pasó: `visible exercise rows = 5`.
- (Capturado en la sesión de validación de slice E; UI sin cambios desde — slice F fue no-visual.)

**Harness determinístico (wallet mock, `use-exercise-progress-rotation-smoke.test.ts`, 6/6):**
- 5★ Rook → Medium aparece en el set del día.
- 9★ King → Hard aparece (bias flota los 2 Hard a 0★).
- Pieza sin Hard → nunca devuelve Hard aunque el tier esté desbloqueado.
- Non-linear: navega a un Medium visible más allá de la senda → escribe el **pool index real**, preserva los valores seedeados.
- Fuera del set → navegación bloqueada.
- Badge cruza en 10★ across-pool, sin importar qué ejercicios tienen las estrellas.

**Total cluster tests:** rotation (18) + adapter (20) + integration (22) + visible-set (4) + hook rotation (5) + drawer (5) + mastery equivalence (5) + smoke (6) = **85 tests** dedicados. Full suite **3257/3257 green**.

---

## 7. Known limitations

- **Hard tier incompleto:** solo King tiene 2 Hard (king-6/king-9). El resto de piezas no tiene Hard aún (wave 2). El gating @9★ funciona pero hay poco contenido Hard que mostrar.
- **Daily Labyrinth:** fuera de este cluster.
- **PRO second Daily Lab:** fuera de este cluster.
- **Guest wallet prompt:** el modelo "canonical 5 → prompt → session_uuid" está parcial: el guest ve canonical 5, pero **no hay sistema de `session_uuid`** generado todavía — el guest siempre ve canonical 5 (no rota) hasta que conecte wallet. El prompt de wallet post-5 + la generación de `session_uuid` quedan para un slice siguiente.
- **Validación visual con wallet:** el path 5★/9★/non-linear se validó vía harness determinístico, no en browser con wallet real (inyección wagmi/MiniPay es costosa). Recomendado un smoke manual en preview con wallet real antes de activar en prod.

---

## 8. Promote recommendation

- **Merge/promote de bajo riesgo:** con flag **default OFF**, el cluster es seguro de mergear/promover — cero cambio de comportamiento o visual en producción.
- **Para activar:** setear `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION=true` explícitamente en el environment (empezar por **preview**).
- No tocar producción hasta validar flag ON en preview con wallet real.

---

## 9. Next steps

1. Mantener flag **OFF en production** por ahora; mergear/promover sin riesgo.
2. Activar flag **ON en preview** + smoke manual con wallet real (5★ Medium, 9★ Hard King, non-linear, completar y verificar progreso).
3. Implementar el guest model completo: prompt de wallet post-canonical-5 + generación de `session_uuid` para rotación de guest.
4. Según smoke en preview: **activar el flag en prod** y luego **remover el flag** (rotación default).
5. **Hard tier wave 2** (×5 por pieza → 15/15) después de validar rotación.

---

## 10. Safety confirmation

Sin cambios en: Peones, Coach/PRO/ledger, payment rails, Daily Tactic, Labyrinths, badge claim contract (10★ across-pool intacto), motor de movimiento, schema de localStorage. Sin endpoints nuevos. Hint usa `currentExercise.id` real; Retry/attemptSeq intactos; earn no se duplica (sigue por exerciseId con gate de delta).

---

## 11. Archivos clave del cluster

- Selectores: `apps/web/src/lib/game/rotation.ts`
- Adapter: `apps/web/src/lib/game/progress-adapter.ts`
- Flag: `apps/web/src/lib/exercises/rotation-flag.ts`
- Visible-set glue: `apps/web/src/lib/exercises/visible-set.ts`
- Hook: `apps/web/src/hooks/use-exercise-progress.ts`
- Drawer: `apps/web/src/components/exercises/exercise-drawer.tsx`
- Screen wire: `apps/web/src/components/exercises/exercises-screen.tsx`
