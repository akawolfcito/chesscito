# Audit — Reward rail LCP candidates (Path B scoping)

**Date:** 2026-06-03
**Mode:** read-only, no patches
**Prior commit:** `aa52988a` (Path A — bg-new-hub preload, perf 65 → 71)
**Trigger:** post-patch LCP migrated to `<img>` inside `div.hub-action-rail`

---

## 1. Above-the-fold image inventory in `/hub` boot

| # | Surface | Element | Asset | Above fold? | Visible default boot? |
|---|---|---|---|---|---|
| 1 | Right rail | `HubDailyTile` icon (post-hydration) | `ejercicio-diario-chess.{avif,webp,png}` | ✅ y=325-365 | ✅ siempre (renders post-hydration via `<HubActionTile priority />`) |
| 2 | Right rail | `HubArenaTile` icon | `play-chess.{avif,webp,png}` | ✅ y≈400 | ❌ **null cuando rook < 12 stars** (default fresh boot) |
| 3 | Right rail | `HubActionTile` coach icon | `training.{avif,webp,png}` | ✅ y≈475 | ✅ siempre (onCoachTap está cableado) |
| 4 | Center | `KingdomAnchor` portal | `chesscito-normal-portal.{avif,webp,png}` | ✅ y=140-510 | ✅ siempre (SSR'd `<picture>`) |
| 5 | Left rail | `RewardColumn` piece (rook) | `w-rook.{avif,webp,png}` | ✅ y≈170 | ✅ siempre (locked state) |
| 6 | Left rail | `RewardColumn` piece (bishop) | `w-bishop.{avif,webp,png}` | ✅ y≈260 | ✅ |
| 7 | Left rail | `RewardColumn` piece (queen) | `w-queen.{avif,webp,png}` | ✅ y≈350 | ✅ |
| 8 | Left rail | `RewardColumn` piece (knight) | `w-knight.{avif,webp,png}` | ✅ y≈440 | ✅ |
| 9 | Left rail | `RewardColumn` piece (pawn) | `w-pawn.{avif,webp,png}` | ✅ y≈530 | ✅ |
| 10 | Left rail | `RewardColumn` piece (king) | `w-king.{avif,webp,png}` | ✅ y≈620 | ✅ |

**Total visible above-the-fold:** 9 assets en fresh boot (sin HubArenaTile).

## 2. LCP candidate per run (post-patch)

| Run | LCP selector | Asset | Rect | Decision |
|---|---|---|---|---|
| r1 | `div.hub-action-rail > button.reward-tile > picture.reward-tile-piece > img` | `ejercicio-diario-chess.avif` | 38×41 (intrinsic 256×273) | ✅ confirmed |
| r2 | mismo | `ejercicio-diario-chess.avif` | 38×41 | ✅ confirmed |
| r3 | NONE (LCP audit aborted) | — | — | (run no produjo candidate estable; r1/r2 son consistentes) |

**LCP candidate consistente: `ejercicio-diario-chess.avif`** (right rail Daily Tactic icon).

## 3. Network waterfall — quién arranca tarde (r1)

| Asset | netStart (ms) | netEnd (ms) | Size | Priority | Notes |
|---|---:|---:|---:|---|---|
| chesscito-normal-portal.avif | 1015 | 1943 | 21 KB | High | SSR'd, fetchPriority hint |
| w-rook.avif | 1018 | 1250 | 4 KB | Medium | SSR'd via RewardColumn |
| w-bishop.avif | 1018 | 2092 | 4 KB | Medium | SSR'd |
| w-queen.avif | 1024 | 1498 | 5 KB | Low | SSR'd |
| w-knight.avif | 1024 | 1499 | 3 KB | Low | SSR'd |
| w-pawn.avif | 1024 | 1943 | 3 KB | Low | SSR'd |
| w-king.avif | 1024 | 2372 | 4 KB | Low | SSR'd |
| training.avif | 1025 | 2349 | 12 KB | Low | SSR'd via HubActionTile coach |
| **ejercicio-diario-chess.avif** | **3524** | 3774 | 11 KB | **High** | ⚠️ **+2.5s después del resto** |

**Smoking gun:** todos los assets SSR'd arrancan ~1018-1025 ms (justo después del CSS parse). El icon `ejercicio-diario-chess.avif` arranca a 3524 ms — **2.5 segundos más tarde**.

## 4. Root cause del 2.5s delay

`HubDailyTile` (`apps/web/src/components/hub/hub-daily-tile.tsx:81-89`):

```tsx
if (!hydrated) {
  return (
    <div
      aria-hidden="true"
      className="reward-tile is-locked"
      style={{ visibility: "hidden" }}
    />
  );
}
// ...
return <HubActionTile iconSrc="/art/new-icons-chesscito/ejercicio-diario-chess.png" priority ... />;
```

Antes de hydration, el `<img>` con `src=ejercicio-diario-chess.png` **no existe en el DOM**. El preload scanner del browser no puede descubrirlo durante el HTML parse. Solo después de:

1. JS bundle download + parse (Load Delay del LCP)
2. React hydrate
3. `useEffect(() => setHydrated(true))` fire
4. Re-render con `<HubActionTile />` montado
5. Browser ve el `<img src>` por primera vez → arranca fetch

…el browser hace el request. Eso es el `3524 ms`.

**Consecuencia:** preload del Daily icon **warma el cache durante la ventana de hydration**. Cuando el `<img>` finalmente monte, los bytes ya están listos → paint instantáneo (zero Load Time, solo Render Delay).

## 5. Decisión de scope — **1 asset, NO 6**

| Asset | ¿Preload? | Justificación |
|---|---|---|
| **`ejercicio-diario-chess.avif + .webp`** | ✅ SÍ | LCP candidate confirmado en r1+r2; arranca 2.5s tarde por hydration gate; preload warma cache durante hydration |
| `training.avif` | ❌ NO | Arranca a 1025 ms (SSR'd). Ya no es bottleneck. Preload sería ruido. |
| `chesscito-normal-portal.avif` | ❌ NO | Arranca a 1015 ms con priority High. Ya no es bottleneck. |
| `w-rook/bishop/queen/knight/pawn/king.avif` | ❌ NO | Todos arrancan 1018-1024 ms (SSR'd). El más lento (`w-king`) termina en 2372 ms — antes que el daily icon empiece. Cero ganancia de preload. |
| `play-chess.avif` (Arena tile) | ❌ NO | Null cuando rook<12 stars (default fresh user). No above-the-fold en boot típico. |

**Total preloads agregados: 2** (1 AVIF + 1 WebP fallback para `ejercicio-diario-chess`).

## 6. Patch propuesto

`apps/web/src/app/[locale]/hub/page.tsx` — agregar después de los preloads existentes:

```ts
// HubDailyTile gates its <img> behind a hydration flag (visible:hidden
// placeholder until useEffect flips the state). Without a preload the
// browser only discovers the icon URL after hydration, costing ~2.5s of
// LCP Load Delay on Slow-4G. Preloading the AVIF + WebP triplet warms
// the cache during the hydration window so the paint is instant once
// the <img> mounts. Confirmed LCP candidate on 2/3 mobile runs post
// bg-new-hub preload — see docs/audits/2026-06-03-hub-reward-rail-lcp-audit.md.
preload("/art/new-icons-chesscito/ejercicio-diario-chess.avif", {
  as: "image",
  type: "image/avif",
  fetchPriority: "high",
});
preload("/art/new-icons-chesscito/ejercicio-diario-chess.webp", {
  as: "image",
  type: "image/webp",
});
```

**Net delta:** +2 líneas funcionales + comentario.

## 7. Estimado de impacto

| Métrica | Post-Path-A | Post-Path-B (estimado) | Δ |
|---|---:|---:|---:|
| LCP mobile | 6636 ms | **4200-4800 ms** | -1800 a -2400 ms |
| Perf score mobile | 71 | **77-82** | +6 a +11 |
| FCP | 1797 ms | 1797 ms | 0 |
| TBT | 79 ms | 79 ms | 0 |
| CLS | 0 | 0 | 0 |
| SI | 5879 ms | 5500-5800 ms | -100 a -400 ms |

Confianza: alta. El mecanismo es el mismo que el de Path A (preload scanner vs JS-gated discovery), solo aplicado al asset específico que aún sufre el delay.

**Wall pendiente post-Path-B:** la LCP no bajará a <2500 ms (target "good") sin tocar el `if (!hydrated) return placeholder` de HubDailyTile. Eso requiere SSR-el-icon o eliminar el gate, lo cual el usuario excluyó explícitamente de este sprint.

## 8. Tests / smoke

- `pnpm test hub` — el test file ya tiene asserts contra `preloadMock`. Agregar 2 nuevos asserts para los paths del daily icon (avif + webp).
- `pnpm type-check`, `pnpm lint` — sin riesgo.
- Vercel preview verificar `<link rel="preload" href="/art/new-icons-chesscito/ejercicio-diario-chess.avif">` en HTML head.
- Promote prod → Lighthouse 3x mobile.
- Verificar waterfall: `ejercicio-diario-chess.avif` debe arrancar ahora ~1000 ms (no 3500).
- Confirmar no double-fetch (1 sola entrada en network).
