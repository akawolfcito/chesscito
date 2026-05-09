# Session handoff — Hub Redesign Phase 3 (heavy ports complete) (2026-05-09)

**Continúa de**: `2026-05-09-hub-phase-1-handoff.md` (cerró design-lock + red-team + 6 P0 patches sin commitear)
**Sesión**: Phase 1+2 specs commiteados + Phase 3 completo (3 commits, 3 sheets ported into `<HubScaffoldV2Client>`)
**Status**: Phase 3 (heavy ports) **CLOSED**. V2 scaffold parallel a V1 con ProSheet + BadgeSheet + ShopSheet montando in-place. V1 intacto. 6 commits sin push.

## Lo que cerró esta sesión

### Etapa 1 — Cerrar Phase 1 + 2 (3 commits granulares)

| Commit | Archivo | Notas |
|---|---|---|
| `62a9749` | `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` | 13 secciones prescriptivas, P0 patches landed (post red-team) |
| `fa72ade` | `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-redteam.md` | 36 findings deduped (6 P0 + 13 P1 + 17 P2) + 1 falso positivo |
| `6aa18fd` | `docs/handoffs/2026-05-09-hub-phase-1-handoff.md` | Handoff anterior |

### Etapa 2 — Baseline confirmado

Suite **1292/1292 ✅** sin cambios de código (los `Error: boom` son del test `primitive-boundary` — boundary intencional, no regression).

### Etapa 3 — Phase 3 completo (3 commits)

Tres ports atómicos, uno por sheet, todos siguiendo el mismo patrón:
1. TDD red (test fail-first per §9.1)
2. Hook contract: optional `onPurchaseSuccess` callback ref pattern + rAF defer + cross-wallet guard
3. V2 client: stub UI testid + sheet montado in-place + `<PrimitiveBoundary primitiveName="HubScaffoldV2">` wrap (P1-9)
4. TDD green + suite full + type-check + commit

| # | Commit | Sheet | Tests | Suite |
|---|---|---|---|---|
| 1 | `3aba86f` | ProSheet | 3 (chip-tap mount, close-no-URL, atmosphere shift on purchase) | 1295/1295 |
| 2 | `e5b74ab` | BadgeSheet | 3 (tile-tap mount, close preserves tile DOM, tile re-renders on receipt) | 1298/1298 |
| 3 | `98af59a` | ShopSheet | 2 (ribbon-tap mount, shields 0→3 on shield-item receipt) | 1300/1300 |

### Hook contract pattern (consistente para los 3)

```ts
export type ProPurchaseReceipt = { txHash, daysGranted, buyer };
export type ShopPurchaseReceipt = { txHash, itemId, quantity, buyer };
// BadgeSheet no requiere callback (claims usan refetch interno + lastClaimedPiece)

export type UseProSheetStateOptions = { onPurchaseSuccess?: (receipt) => void };
export type UseShopSheetStateOptions = { onPurchaseSuccess?: (receipt) => void };

// Internal: ref pattern + rAF defer
const onPurchaseSuccessRef = useRef(options?.onPurchaseSuccess);
useEffect(() => { onPurchaseSuccessRef.current = options?.onPurchaseSuccess; });
const fireOnPurchaseSuccess = useCallback((...) => {
  requestAnimationFrame(() => cb({...receipt}));
}, [address]);
```

V1 (`<HubScaffoldClient>`) sigue invocando ambos hooks **sin** options → comportamiento idéntico, callback es opcional. Mocks recíprocos en cada test file (pro/badge/shop) para mantener el import graph barato — cada test mockea los otros 2 sheets como inert.

### Decisiones técnicas tomadas

