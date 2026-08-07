# Spec — wallet-branch-lazy-load

**Date**: 2026-08-07
**Status**: draft
**Origen**: `docs/audits/2026-08-06-live-ux-findings.md` §5

## Problem

`components/wallet-provider-boundary.tsx` importa **estáticamente** las dos ramas de wallet
(líneas 6–7). El componente monta **exactamente una** en runtime —esa es toda su razón de
existir— pero el bundler no puede saberlo, así que empaqueta las dos en el chunk del **root
layout**.

Medido el 2026-08-06 (`app-build-manifest.json`):

```
/[locale]/page            -> (ninguno de los chunks grandes)
/[locale]/exercises/page  -> (ninguno)
/[locale]/layout          -> 7a7377a5-…js (708 KB) | 1515-…js (1,49 MB)
```

**2,2 MB sin comprimir en toda ruta del app**, incluidas `/stats`, `/about`, `/terms` y las
páginas de share. Lighthouse lo reporta como *"Reduce unused JavaScript — 981 KiB"*, con
main-thread 2,6 s y un LCP de 18 s cuyo elemento es un `<h1>` de **texto plano** con
*render delay* de 2.670 ms: no espera la red, espera que corra JS.

El costo cae sobre quien menos lo merece: un jugador de **MiniPay** toma la rama `injected`
y **nunca monta Privy**, pero igual se baja el chunk entero de Privy. Paga por código que en
su sesión no se ejecuta jamás.

⛔ **Privy está ENCENDIDO en producción en los dos proyectos** (`chesscito` y
`lite-chesscito`, verificado por render con Playwright el 2026-08-06). Ninguna de las dos
ramas es código muerto, así que **borrar una no es una opción**: el fix tiene que ser
code-splitting real.

## Experimentos previos (2026-08-07) — los dos P0 de medición, resueltos

### EXP1 ✅ — El manifest **NO** enumera los chunks diferidos. La estrategia del guard vive.

⛔ No hizo falta espolón: **`learn-hub-client.tsx` ya usa `next/dynamic`** con `ssr: false`
para cinco componentes (`badge-sheet`, `shop-sheet`, `purchase-confirm-sheet`, `pro-sheet`,
`hub-tour`). El build actual ya es el experimento.

Buscando el símbolo `ShopSheet` en **todos** los chunks del build y cruzando contra
`app-build-manifest.json`:

```
probe "ShopSheet"  -> vive en 2 chunks | en la entrada PAGE: 0 | en cualquier entrada: 1
```

**Cero.** Un componente cargado con `dynamic(..., { ssr: false })` **no aparece** bajo la
entrada de su ruta en el manifest. ✅ AC9–AC10 son alcanzables y el guard puede leer el
manifest como fuente de verdad.

⚠️ **Trampa medida, para el que escriba el guard:** los probes `"hub-tour"` y
`"shop-slot-frame"` **sí** dieron 1 hit en la entrada PAGE. No es el chunk diferido: es el
**string** (una ruta de asset, la referencia del import) viviendo en un chunk estático. ⛔ Un
guard que busque nombres de archivo o rutas va a dar **falso positivo**. Tiene que buscar
evidencia de **código de la rama**, no de su nombre.

### EXP2 ⚠️ — El hub mejora, pero **menos** de lo que promete el título del frente

`/[locale]` hereda del layout **24 archivos / 3,30 MB**; sus chunks propios suman apenas
**498 KB en 15 archivos**. O sea: el peso del hub es **el layout**, no la página. Eso está
a favor del fix.

Pero al mirar qué hay en cada chunk del layout:

| Chunk | Tamaño | Privy | WalletConnect | viem |
|---|---|---|---|---|
| `1515-…js` | **1.456 KB** | ✅ | ✅ | ✅ |
| `7a7377a5-…js` | **691 KB** | — | ✅ | — |
| `4675-…js` | 17 KB | — | — | ✅ |
| `app/[locale]/layout-…js` | 13 KB | ✅ | — | — |

