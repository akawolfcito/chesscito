# Sesión 2026-08-07 (cont.) — el split de wallet: implementado, medido y ARBITRADO

> ✅ **RESUELTO.** La duda de la primera mitad de la sesión —dos varas que se contradecían—
> la arbitró el browser: un jugador de MiniPay baja **1.048 kB → 420 kB** de JavaScript hasta
> que el hub es usable (**−60%**) y **0 requests** con código de Privy (antes: 1).
> Informe completo: `docs/audits/2026-08-07-minipay-first-load-report.md`.

**Estado:** `main` = `a480585` (sincronizado con origin) · **11 commits** esta sesión ·
suite **7.432 passing / 603 files** · `tsc --noEmit` limpio · **VR 62/62 sin actualizar
baselines** · guard de bundle verde (75 chunks, 0 rastro de Privy).

## ⛔ Alcance fijado (founder, 2026-08-07)

**La superficie web está cerrada como puerta de entrada de producto. El foco es MiniPay.**
No hay presupuesto, baseline ni criterio de éxito para web, y ninguna diferencia web bloquea
el cierre de este frente. Si algún día se mide, es diagnóstico.

---

## Parte 1 — Lo que entró (11 commits atómicos)

| Commit | Qué |
|---|---|
| `761236a7` | docs: la auditoría de UX en vivo + el spec del lazy load + su red team |
| `e50190e9` | `MountedWalletBranch` + `WALLET_BRANCH_ATTR` (SDD: los tipos primero) |
| `d5e96eed` | `WALLET_LOAD_ERROR_COPY` en EN y ES (guard de traducción 247/247) |
| `a8732ea8` | `WalletBranchErrorBoundary` — estado terminal, clase, con Retry |
| `2c077ab2` | `wagmiConfig` sale del componente a `lib/wallet/wagmi-config.ts` |
| `caf96110` | `data-wallet-branch` renderizado por las **dos** ramas |
| `a27f72cd` | **El lazy**: `React.lazy` + `Suspense` + `WalletShell` |
| `708992b3` | El `eslint-disable` de `attempt` con la razón escrita al lado |
| `e30873d1` | El handoff con las dos varas enfrentadas (superado por la Parte 4) |
| `c7883e5…` | **Guard de bundle** + sello de contenido en `next.config.js` |
| `e4fb8e6c` | **El instrumento de medición** + baseline por worktree + JSON histórico |
| `a480585…` | El informe: `docs/audits/2026-08-07-minipay-first-load-report.md` |

### Herramientas nuevas que quedan en el repo

| Comando | Qué hace |
|---|---|
| `pnpm -C apps/web bundle:guard` | Falla si código de Privy entra al grafo estático de MiniPay. **Exige build fresco por sello de contenido**, no por `mtime`. |
| `pnpm -C apps/web measure:first-load -- --label=X` | Bytes reales hasta que el hub es usable, persona MiniPay. |
| `pnpm -C apps/web measure:first-load:baseline [commit]` | Lo mismo contra un commit viejo, por worktree temporal. |

### Decisiones que quedaron tomadas durante el TDD

1. **`React.lazy`, no `next/dynamic`.** El spec lo dejaba abierto (C2) y el requisito
   mandaba: hacía falta distinguir `loading` de `failed`, y controlar la identidad del loader
   por intento. `next/dynamic` no da ninguna de las dos cosas limpiamente.
2. **El retry se cierra de verdad (C2c).** `useMemo([mounted, attempt])` rearma la identidad
   del lazy, y **el test cuenta invocaciones del loader** (1 → 2 al tocar Retry). No es "el
   botón existe".
   ⚠️ `attempt` es una dependencia que **eslint llama innecesaria** — hay `eslint-disable`
   con la explicación. Si alguien la borra, AC23 se pone rojo, que es el punto.
3. **`display: contents` para el marcador de rama.** El atributo tenía que ir en un nodo que
   sólo existe con esa rama montada, sin tocar layout. Cero riesgo de CLS.
4. **Los `import()` son literales por rama**, nunca un template literal — eso barrería el
   directorio entero al chunk.

### El cambio de SSR es deliberado (AC2 / E1)

Con la rama diferida, **el servidor emite `WalletShell` siempre**, también con la flag
apagada. El test que afirmaba lo contrario **se reescribió con la razón escrita adentro**, no
se borró. ⛔ **En producción no cambia nada**: Privy está encendida en las dos superficies, así
que la rama pre-hidratación ya era `undecided`.

---

## Parte 2 — Cobertura de los AC

**Cerrados y verdes:** AC1 · AC2 · AC3 · AC4 · AC5 · AC6 · AC7 · AC15 · AC16 · AC19 · AC21 ·
AC23 · AC24 · AC25.

### ✅ FRENTE CERRADO — clasificación final