- **Hook-only callback**: NO se modificó el contrato de los 3 componentes Sheet (preserved `open / onOpenChange` per §6.2). El callback nuevo vive en el hook, fluye hook → V2 consumer.
- **Quantity semantics ShopSheet**: contract `buyItem(itemId, 1, ...)` siempre quantity=1. V2 deriva display delta vía `SHIELDS_PER_PURCHASE = 3` constant (alineado con UX existente "Retry Shield: 3 uses per purchase").
- **Sin event bus en V2**: per §6.4 "callback es el sole channel". V2 NO se suscribe a `subscribeToShieldChanges`. Hook sigue despachando el event para otras superficies (V1, etc.) — no es problema.
- **Cross-wallet guard** (§6.4 race 3): los 2 callbacks (ProSheet + ShopSheet) hacen `receipt.buyer.toLowerCase() !== address.toLowerCase()` → drop silently.
- **Test 2 BadgeSheet ("preserves scroll position")**: reinterpretado en jsdom como "tile element no se desmonta tras close" (mismo nodo DOM, scroll preservado por defecto). E2E visual cubrirá scroll real en Phase 7.

## Estado del repo

- **Branch**: `main`, ahead `origin/main` por **6 commits**
- **Working tree**: limpio
- **Suite**: **1300/1300 ✅** (+8 nuevos vs baseline 1292)
- **Type-check**: passing
- **Asset payload**: 148 KB sin cambio (Phase 3 es lógica + tests; assets entran en Phases 4+)
- **Sin push**: lo siguiente puede ser `git push origin main` para que el work viva en remoto, o continuar local hasta Phase 7+

## Pendientes próxima sesión

### Inmediato (≤2 min)

- (Opcional) `git push origin main` — 6 commits listos
- (Opcional) `pnpm test:e2e:visual` — postergado en esta sesión (V2 no es alcanzable desde rutas, no hay UI visual nueva). Recomendación: correr cuando Phase 7 cablee `?hub=v2` en `app/hub/page.tsx`.

### Phase 4 — Splash primitive (próxima fase, ~2 commits)

Per design-lock §1.1 + §9.2 + nuevo asset `splash-knight-hero.webp` (≤6 KB):

- Commit 1: `<HubV2Splash>` primitive + test
  - 6 asserts (§9.2): mount only when localStorage flag null AND `?hub=v2` active; tap-anywhere dismiss + flag persist; reduced-motion path; ARIA dialog + tabindex focus; never re-mount on second visit
  - **WCAG 2.2.1 compliance**: NO auto-dismiss timer (P0-3 fix). Tap-only dismiss. Hint fade-in 600ms post-entrance.
  - Asset: `splash-knight-hero.webp` (NEW, ≤6 KB) — coordinar con design para que entregue el crop hero
- Commit 2: copy + asset wiring
  - Add `HUB_V2_SPLASH_COPY` to `editorial.ts`
  - Add asset to `apps/web/public/art/scene-rooted/`
  - Update `DESIGN_SYSTEM.md` if asset registry vive ahí

**Heads up para Phase 4**:
- localStorage namespace: `chesscito:hub-v2:splash:seen` (per §11 risk 1 — no chocar con futuro feature)
- MiniPay WebView reset behavior (P1-5): documentar como riesgo deferido a Phase 4 follow-up; smoke test después de impl
- Idle-pulse animation (1.2s ease-spring): existente token `--ease-spring`, no requiere nuevo

### P1 findings que entran a Phases 4-7

13 P1 documentados en red-team report §3. Top 5 para próximas fases:

| P1 | Phase | Fix |
|---|---|---|
| **P1-2 / P1-3** | (entregado en Phase 3) | rAF defer + cross-wallet guard ✅ |
| **P1-5** | Phase 4 | MiniPay localStorage doble persistencia (server-side flag por wallet) |
| **P1-9** | (entregado en Phase 3) | `<PrimitiveBoundary>` wrap desde commit 1 ✅ |
| **P1-10** | Phase 7 | Wallet disconnect behavior en V2 — qué pasa con sheets abiertos cuando user disconnect |
| **P1-11** | (entregado en Phase 4 design) | Keyboard focus trap en splash dialog ✅ documentado en §1.1 |
| **P1-12** | Phase 5 | Coming-soon Q/K tile: label readable mientras sprite dim ✅ documentado en §1.3 |

### Riesgos abiertos (carry-forward)