⛔ **`1515` es un chunk MEZCLADO**: tiene las dependencias de las dos ramas fundidas. Y —el
dato que importa— los chunks propios de la página tienen **cero** hits de `viem`,
`walletconnect` o `@privy-io`: claims no trae su propia copia, **reusa la del layout**.

**Conclusión honesta, sin maquillar:**

- ✅ El jugador de MiniPay en el hub **deja de bajar la rama Privy**: los 691 KB de
  `7a7377a5` (WalletConnect sin viem) y la porción Privy-exclusiva de `1515`.
- ⛔ **NO deja de bajar `wagmi`/`viem`.** `lib/claims/sources.ts` los necesita de verdad
  (`readContract(wagmiConfig, …)`) y hoy los toma prestados del layout. Después del split,
  esa parte **sigue** en el grafo del hub — se mueve de chunk, no desaparece.
- ⚠️ **El número exacto no se puede predecir sin implementar**, porque webpack re-particiona
  `1515` al romper el import estático. Cualquier cifra que dé ahora sería inventada.

**Lectura para el founder:** el split **sí** ataca la lentitud del hub, pero se lleva la
rama Privy, no el stack de wallet entero. Las rutas secundarias (`/stats`, `/about`,
`/terms`, share) mejoran **más** que el hub, porque ésas no necesitan wagmi para nada. ⛔ Si
al medir el hub mejora poco, **eso se reporta como es** y se abre el frente siguiente (sacar
wagmi del camino crítico del hub), no se compensa el informe con el número de `/terms`.

## Goal

Que cada visitante baje **una sola** rama de wallet: MiniPay nunca paga Privy, y la web
nunca paga la rama injected.

## Non-goals

- ⛔ **La barrida general del root layout.** Este spec toca sólo la separación necesaria para
  el split simétrico. Todo otro peso del layout es otro frente (decisión del founder).
- ⛔ Apagar Privy en alguna superficie. Es una pregunta de producto, no de bundling.
- ⛔ Tocar imágenes: el pipeline AVIF/WebP ya funciona (16 KB servidos donde el PNG pesa 890).
- ⛔ El cold start de `/en` (23 s de TTFB en un 307). Medición aparte.
- ⛔ Los 77 KiB de CSS sin usar. `globals.css` es monolítico por diseño.
- ⛔ Cambiar `resolveWalletBranch`. Su lógica es correcta y queda intacta.

## Contracts (SDD)

### C1. `wagmiConfig` se muda a un módulo neutral

Hoy vive en `components/wallet-provider.tsx:18`, **el mismo módulo que el componente**. Eso
lo vuelve inseparable: `lib/claims/sources.ts:5` importa `wagmiConfig` y con él arrastra
`WalletProvider`, `ChainConfigWarning` y `ProductContextProviders` de vuelta al grafo del
app — y `sources.ts` es alcanzable desde el árbol vía `hooks/use-claim-queue.ts:3`.

📌 **Un config compartido NO es el problema.** Lo que debe separarse son las
**implementaciones de provider y sus dependencias exclusivas**. `wagmiConfig` puede seguir
siendo compartido si las dos superficies realmente lo necesitan; sólo tiene que dejar de
vivir pegado al componente.

```ts
// NUEVO — src/lib/wallet/wagmi-config.ts
// Sin JSX, sin componentes, sin providers. Sólo la config.
import { createConfig, http } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected()],
  transports: { [celo.id]: http(), [celoSepolia.id]: http() },
  ssr: true,
});
```

Importadores a reapuntar (los dos únicos fuera de tests):

| Archivo | Línea | Hoy | Pasa a |
|---|---|---|---|
| `lib/claims/sources.ts` | 5 | `@/components/wallet-provider` | `@/lib/wallet/wagmi-config` |
| `test-utils/render-with-app-providers.tsx` | 9 | ídem | ídem |

