# Sesión 2026-08-07 (cont.) — el split de wallet, implementado y medido

> 📌 **Lo que se construyó está cerrado y verde. Lo que NO está cerrado es si sirve.**
> Las dos varas de medir dan respuestas distintas y la sesión termina sin arbitrarlas.
> Ver «Parte 3 — la medición honesta»: es lo primero que hay que resolver.

**Estado:** `main` local = `708992b3` · **8 commits nuevos** esta sesión, **30 sin pushear**
en total · suite **7414 passing / 601 files** · `pnpm exec tsc --noEmit` limpio en `apps/web`
· `next build` compila sin errores ni warnings nuevos.

---

## Parte 1 — Lo que entró (8 commits atómicos)

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

**Abiertos:**

- **AC8** — `WalletShell` NO ocupa el espacio final: sigue siendo `<div>` vacío. Y ahora la
  espera **incluye una ida a la red**, así que la ventana en blanco se alarga de verdad. Es la
  open question E7 y subió de prioridad.
- **AC9–AC14** — el guard de bundle **no está automatizado**. Lo verifiqué a mano (ver abajo).
- **AC17** — **el VR no se corrió.** Aplica entera la política fijada la sesión pasada.
- **AC20** — el retry se ejerce una vez en test; falta el caso "el segundo intento resuelve y
  la rama monta".

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

### ⛔ Lo primero de la próxima sesión: que arbitre el browser

Ninguna de las dos varas es la verdad. La verdad es **cuántos bytes de JS baja un device
antes de ser interactivo**. Se mide con Playwright/CDP contando `response.body()` de los `.js`
hasta `networkidle`, en las dos versiones, en `/[locale]` y en `/terms`.

⚠️ Y hay una pregunta que la medición debe responder explícitamente: **la rama se descarga
igual, un tick después**. El ahorro real sólo existe si el jugador de MiniPay nunca baja el
chunk de Privy — no porque el primer load sea más chico.

---

## Next steps

1. **La medición del browser** (arriba). Sin eso, no se decide si esto se mergea, se ajusta o
   se revierte.
2. **AC8 / E7** — decidir el contenido de `WalletShell` **midiendo**: sólo si no mete descarga
   nueva en el camino crítico y mantiene CLS 0. Si no, se queda el `<div>`.
3. **Guard de bundle (AC9–AC14)** — automatizar lo que verifiqué a mano. ⚠️ Debe excluirse de
   `pnpm test` explícitamente, o corre sin build sobre un `.next` viejo.
4. **VR 62/62** con la política de la sesión pasada, sin `--update-snapshots`.
5. **AC20** — el caso "el segundo intento resuelve".

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
