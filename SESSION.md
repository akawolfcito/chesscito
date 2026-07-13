# Session Handoff — 2026-07-13 (d)

> Cuarta sesión del día. Cierra **la limpieza completa** (los 3 ítems que dejó la sesión (c)).
> El orden acordado era limpieza → duelo por enlace → Belt System. **La limpieza terminó.**

## Completed

- `2b59a829` **Decoder de custom errors** (merge). `BadgeAlreadyClaimed`, `CooldownActive` y
  `DailyLimitReached` dejan de salir los tres como "Try again". ABI generada desde artifacts
  (`generate-error-abis.mjs`, hermano del de eventos), extractor promovido fuera de `lib/debug/`,
  y el mapa nombre → `TxErrorKind` → copy. Cierra el ítem del backlog `2026-07-10`.
- `75cf0161` **Cobertura VR del play hub** (merge). 3 baselines `vr17` vía probe `/dev/play-hub`.
  Requirió que el chip de Peones **dejara de leer la wallet por dentro** — ver Notes.
- `63b60151` **`WoodenBanner` retirado** entero: componente + 5 reglas de CSS + 9 archivos de arte
  (~139 KB). Revierte el "conservar" del mismo día; el spec de los rails quedó actualizado.

## Current State

- **Branch**: `main`, todo pusheado. **PRs abiertos**: ninguno.
- **Build**: Vitest **5118 passing / 426 files** · `tsc --noEmit` limpio · lint sin nada nuevo ·
  VR minipay **58 passed / 1 failed** (el rojo es `hub-shop-sheet-open`, **preexistente**: el env
  local no tiene treasury y el tile de PRO renderiza "Coming soon" donde el test quiere un precio).
- **Uncommitted work**: sólo este `SESSION.md`.

## Next Tasks

1. **Duelo asíncrono por enlace** — `docs/product/2026-07-13-async-link-duel-feasibility.md`.
   **Empezar por un spec, NO por código**: el doc es explícito en que los riesgos son de producto,
   no técnicos. ~2–3 días, no meses.
2. **Belt System** — el GDD, o como mínimo **la decisión del umbral**. Es lo único con reloj.
3. **El smoke del Hub Tour en MiniPay sigue pendiente** (arrastrado desde el 07-12). Es lo único
   que separa al Hub Tour de estar cerrado.

## Blockers

- **El spec de server-verified progress SIGUE bloqueado** (sin cambios desde la sesión (c)).
  Necesita una decisión de producto: ¿(a) defensa en profundidad + passport para el payout,
  (b) challenge token del servidor, o ambas? Hasta entonces, **no tocar `BADGE_THRESHOLD`**.
  Causa: `computeExerciseBfsPath()` viaja en el bundle del cliente, así que re-ejecutar el camino
  en el servidor prueba que la solución es CORRECTA, nunca que un humano la JUGÓ.

## Notes

### ⚠️ La trampa del selector — casi tiro evidencia buena a la basura

Los tres selectores registrados en 8 docs (`0xfafe7970` / `0xc1ab61a1` / `0xeba8fe8a`) **son
correctos**. Los "refuté" durante la sesión con:

```ts
toFunctionSelector("error BadgeAlreadyClaimed(address,uint256)")  // 0xa02cd012 ❌ basura
toFunctionSelector("BadgeAlreadyClaimed(address,uint256)")        // 0xfafe7970 ✅
```

**viem hashea el string literal que le pasás**, con la palabra `error` adentro. Solidity hashea la
firma pelada. Llegué a reportarle al founder que el probe en device había "confirmado un número
inventado" — falso, y la medición del iPhone era legítima. **Me corrigió el test**, no yo: le pedí a
`decodeErrorResult` que decodificara y viem contradijo mi aritmética.

**Regla:** cuando un valor recién calculado contradice una medición registrada, sospechá primero de
tu derivación. Los selectores **no se escriben a mano en ningún lado**, ni en los tests: se derivan
de la firma. → [[feedback_suspect_your_derivation_first]]