⛔ **NO se re-exporta `wagmiConfig` desde `wallet-provider.tsx`** (decisión del founder,
2026-08-07). Un re-export es un arma cargada: importar desde el componente **seguiría
arrastrándolo**, sin que falle nada y viéndose idéntico en el diff — la reintroducción exacta
del bug, por una puerta que habríamos dejado abierta nosotros. Se actualizan los dos
importadores y punto. **Importar `wagmiConfig` desde el componente debe volverse imposible
por diseño**, no desaconsejado por comentario.

### C2. Las dos ramas se cargan diferidas

```ts
// src/components/wallet-provider-boundary.tsx
import dynamic from "next/dynamic";

type BranchProps = { children: ReactNode };

/** `ssr: false` es OBLIGATORIO en las dos: la rama sólo se conoce después de
 *  hidratar (`isMiniPayEnv()` lee `window`), así que renderizarlas en el
 *  servidor es imposible por construcción, no una optimización. */
const LazyWalletProvider = dynamic<BranchProps>(
  () => import("@/components/wallet-provider").then((m) => m.WalletProvider),
  { ssr: false, loading: WalletShell },
);

const LazyWebWalletProvider = dynamic<BranchProps>(
  () => import("@/components/web-wallet-provider").then((m) => m.WebWalletProvider),
  { ssr: false, loading: WalletShell },
);
```

⛔ **Este bloque es una PREFERENCIA, no el contrato.** El contrato es E3: hay que poder
distinguir `loading` de `failed`. Si `next/dynamic` no expone ese estado de forma limpia
—y su API de `loading` **no** distingue "cargando" de "falló"— se reemplaza por
`React.lazy` + `<Suspense>` + error boundary de clase. **La forma la decide el requisito
durante el TDD**, no este spec.

### C2b. El error boundary de rama (E3)

⛔ **Descartado `BranchLoadState = "loading" | "failed" | "mounted"`** (founder, 2026-08-07).
El error boundary posee de forma fiable **sólo** el estado terminal `failed`: `loading` es de
`Suspense` y `mounted` es del componente lazy. Modelar los tres dentro de la clase obligaría
a **duplicar la máquina de estados de React** o a inventar callbacks artificiales.

```ts
// src/components/wallet-branch-error-boundary.tsx
type WalletBranchErrorBoundaryState = { failed: boolean };

/** Class component, no función: es el ÚNICO que captura errores de render.
 *  Cubre las dos rutas de falla — el rechazo del lazy import Y el throw de
 *  `requirePrivyAppId()` al montar (AC21). */
export class WalletBranchErrorBoundary extends Component<
  {
    children: ReactNode;
    /** Recovery provisto por el owner. Debe provocar un intento nuevo
     *  observable (C2c). */
    onRetry: () => void;
  },
  WalletBranchErrorBoundaryState
> {}
```

**Composición y dueño de cada estado:**

```
WalletProviderBoundary
├─ undecided ──────────► WalletShell
└─ rama decidida ──────► WalletBranchErrorBoundary
                          └─ <Suspense fallback={<WalletShell />}>
                               └─ lazy provider
```

| Estado | Dueño |
|---|---|
| `undecided` | `WalletProviderBoundary` |
| chunk esperando | `Suspense` |
| error de import **o de render** | `WalletBranchErrorBoundary` |
| `mounted` | la propia rama |

⚠️ **Nombre de archivo: `wallet-branch-error-boundary.tsx`**, para no confundirlo con
`wallet-provider-boundary.tsx`, que es otra cosa y está al lado.

### C2c. El retry tiene que producir un intento NUEVO, observable

⛔ **Vetado: volver a llamar al mismo `import()`.** Tanto webpack como `React.lazy`
**memorizan la promesa rechazada**, así que el segundo intento devuelve el mismo error **sin
tocar la red**. Un botón "Retry" que hace eso **miente**, y es peor que no tenerlo.