| Eje | Estado | Evidencia |
|---|---|---|
| **Arquitectura / bundling** | ✅ **PASS** | `bundle:guard`: 75 chunks, 0 marcador Privy, 0 `@privy-io` |
| **Correctitud funcional** | ✅ **PASS** | 7.432 passing / 603 files · `tsc` limpio · retry 1→3→éxito · mount-once |
| **Bytes MiniPay** | ✅ **PASS** | T2 1.048,0 → 420,1 kB (−60%) · requests con Privy 1 → 0 · T3 = T2 |
| **VR** | ✅ **PASS** | 62/62 sin actualizar baselines |
| **WalletShell / perceived loading** | ⏸️ **FRENTE SEPARADO** | AC8: `<div>` vacío; T1 +9,7 kB y ~200 ms |

**AC20 — verificado y cerrado.** Era genuinamente distinto de AC23: AC23 prueba que ocurre un
intento nuevo, AC20 exige que el intento que **funciona** deje al jugador dentro de la app y
que el botón sirva más de una vez. El test 1 → 2 **no** lo satisfacía. Ahora hay test propio
(dos fallas, loader 1 → 3, después éxito, la rama monta, el error desaparece, `childMounts`
sigue en 1). Nació verde: faltaba la prueba, no la implementación.

**AC10 — cerrado como NO aplicable**, con razón escrita: exigía que la rama injected tampoco
entrara al grafo, y la rama injected **es** la que MiniPay ejecuta. Criterio simétrico sin
dueño, incompatible con el alcance fijado.

### ⛔ Regla metodológica registrada

> Para performance MiniPay en este repo, **`next build` es diagnóstico, no árbitro**. El
> árbitro son mediciones de browser con persona MiniPay, `encodedDataLength` y milestones de
> producto.

Para el mismo cambio: `next build` dijo −2 kB, el browser dice −628 kB.

---

## Parte 3 — La medición honesta ⚠️ LEER ESTO

Compilé **las dos versiones** (`cd380e7f` y `708992b3`) con el mismo comando. Las dos varas
**no coinciden**, y eso es el hallazgo:

### Vara A — el grafo de chunks (`app-build-manifest`), la que midió el defecto

| Grafo | Antes (`cd380e7f`) | Después (`708992b3`) | Δ |
|---|---|---|---|
| layout solo | 24 chunks · 2.911 kB raw · **859 kB gz** | 10 chunks · 438 kB raw · **126 kB gz** | **−85%** |
| layout + `/[locale]` | 39 chunks · **1.010 kB gz** | 34 chunks · **373 kB gz** | −63% |
| layout + `/terms` | 28 chunks · **880 kB gz** | 14 chunks · **147 kB gz** | −83% |

Y lo cualitativo, que no admite interpretación: **el grafo del layout ya no contiene una sola
referencia a `@privy-io`** (antes: 4 chunks) ni ninguno de los dos `data-wallet-branch`.

### Vara B — la tabla de `next build` (First Load JS)

| Ruta | Antes | Después | Δ |
|---|---|---|---|
| `/[locale]` | 382 kB | 380 kB | **−2 kB** |
| `/[locale]/terms` | 145 kB | 146 kB | **+1 kB** |
| `/[locale]/stats` | 134 kB | 135 kB | +1 kB |
| shared by all | 89,1 kB | 89,4 kB | +0,3 kB |

⛔ **No compenso el informe.** Por la vara B esto no movió nada: décimas, del tamaño del ruido
entre builds. Por la vara A el layout perdió el 85% de su grafo.

### 🔎 El dato que inclina la balanza (y que no esperaba)

**Después del cambio, las dos varas COINCIDEN. Antes, no.**

| | Vara A (unión de chunks) | Vara B (tabla de Next) | Discrepancia |
|---|---|---|---|
| Antes, `/[locale]` | 1.010 kB gz | 382 kB | **2,6×** |
| Antes, `/terms` | 880 kB gz | 145 kB | **6,1×** |
| Después, `/[locale]` | 373 kB gz | 380 kB | ✅ ~1× |
| Después, `/terms` | 147 kB gz | 146 kB | ✅ ~1× |

Es decir: la tabla de `next build` **no estaba atribuyendo al first load** ~700 kB gz que sí
estaban en el grafo de la ruta. Después del split, no queda nada sin atribuir. Eso sugiere que
**la vara B era la que mentía**, no la A — pero es una inferencia, no una medición.

### ✅ El browser arbitró — Parte 4

Instrumento: `pnpm -C apps/web measure:first-load`. Persona MiniPay emulada, caché off por CDP,
`encodedDataLength`, cortes de producto (**nunca `networkidle`**), sobre `next start`. El
baseline lo mide **el mismo script** contra un worktree temporal de `cd380e7f`
(`pnpm measure:first-load:baseline`).