### El mismo hook de wallet mordió por segunda vez en dos días

`PeonesBalanceChip` llamaba `usePeonesBalance` → `useAccount` de wagmi, **dos niveles debajo** de dos
scaffolds que en su propio docstring se declaraban presentacionales ("caller owns on-chain state",
"no data/hooks here"). Los dos mentían, y por eso el play hub **no podía montarse bajo `/dev`**:
wagmi tira `WagmiProviderNotFoundError` sin provider, y Playwright habría fotografiado el error
overlay y pasado en verde — exactamente lo que pasó con los rails el día anterior (`0d69e30a`).

Ahora `PeonesBalanceChipView` recibe el balance por prop y los dos clientes hacen la lectura. El chip
conectado sigue existiendo con su API vieja para el hub FULL, así que sus 12 tests no se tocaron.

**La convención (tercera vez que se escribe, aplicarla sin preguntar):** lo que un probe `/dev`
fotografía **recibe su verdad por props**, nunca de un hook de wallet.

### Lo que fijan los 3 baselines nuevos

- `vr17-play-hub-guest` + `vr17-play-hub-connected` son un **par**: el chip de Peones aparece sólo en
  el segundo. Un chip que se filtre a invitados, o que desaparezca para quien tiene wallet, rompe una
  de las dos imágenes.
- `vr17-play-hub-pro` fija que PRO cambia **tres cosas en simultáneo**: badge del HUD (UNLOCK → 12D),
  mascota (mago → mago PRO) y chip del KingdomCard (PRO → PRO active). Que una se desincronice es
  invisible para un test unitario.
- **Ningún fixture renderiza PRO sin wallet.** En producción PRO implica wallet conectada, y un
  baseline de un estado inalcanzable es un baseline que miente.
- **Abrí los 3 PNG y los miré antes de commitearlos.** Ese es el paso que se salteó cuando los rails
  "pasaron" siendo cinco fotos de un `WagmiProviderNotFoundError`.

### Un grep por nombre de archivo NO prueba que un asset esté sin uso

`CandyBanner` arma la ruta en runtime (`/art/redesign/banners/${name}`). Lo que hizo seguro borrar los
3 banners es que su tipo `CandyBannerName` es una **unión cerrada** sobre `btn-*`. Los `btn-*` y
`principalbutton` del mismo directorio se quedan (`PrimaryPlayCTA`, `KingdomCard`, `AppModeSwitch`).

### Deuda que el decoder dejó registrada (no bloquea)

- Los args de los errores (`nextAllowedAt`, `nextWindowStart`) **se decodifican pero no se muestran**.
  La copy es estática a propósito: mostrar "esperá hasta las 14:32" es zona horaria, formato y
  probablemente una cuenta regresiva viva. `decodeErrorResult` ya devuelve los args.
- Sólo `BadgeAlreadyClaimed` tiene evidencia real de device. `CooldownActive` y `DailyLimitReached`
  se **asumen**. Por eso el probe `/dev/tx-error-probe` **se queda** — es el instrumento para medirlos.
- `Invalid player address` clasifica como `unknown` → "Something went wrong". Debería ser
  `signingUnavailable`.

### Arrastrado (sigue vigente)

- **Dónde vive cada hub**: el LEARN hub sólo renderiza en `/` con `NEXT_PUBLIC_CHESSCITO_MODE=learn`
  **y** `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`; con sólo el primero, el flag lanza
  "Contradictory Chesscito mode flags".
- **NO mover el timer de la transición fuera de su `useEffect`** (Strict Mode lo cuelga en
  "Preparing AI…" para siempre).
- El VR es **ciego a cambios de copy chicos** (`maxDiffPixelRatio: 0.01`). `--update-snapshots` por
  default sólo reescribe si el test **falla**: forzar `--update-snapshots=all` y verificar el `mtime`.