El contrato: *el retry DEBE crear una identidad de loader/chunk request nueva, o recargar la
página.* Orden de preferencia (founder, 2026-08-07):

1. **Mecanismo local comprobable** que emita un intento nuevo de verdad. La forma concreta la
   decide el TDD — candidatos: un contador en el estado usado como `key` que **remonta** el
   boundary con una factory nueva, o construir el loader por intento en vez de a nivel de
   módulo. ⚠️ El criterio no es que compile: es que el test **observe una segunda solicitud**.
2. **`window.location.reload()`** como retry explícito, si (1) ensucia demasiado la frontera.

📌 **Preferimos el reload antes que un "Retry" decorativo.** Recargar es honesto; un botón que
recibe la misma Promise rechazada no lo es.

⚠️ AC20 no se satisface con "el botón existe y no rompe". Exige **evidencia de un intento
nuevo**: contar invocaciones del loader, o el `reload` espiado.

### C2d. Copy del error de carga — i18n obligatorio

⛔ **Nada de strings hardcodeados en JSX.** La UI es EN + ES por next-intl y hay un guard de
traducción sobre **todo** el bundle. Un string suelto no pasa, y agregarlo de un solo lado
hace que el bundle ES imprima el path crudo (el spread de nivel superior **no** es un deep
merge).

Namespace nuevo en `lib/content/editorial.ts`, siguiendo la convención vigente
(`SCREAMING_SNAKE_COPY`, consumido con `useTranslations("…")`):

```ts
export const WALLET_LOAD_ERROR_COPY = {
  title: "…",
  body: "…",
  retry: "…",
} as const;
```

| Clave | EN | ES |
|---|---|---|
| `title` | `Wallet couldn't load` | `No se pudo cargar la wallet` |
| `body` | `Check your connection and try again.` | `Revisa tu conexión e inténtalo de nuevo.` |
| `retry` | `Retry` | `Reintentar` |

⚠️ Las tres claves van a **`messages/en.ts` y `messages/es.ts`**, y quedan cubiertas por el
guard de i18n. Sin excepciones en la lista de exentas.

### C3. El shell pasa a ser un componente con contrato

```ts
/** El hueco estable que ocupan (a) `undecided` y (b) la espera del chunk.
 *  DEBE ocupar desde el primer render exactamente el espacio final de la
 *  ventana. CLS hoy es 0 y es un invariante a proteger. */
export function WalletShell(): JSX.Element;
```

### C4. Evidencia **load-bearing**, no constantes centinela

⛔ **Descartadas las constantes `*_BRANCH_MARKER`** (P0 del red team, confirmado por el
founder). Un `export const` que no importa nadie es exactamente lo que webpack + Terser
eliminan: el guard daría **verde porque el string no está**, no porque la rama no esté. Un
test que falla hacia el verde es peor que ninguno.

El guard busca strings que **el producto ya necesita** y que no se pueden borrar sin romper
la rama:

✅ **RESUELTO (founder, 2026-08-07).** Cada rama renderiza un atributo de DOM que la
identifica, en un nodo que **sólo existe cuando esa rama monta**:

```tsx
// wallet-provider.tsx      → <div data-wallet-branch="injected"> … </div>
// web-wallet-provider.tsx  → <div data-wallet-branch="privy">    … </div>
```

| Rama | Evidencia en el bundle | Por qué es load-bearing |
|---|---|---|
| **injected** | `data-wallet-branch="injected"` | Es **comportamiento observable**: AC6 (un solo provider) y AC4/AC5 asertan sobre él. Borrarlo pone tests en rojo, no sólo el guard. Y como es un atributo JSX, el literal viaja al chunk **de esa rama** y sobrevive a la minificación. |
| **Privy** | `data-wallet-branch="privy"` | Ídem. **Reemplaza al literal del `throw`** como firma primaria: ese mensaje es incidental al bundle (podría reescribirse en un refactor de copy sin que nadie note que rompió el guard). |
| **Privy (respaldo)** | `@privy-io` en rutas de módulo | Verificado presente hoy en 2 chunks del layout. Sólo como confirmación cruzada. |