- **P0-4 contrast gate** (Phase 7): tabla §1.5.1 sigue con TBDs. Phase 7 NO mergea hasta filled con ratios reales. Owner: quien escriba el atmosphere-shift CSS.
- **Asset budget exact-fit** (P2-10): 148 + 30 = 178 KB cap exacto. Cualquier overflow durante Phases 4-7 (ej: warm-wood texture llega a 24 KB en lugar de 22 KB) rompe el cap. Mejor reservar ~5 KB headroom.
- **Visual snapshots deferidos**: `pnpm test:e2e:visual` no se corrió en Phase 3 (V2 no alcanzable). Correr en Phase 7 cuando `?hub=v2` cablee V2 en `/hub`.

## Cómo arrancar próxima sesión

### Checklist pre-sesión

- [ ] `git pull` (o `git push` si decides remotear primero) — confirmar `origin/main` está en `98af59a` o más adelante
- [ ] Lee este handoff
- [ ] Re-lee `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` §1.1 (splash layout) + §3.2 (asset manifest) + §9.2 (TDD plan splash) + §11 (risks)
- [ ] (Opcional) Lee `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-redteam.md` §3 P1-5 (MiniPay localStorage) + P1-11 (keyboard focus)
- [ ] Confirmar baseline suite 1300/1300 si llevas tiempo sin tocar el repo
- [ ] Decidir agente: **Wolfcito directo** (TDD-first) o **Amelia** (`bmad-agent-dev`) para story execution

### Prompt sugerido para arrancar

```
Continúo trabajo en Chesscito. Phase 3 (heavy ports) cerrado 2026-05-09
con 6 commits (3 specs + handoffs + 3 sheet ports). V2 scaffold parallel
a V1, los 3 sheets montan in-place. Suite: 1300/1300.

Handoff: docs/handoffs/2026-05-09-hub-phase-3-handoff.md

Antes de arrancar:
  - Confirmo working tree limpio
  - Re-leo §1.1 + §9.2 del design-lock spec (splash)
  - Confirmo baseline suite 1300/1300

Arrancamos Phase 4 commit 1 — Splash primitive:
  - TDD red phase: hub-splash.test.tsx (6 asserts per §9.2)
  - Implementation: <HubV2Splash> con tap-only dismiss (WCAG 2.2.1)
    + localStorage flag chesscito:hub-v2:splash:seen
    + ARIA dialog + tabindex focus (P1-11)
    + reduced-motion path
  - Asset: splash-knight-hero.webp (≤6 KB, NEW) — coordinar entrega
```

## Notas / lessons

- **TDD-first sostuvo el ritmo**: cada commit fue red → green → suite full + type-check → commit. Cero retrabajo. Los 8 nuevos test cases cubren contratos exactos (callback signatures, atmosphere telemetry, shields refresh) que detectarían regression instantáneamente.
- **Mocks recíprocos > shared test setup**: en lugar de extraer un setup compartido, cada `*-port.test.tsx` mockea sus 2 hermanos como inert. Costo: ~30 líneas duplicadas por archivo. Beneficio: cada test es lectura local, sin hidden coupling. Si algún día el setup duele, ahí se extrae — no antes.
- **Hook-only callback** (en lugar de modificar `ProSheetProps` / `ShopSheetProps`): preservó V1 100% intacto + minimizó superficie tocada. El spec §6.2 ya pedía "preserve testids + ARIA"; aplicarlo también a la prop signature fue la lectura conservadora correcta.
- **Receipt callback es la spina dorsale del V2**: ProSheet → atmosphere shift, ShopSheet → shields refresh. Si Phase 7 pide más reactividad (telemetry granular, toast ceremonies, etc.), el callback ya está ahí — solo es agregar listeners en V2, no tocar hooks.
- **rAF defer no aparece en los tests** porque el callback se invoca sincrónicamente en el test (mock captura + manual fire). Eso valida la wiring; el rAF defer es comportamiento runtime (post sheet exit transition) que se valida en e2e o manualmente. Documentado en código.

---

**TL;DR**: Phase 3 (heavy ports) cerrado en 1 sesión, 6 commits granulares (3 docs + 3 features). V2 scaffold parallel a V1 con ProSheet + BadgeSheet + ShopSheet montando in-place via callback contract per design-lock §6.4. V1 intacto. Suite 1300/1300 (+8). Type-check clean. Working tree limpio. Próxima sesión: Phase 4 commit 1 (splash primitive) per §9.2 TDD plan + nuevo asset `splash-knight-hero.webp`.
