# Session Handoff — 2026-07-13 (c)

> Tercera sesión del día. Las dos anteriores (matchup transition `ef2b0ae3`, player rails
> `c6b6755c`) quedan resumidas en sus commits; sus tareas abiertas se cerraron acá.

## Completed

**Orden de trabajo acordado con el founder: limpieza → duelo por enlace → Belt System.**

- `7b963843` **refactor(arena): `ArenaPlayerRail` recibe PRO por prop**, ya no por hook.
  Llamaba `useIsProActive()` adentro → wagmi → **no se podía montar sin `WagmiProvider`**, que
  es justo lo que el layout `/dev` NO monta. Por eso los rails eran la única superficie que el
  VR no podía fotografiar. La página de arena ahora hace la única lectura de wallet.
- `0d69e30a` **test(vr): 5 baselines `vr16` para los rails** (probe `/dev/arena-rails`).
  Cierra el agujero: **ningún baseline llegaba a un `PlayerAvatar`**, y por eso `c63b34fc`
  (border-radius) viajó con los 5107 tests en verde.
- `90858eb0` **spec + red-team de server-verified progress** → **NEEDS REVISION (2 P0)**. Ver
  Blockers.
- `fc4b1029` **feasibility del duelo asíncrono por enlace** → **~2–3 días, no meses**.
- `1f039642` **PLAY #8 — borrada la confirmación de LUZ.** Tocar Ask Coach analiza directo.
  −344 líneas: `LuzOnboardingPanel`, `onboarding-outcome.ts`, fase `welcome`, `claimWelcome()`,
  `COACH_ONBOARDING_COPY` y la bandera `chesscito:coach-welcomed`.
- `aa03de17` **`ONLY_TEST_NO_FUNDS_PK` documentada** (nombre + placeholder; valor solo en `.env`).
- `a7683a8c` **fix: "Claim 3 Shields" reclama en el lugar**, ya no abre el Shop.

**Fuera del repo:**
- **Contraste en device: FIRMADO** por el founder (transición + rails). El `text-shadow` alcanza.
- **Issues #101 y #67 CERRADOS** como muertos, con su razón escrita en el issue.

## Current State

- **Branch**: `main` (commiteado directo, sin PR). **PRs abiertos**: ninguno.
- **Build**: Vitest **5089 passing / 425 files** · `tsc --noEmit` limpio · lint sin nada nuevo ·
  VR minipay **55 passed / 1 failed** (el rojo es `hub-shop-sheet-open`, preexistente).
- **Uncommitted work**: sólo este `SESSION.md`.

## Next Tasks

### Terminar la limpieza (nada de esto toca la espina)
1. **Decoder de custom errors** — hoy `BadgeAlreadyClaimed`, `CooldownActive` y
   `DailyLimitReached` salen los tres como "Try again". El extractor ya está escrito; falta el
   generador de error-ABIs desde `artifacts/` y el mapa nombre → copy.
   Doc: `docs/backlog/2026-07-10-custom-errors-decoder.md`.
2. **Cobertura VR del play hub** — `hub-clean — anonymous /hub` (`visual-regression.spec.ts:73`)
   en realidad navega a `/exercises`: el hub home nunca tuvo baseline. La receta quedó fresca
   (probe `/dev/*` + fixture presentacional).
3. **Destino de `WoodenBanner`** — conservado a propósito por el founder, pero sin consumidor. O
   se le encuentra superficie, o se retira con sus 3 assets.

### Después de la limpieza
4. **Duelo asíncrono por enlace** (`docs/product/2026-07-13-async-link-duel-feasibility.md`).
   **Empezar por un spec**, no por código: los riesgos son de producto, no técnicos.
5. **Belt System** — el GDD, o como mínimo **la decisión del umbral**. Es lo único con reloj.

## Blockers

- **El spec de server-verified progress NO va a `/tdd`.** El red-team encontró que su premisa
  es falsa (ver Notes). Necesita una **decisión de producto** del founder antes de tocar código:
  ¿(a) defensa en profundidad + passport para el payout, (b) challenge token del servidor, o
  ambas? Hasta entonces, **no tocar `BADGE_THRESHOLD` ni el progreso verificado**.

## Notes

### El hallazgo que invalida el spec (P0)

`exercise-bfs.ts` exporta **`computeExerciseBfsPath()`**, que devuelve el **camino óptimo
completo** — y viaja en el bundle del cliente, junto con el catálogo. Un atacante llama a la
propia función de la app, POSTea el camino perfecto de cada ejercicio, y el servidor lo
re-ejecuta, lo encuentra legal y óptimo, y firma. Toma un segundo.

**Re-ejecutar prueba que la solución es CORRECTA, nunca que un humano la JUGÓ.** Shippearlo
creyendo que cierra el agujero es peor que hoy: el score falso pasaría a llevar la firma del
servidor y una fila en una tabla llamada `exercise_progress`, que a los ojos de cualquiera
parece evidencia. Segundo P0: el día del deploy, todo jugador honesto con 10★ locales sin
mintear se come un 403 diciéndole "Finish 10★" — que ya hizo. Necesita shadow mode.

**`passport_cache.is_verified` YA existe en el schema** y el leaderboard ya lo joinea: es el
ancla de identidad más barata que tenemos si el payout necesita protección.

### El VR miente de dos maneras distintas (las dos vistas HOY)

1. **Puede fotografiar un error.** Los primeros 5 baselines de los rails salieron "5 passed" y
   eran capturas del *Unhandled Runtime Error* de Next (`WagmiProviderNotFoundError`).
   Playwright escribe el PNG de lo que haya en pantalla y pasa. **Mirar siempre los baselines
   nuevos.**
2. **Es ciego a cambios de copy chicos.** `maxDiffPixelRatio: 0.01`; una línea de footer es
   ~0,45% de los píxeles. Cambié la copy y el test siguió verde con el baseline mintiendo. Y
   **`--update-snapshots` NO lo arregla**: su default es `changed`, o sea que sólo reescribe si
   el test **falla**. Hay que forzar **`--update-snapshots=all`** y verificar el **`mtime`** del
   PNG, no el exit code.

**Regla derivada:** un componente que va a tener probe `/dev` **recibe su verdad por props**
(convención `HubProBadge`), nunca de un hook de wallet.

### Sobre el bug de "Claim 3 Shields"

La causa raíz es una trampa de tipos que vale recordar: `use-fail-rescue` declaraba
`onOpenShop: (focus: "welcome-pack") => void` y `exercises-screen` implementaba `() => void`.
**TypeScript acepta la firma más angosta**, así que el argumento se tiraba en silencio y el
deep-link nunca tuvo destino. El compilador no puede protegerte de esto: buscalo a mano cuando
un callback "no hace lo que dice".

### Arrastrado (sigue vigente)

- **Dónde vive cada hub**: el LEARN hub sólo renderiza en `/` con `NEXT_PUBLIC_CHESSCITO_MODE=learn`
  **y** `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`; con sólo el primero, el flag lanza
  "Contradictory Chesscito mode flags".
- Para verificar visualmente: dev en un puerto propio + Playwright con `BASE_URL=http://localhost:<port>`.
- **NO mover el timer de la transición fuera de su `useEffect`** (Strict Mode lo cuelga en
  "Preparing AI…" para siempre).
- La **transición de matchup queda deliberadamente SIN VR** (decisión del founder): es toda
  timers + animación y no paga el costo de congelar el reloj.