📌 **Por qué esto sí y una constante no:** una constante exportada que nadie importa se
tree-shakea y el guard queda verde por ausencia. Un atributo que el componente **renderiza**
no puede desaparecer sin cambiar el DOM — y el DOM está aserido por los tests de
comportamiento. La evidencia del bundle y la del comportamiento pasan a ser **la misma cosa**.

⚠️ **Y una trampa medida en EXP1:** buscar el *nombre* del módulo o del archivo da falsos
positivos — `"hub-tour"` aparece en la entrada PAGE aunque su chunk sea diferido, porque el
string vive en un chunk estático. El guard busca **código vivo**, nunca nombres de
componentes ni strings incidentales.


## Behavior

1. **Dado** `privyEnabled = false`, **cuando** renderiza el boundary, **entonces** resuelve
   `injected` y monta `LazyWalletProvider`. ⚠️ **Cambio de comportamiento**: hoy con la flag
   apagada el SSR ya emite `WalletProvider`; con `ssr: false` el SSR emite `WalletShell` y la
   rama llega tras hidratar. (Ver Edge case E1.)
2. **Dado** `privyEnabled = true` y no hidratado, **entonces** `undecided` → `WalletShell`,
   sin montar ninguna rama y **sin disparar ninguno de los dos `import()`**.
3. **Dado** `privyEnabled = true`, hidratado e `isMiniPay = true`, **entonces** monta
   `LazyWalletProvider` y **nunca** solicita el chunk de Privy.
4. **Dado** `privyEnabled = true`, hidratado e `isMiniPay = false`, **entonces** monta
   `LazyWebWalletProvider` y **nunca** solicita el chunk injected.
5. **Mientras** el chunk viaja, el boundary renderiza `WalletShell` y **ningún** provider.
6. **Cuando** el chunk llega, la rama monta **una sola vez**. No hay doble montaje de wagmi
   ni remonte del árbol de `children`.
7. El grafo de `/[locale]/layout` **no** incluye los chunks exclusivos de ninguna de las dos
   ramas.

## Edge cases

- **E1 — El SSR cambia con la flag apagada.** Hoy `resolveWalletBranch` devuelve `injected`
  **antes** de hidratar cuando `privyEnabled = false`, y el test existente
  (`wallet-provider-boundary.test.tsx`) afirma que en ese caso el HTML de SSR **no** contiene
  `data-wallet-shell`. Con `ssr: false` esa afirmación deja de ser cierta. ⛔ **Ese test hay
  que reescribirlo, no borrarlo** — y el spec debe declarar que el cambio es deliberado.
  En producción no afecta a nadie: la flag está encendida en las dos superficies, así que la
  rama pre-hidratación ya era `undecided`.
- **E2 — Flash en blanco más largo.** La ventana de `undecided` ahora incluye una ida a la
  red. `WalletShell` debe ocupar el espacio final desde el primer render.
- **E3 — Falla la carga del chunk** (red caída, deploy rotado a mitad de sesión). Hoy no
  existe ese modo de falla: **lo estamos creando**, y justamente en la peor red, que es la de
  MiniPay. ✅ **DECIDIDO (founder, 2026-08-07): error boundary propio para la carga de la
  rama, con salida visible y retry explícito. Nunca splash infinito.**
  - UI mínima: **mensaje corto + botón "Retry"**. Sin arte nuevo, sin animación, sin
    telemetría en este spec.
  - El boundary debe distinguir **tres** estados, no dos: `loading` (el chunk viaja),
    `failed` (terminal, con retry) y `mounted`. Un `loading` que nunca termina **no** es un
    estado válido.
  - ⚠️ **Si `next/dynamic` no permite distinguir limpiamente `loading` de `failed`**, se usa
    `React.lazy` + `<Suspense>` + un error boundary de clase, o la mínima abstracción que
    haga falta. **El requisito manda sobre la herramienta**; `next/dynamic` es una
    preferencia, no una restricción.
  - ⚠️ Alcanza también al throw de `requirePrivyAppId()`: con carga diferida ese error pasa
    a ocurrir **después** de hidratar, dentro del boundary. Sin este error boundary, un app
    id faltante pasaría de "página rota al instante" a "splash eterno" — el mismo E3 con
    otra ropa.