| Corte | Baseline | Actual | Δ |
|---|---|---|---|
| T1 (`main`) | 410,4 kB · 297 ms | 420,1 kB · 501 ms | +9,7 kB |
| **T2 (hub usable)** | **1.048,0 kB** | **420,1 kB** | **−627,9 kB (−60%)** |
| T3 (T2 + 2 s) | 1.058,8 kB | 420,1 kB | −638,7 kB |
| **Requests con Privy** | **1** | **0** | ✅ |

**No son bytes diferidos.** T3 = T2 en el build nuevo: nada llega después de que el hub es
usable. Esa era la pregunta que podía invalidar todo el frente, y quedó respondida con datos.

⚠️ Y lo que empeoró, sin maquillar: **T1 sube** y la ventana en blanco es real, porque
`WalletShell` sigue vacío. Además esto se midió en `localhost`, sin latencia: en la red de
MiniPay el salto extra cuesta más tiempo (los 628 kB de ahorro no se mueven).

**Sobre la vara vieja:** `next build` reportó −2 kB para el mismo cambio. En este repo **no
sirve como árbitro de performance** — queda escrito en el informe y en memoria.

---

---

## Parte 5 — Frente nuevo: carga percibida de MiniPay (MEDIDO, sin implementar)

Informe: `docs/audits/2026-08-07-minipay-perceived-load-report.md`.
El instrumento ahora mide FCP, LCP, CLS **con los nodos que se mueven**, long tasks, TBT
aproximado, y saca filmstrip. Perfil Slow 4G + CPU 4×.

| | Sin throttling | Slow 4G + CPU 4× |
|---|---|---|
| FCP / LCP | 572 / 572 ms | **~3.980 / ~4.410 ms** |
| T2 (hub usable) | 1.003 ms | **~4.150 ms** |
| CLS | 0,0000 | **0,000 ó 0,179 (bimodal)** |
| Long tasks | 0 | 3–5, máx 65–127 ms, **todas antes de FCP** |

**La ventana en blanco dura ~4 s** y el filmstrip muestra azul plano `#0b1220` sin esqueleto
hasta que el hub aparece entero a los 4,66 s.

⛔ **Dos correcciones a la lectura de Lighthouse:**

1. **CLS 0,179 NO es el WalletShell.** Ocurre a ~4.150 ms, **después** de que el hub montó, en
   `section.hub-scaffold-body` + `div.kingdom-anchor-tagline`. Frente separado — mezclarlo con
   el shell haría que ninguna mejora sea atribuible.
2. **El landmark `<main>` no falta: sobra.** Hay **dos, uno anidado**, en las dos personas. Lo
   que ve Lighthouse es artefacto de la persona web con Privy, donde `<main>` vive dentro de
   `WebAccessGate` y no se renderiza sin autenticar.

⛔ **El viewport sin zoom no se toca.** La dependencia de gesto existe y está documentada en
`layout.tsx:99-123` (drag-to-move vs pinch, doble-tap de iOS) con su mitigación de
accesibilidad (zoom del OS). La condición que habilitaba cambiarlo no se cumple.

⚠️ **El instrumento casi miente y quedó blindado.** `addInitScript(fn)` serializa
`fn.toString()`; tsx/esbuild inyecta `__name(...)`, que en la página no existe → el init moría
antes de registrar un observer y la corrida reportaba `FCP n/a · LCP n/a · CLS 0 · 0 long
tasks` para una página que había pintado a 576 ms. Ahora el init va como **string**, hay
cross-check contra `getEntriesByType("paint")` que **aborta**, y un listener de `pageerror`.

## Next steps

1. **Spec de AC8 / `WalletShell`** — está demostrado que es relevante (~4 s de pantalla vacía,
   y es lo que define FCP/LCP). ⚠️ Falta **una decisión de producto**: qué muestra el shell.
2. **CLS 0,179** — frente separado, con el nodo ya identificado.
3. **`<main>` anidado** — commit chico y semántico.
4. **CSS render-blocking bajo MiniPay** — todavía sin medir. Se mide antes de decidir nada.
5. **AC20** ✅ cerrado.
6. **Opcional, barato:** correr el script contra `preview`/`learn-preview` para el número con
   red real. Diagnóstico, no gate.

## Open questions (heredadas, siguen abiertas)

- **`ssr: true` en `wagmiConfig` + rama diferida** — la autoconexión de MiniPay
  (`WalletProviderInner`, `useEffect`) ahora corre un tick más tarde. Invisible en tests,
  visible en el device.
- **Telemetría del `componentDidCatch`** — sigue siendo sólo consola. Si el chunk falla en el
  device de un jugador real, no nos enteramos. Es decisión, no olvido.
- **Staleness del guard de bundle** — por `mtime` no; hace falta un sello de contenido.

## Notas

- Los tests dejan un stack de React en consola (el throw provocado a propósito). Ruido
  esperado.
- ⚠️ **Este repo no usa Prettier** (no hay config ni dependencia). Correrlo reformatea
  archivos enteros con otro ancho de línea. Ya lo hice una vez y tuve que revertir.
