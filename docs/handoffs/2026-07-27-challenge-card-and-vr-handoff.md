# Handoff — ChallengeCard redistribution + estado real del VR

**Fecha**: 2026-07-27 · **Rama**: `feat/challenge-card-redistribution` (4 commits, sin pushear)

## Lo que se cerró

| commit | qué |
|---|---|
| `fb6d9f4` | ChallengeCard redistribuida a la gramática de KingdomCard |
| `c08fa48` | sync de `bg-wallpaper-lite` a `apps/landing` — **era un job de CI en rojo** |
| `de674e2` | el spotlight del mini-tour pasa al CTA row |
| `ae47863` | el stat "21 days" se retira al inscribirse |

**Verificado**: suite `5903 passing / 522 files`, exit 0 confirmado (no solo los conteos),
0 `Unhandled Errors`; `tsc --noEmit` limpio; los tres guards de `asset-drift`
(`art:sync-landing:check`, `icons:generate:check`, `theme:coverage`) en verde.
**El founder revisó HUB LEARN en el dispositivo: quedó como se esperaba.**

Spec con las decisiones y lo descartado:
`docs/specs/2026-07-26-challenge-card-redistribution-spec.md`.

## Decisiones de producto tomadas (no volver a discutirlas)

1. **El CTA de Join NO adopta la barra con chevron de `.kingdom-card-pro-cta`.** Ese
   patrón es el *secundario* de PLAY; Join es el único CTA y la conversión de LEARN, y
   dos de sus cuatro estados son texto de estado con skin de CTA, donde un chevron
   promete una navegación inexistente.
2. **"Challenge Badges" no existe** — 0 ocurrencias en el código. No se promete.
3. **El theme va como reveal post-compra, no como viñeta previa.** El Season Pass activo
   SÍ pone LEARN en tier `pro` (`use-effective-theme-tier.ts:62`) y el hub se vuelve
   dorado, pero son 7 slots de identidad (portal, avatar, bordes, chip, anillo):
   **ninguna pieza tiene variante `pro`** y `useOwnedThemes()` sigue en v1 con un solo
   theme. Se reevalúa cuando exista un theme realmente fuerte.
4. **"21 days" se queda en `offer` y se va en `active`.** Es término de venta, no estado.
   Gatearlo (en vez de borrarlo) mantiene a `hub.focus-passport-calendar` con consumidor:
   es el único que tiene, y `theme:coverage` es un job de CI.

## El VR: lo que realmente pasa

**CI no corre Playwright.** Los jobs son `web-tests`, `type-check`, `asset-drift` y
`contract-tests`. Los baselines VR **no ponen rojo el CI** — el pendiente que arrastraba
`SESSION.md` ("regenerar baselines o CI rojo") era falso.

Corrida local: **46 fallan / 13 pasan**. Dos causas, no una:

1. **Config local**: Playwright levanta `pnpm dev` en `:3000` pero la config pública
   acepta `localhost:3002`, así que las fotos salían con el banner
   `DEV: PRO origin mismatch` encima. Se corrige con
   `BASE_URL=http://localhost:3002 PORT=3002 pnpm test:e2e:visual`. **Con eso el banner
   desaparece** — y quedan 46 fallas por la otra causa.
2. **Drift real**: los `vr9`–`vr17` (fixture-driven) fallan por el rediseño del hub
   (fondos, iconos, botón de cerrar). Están haciendo su trabajo; hay que **mirarlas una
   por una** y regenerar. Son ~39 fotos: es un cluster propio.

### El hallazgo importante

`hub-clean — anonymous /hub` **no fotografía el hub**: navega explícitamente a
`/exercises` (línea 76 del spec) y su baseline es la pantalla de juego en modo FULL. El
nombre es heredado y nos hizo razonar mal dos veces en la sesión. **No borrarlo**: es la
única cobertura VR de la pantalla de ejercicios.

Su fragilidad es otra: depende del catálogo vivo. Con la fecha congelada en `2026-05-02`
el baseline dice "Move to h1" y hoy la app dice "Move to h4" ⇒ el catálogo cambió desde
que se sacó la foto. El header del spec lo admite: *"Any future change to DAILY_PUZZLES
that shifts the rotation MUST update this date and re-baseline"*.

**La regla que hay que instalar: el VR nunca debe leer contenido autorado.** El catálogo
va a cambiar seguido por diseño; en cuanto una foto depende de él, el catálogo es dueño
de la suite.

## Próximos pasos, en orden

1. **Refactor `HubLiteScaffold` → `dailySlot: ReactNode`.** Hoy monta `HubDailyTile`
   adentro, y ese llama `useAccount()` de wagmi (`hub-daily-tile.tsx:43`),
   `useIsProActive` y `useWelcomePackage`. El layout de `/dev` no monta WagmiProvider a
   propósito ⇒ un probe de LEARN hoy renderiza un error overlay que Playwright
   fotografiaría feliz (pasó en `0d69e30a`). Es el MISMO refactor que PLAY ya tuvo.
   Call sites: `learn-hub-client.tsx`, `hub-scaffold.tsx`, `exercises-screen.tsx` + tests.
   El docstring del scaffold ya afirma "no data/hooks here" — hoy es falso.
2. **`/dev/learn-hub` + `vr18-learn-hub-*`**, espejando `/dev/play-hub` y su fixture.
   Variantes mínimas: `offer` / `active`. Queda inmune al catálogo por construcción.
3. **`hub-clean` → `exercises-clean`**: renombrar y agregar `mask` de Playwright sobre el
   tablero + la línea de objetivo. Cuesta una sola regeneración, revisable de un vistazo.
4. **Regenerar `vr9`–`vr17`** revisando foto por foto. Cluster aparte.
5. Los baselines de modo FULL se retiran junto con FULL (herramienta interna).

## Abierto

- ¿Los `vr9`–`vr17` se regeneran en bloque o se van revisando por familia?
- El Shop muestra "Coming soon" en vez de precio para Chesscito PRO, y eso rompe
  `hub-shop-sheet-open` **antes** de llegar a la foto (falla un `toContainText("$")`).
  No lo investigué: no sé si es estado esperado hoy o un problema de config local.