- **E4 — Doble montaje.** `queryClient` y `wagmiConfig` son singletons de módulo; el
  `import()` los crea una vez. Pero si `WalletShell` y la rama montan en posiciones distintas
  del árbol, React desmonta y remonta `children` — exactamente lo que este archivo existe
  para evitar.
- **E5 — Mocks de tests.** El test actual usa `vi.mock` sobre los dos módulos y asserts
  **síncronos**. Con `import()` los asserts pasan a ser asíncronos (`findBy*`).
- **E6 — `/dev/*` importa `WalletProvider` estáticamente** (6 páginas: `sign-probe`,
  `permit-probe`, `rail-smoke`, `chesito-card`, `minipay-no-approve-poc`, `tx-error-probe`).
  Son rutas propias, fuera del layout compartido — **no** son una fuga y no se tocan.
- **E7 — El asset del splash.** Reusar `redesign/bg/splash-loading` **sólo si** ya está
  disponible sin meter una descarga nueva relevante en el camino crítico y sin romper
  CLS = 0. ⛔ Si al verificar exige una descarga extra o entra por una cadena pesada del
  theme resolver, **fallback automático** al `<div data-wallet-shell="undecided" />` actual.
  No se abre otro frente de optimización para resolverlo.

## Acceptance criteria

> ✅ **FRENTE CERRADO — 2026-08-07.** Evidencia:
> `docs/audits/2026-08-07-minipay-first-load-report.md`.
> Estado por eje: **arquitectura/bundling PASS · correctitud funcional PASS · bytes MiniPay
> PASS · VR PASS**. Único pendiente, movido a frente separado: **AC8 (`WalletShell`)**.

**Comportamiento** (unit, corren en la suite normal)

- [x] AC1 — Flag OFF + hidratado → monta la rama injected.
- [x] AC2 — Flag OFF + SSR → emite `WalletShell`, no un provider. (Reescribe el test de E1.)
- [x] AC3 — Flag ON + no hidratado → `WalletShell`, y **ningún** `import()` disparado.
- [x] AC4 — Flag ON + MiniPay → monta injected; el `import()` de Privy **nunca** se llama.
- [x] AC5 — Flag ON + web → monta Privy; el `import()` de injected **nunca** se llama.
- [x] AC6 — Exactamente **un** provider en el árbol en todo momento (nunca dos, nunca cero
      tras resolver).
- [x] AC7 — `children` monta **exactamente una vez** en toda la transición
      `undecided → shell → rama`. ⚠️ Reformulado tras el red team: la versión anterior decía
      "no se remonta al llegar el chunk", que **pasa siempre** porque `children` nunca montó
      antes — un AC infalsificable. Se cuenta con un hijo instrumentado, no por DOM.
- [ ] **AC8 — ABIERTO, MOVIDO A FRENTE SEPARADO.** `WalletShell` sigue siendo un `<div>`
      vacío, y la espera ahora incluye una ida a la red. Es el **único costo** que dejó este
      cambio: medido, T1 sube 9,7 kB y ~200 ms en localhost (en la red de MiniPay, más).
      ⛔ No se resuelve acá — necesita su propia medición bajo persona MiniPay y su propio
      spec, o se mezcla con este resultado y ninguna mejora queda atribuible.
- [x] AC19 — **E3**: si el `import()` rechaza, el árbol muestra el mensaje + "Retry" y **no**
      se queda en `loading`. Se testea forzando el rechazo del import.
- [x] AC20 — **E3**: tocar "Retry" reintenta el import; si el segundo intento resuelve, la
      rama monta normalmente. El retry debe poder ejercerse **más de una vez**.
      ⚠️ **AC20 ≠ AC23, y se verificó que no lo eran.** AC23 prueba que ocurre un intento
      nuevo; AC20 exige que el intento que **funciona** deje al jugador dentro de la app, y que
      el botón sirva más de una vez. El test de AC23 (1 → 2) **no** lo satisfacía. Cubierto por
      un test propio: dos fallas seguidas (loader 1 → 3), después éxito, la rama monta y el
      estado de error desaparece — con `childMounts === 1` en toda la secuencia.
      📌 Nació **verde**: el mecanismo ya estaba implementado, lo que faltaba era la prueba.
      Es guard de regresión, no driver.
- [x] AC21 — **E3**: `requirePrivyAppId()` sin app id cae en el mismo estado terminal
      visible, no en un splash eterno.
- [x] AC23 — **Retry real (C2c)**: el test **observa un intento nuevo** — cuenta invocaciones
      del loader, o espía `window.location.reload`. ⛔ "El botón existe y no rompe" no
      satisface este AC.
- [x] AC24 — **i18n (C2d)**: las tres claves de `WALLET_LOAD_ERROR_COPY` existen en `en.ts`
      **y** en `es.ts`, y el guard de traducción pasa sin agregarlas a la lista de exentas.
- [x] AC25 — Cada rama renderiza su `data-wallet-branch` (`injected` / `privy`), y AC6 se
      asserta **sobre ese atributo** — de modo que borrarlo ponga tests de comportamiento en
      rojo, no sólo el guard de bundle.

**Bundle** (suite separada, exige build previo)

✅ Automatizado en `pnpm -C apps/web bundle:guard`. Última corrida: **75 chunks inspeccionados,
0 hallazgos**.

- [x] AC9 — El grafo estático de `/[locale]` **no** contiene el marcador de la rama Privy.
      ⚠️ **Reformulado en la implementación**: el guard cubre **todas** las entradas
      `/[locale]`, no sólo el layout — un jugador camina a `/exercises` y a `/arena`, y una
      fuga ahí es la misma fuga.
- [x] AC10 — Ídem para la rama injected en el grafo… **⛔ NO se implementó, y a propósito.**
      El foco es MiniPay: la rama injected **debe** poder estar en el grafo que recibe MiniPay
      — es la que ejecuta. Cerrarlo como "el injected tampoco entra" habría sido un criterio
      simétrico sin dueño, y web quedó fuera del alcance (founder, 2026-08-07).
- [x] AC11 / AC12 — Cada chunk de rama lleva **sólo su** marcador. Verificado por inspección
      del build (8 apariciones de `data-wallet-branch`, ninguna cruzada). ⚠️ **No automatizado**:
      su valor era proteger el grafo de MiniPay, y eso ya lo hace AC9.
- [x] AC13 — El guard **no** falla por dependencias legítimamente compartidas: un chunk con
      `wagmi`/`viem` y sin marcador de rama **pasa**. Aserido con un caso positivo explícito.
- [x] AC14 — El guard resuelve chunks **por evidencia del build**. ⛔ Ningún hash hardcodeado.
      Además busca **código vivo** en la forma que emite el minificador
      (`"data-wallet-branch":"privy"`), nunca nombres de archivo ni de componente.

**Regresión**

- [x] AC15 — Suite completa en verde: **7.432 passing / 603 files** (baseline al abrir:
      7.404 / 598).
- [x] AC16 — `pnpm exec tsc --noEmit` limpio.
- [x] AC17 — **VR 62/62 sin `--update-snapshots` y sin tocar un solo baseline.** Era la
      incógnita seria (`ssr: false` cambia el primer paint de toda ruta): no cambió ninguno,
      porque los casos esperan por elementos de producto y el árbol final es idéntico.

**Medición** (el punto de todo esto)

- [x] AC18 — **SUPERADO POR MEDICIÓN MEJOR, no cumplido como estaba escrito.** El umbral era
      "First Load JS de `/[locale]` < 382 kB": dio **380 kB**, es decir −2 kB, ruido entre
      builds. **El AC estaba mal formulado**: medía la vara equivocada. El browser, con persona
      MiniPay, mide **1.048,0 kB → 420,1 kB (−60%)** hasta que el hub es usable, y **1 → 0**
      requests con código de Privy.
- [x] AC22 — Control registrado (`/terms`: 145 → 146 kB por `next build`; por grafo de chunks,
      880 → 147 kB gz). ⚠️ Sirvió para **detectar que la vara mentía**, no para confirmar el
      ahorro: la discrepancia entre las dos varas era 6,1× en esa ruta.

## ⛔ Regla metodológica que deja este frente

> **Para performance MiniPay en este repo, `next build` es DIAGNÓSTICO, no árbitro.**
> El árbitro son mediciones de browser con persona MiniPay, `encodedDataLength` y milestones
> de producto.

Evidencia: para el mismo cambio, `next build` reportó **−2 kB** y el browser **−628 kB**. La
tabla subatribuye: antes del split había ~700 kB gz en el grafo de la ruta que no aparecían en
su "First Load JS"; después, las dos varas coinciden.

## Cómo se corre el guard

No entra en `pnpm test` (vitest) porque **exige un build previo**:

```bash
pnpm -C apps/web build          # produce .next/app-build-manifest.json + los chunks
pnpm -C apps/web bundle:guard   # el guard
```

⛔ Correr el guard sin build leería un `.next` viejo y **pasaría en verde midiendo el build
anterior**. Resuelto con un **sello de contenido**: `next.config.js` estampa un sha256 de
`src` + config + lockfile, y el guard se niega a auditar un `.next` que no salió de este árbol.
⚠️ **Por `mtime` no**: un checkout reescribe timestamps sin cambiar contenido.

## Out of scope / future

- `preconnect` a `privy.chesscito.com`, `auth.privy.io`, `explorer-api.walletconnect.com`
  (300 ms cada uno). Es el ítem siguiente y es de dos líneas, pero **no** entra acá: mezclarlo
  haría que una medición no se pueda atribuir a una causa.
- Diferir los ~1.035 KB de bundles propios de Privy (los baja Privy desde su origen, no
  nosotros).
- Barrida del resto del root layout.

## Open questions

- **¿`WalletShell` reusa el splash o queda como `<div>`?** Se decide **midiendo** (E7), no
  eligiendo antes. El spec acepta las dos salidas.
- **¿Cuánto baja realmente `/[locale]`?** EXP2 dice que el hub retiene `wagmi`/`viem` por
  claims, así que el ahorro es la rama Privy y no el stack entero. El número exacto sólo se
  conoce implementando: webpack re-particiona `1515` al romper el import estático.

### Resueltas

- ✅ **¿El manifest enumera los chunks diferidos?** No. Medido en EXP1 con el `next/dynamic`
  que `learn-hub-client.tsx` ya usa.
- ✅ **E3** — error boundary con mensaje corto + "Retry". Decidido por el founder.
- ✅ **¿Re-exportar `wagmiConfig`?** No. Se actualizan los importadores.
- ✅ **Evidencia load-bearing de las dos ramas** — `data-wallet-branch` renderizado por cada
  provider (C4).
- ✅ **Mecánica del retry** — identidad de loader nueva, o `reload()`. Nunca la misma promesa
  rechazada (C2c).
- ✅ **Copy del error** — `WALLET_LOAD_ERROR_COPY`, EN + ES, bajo el guard de i18n (C2d).
