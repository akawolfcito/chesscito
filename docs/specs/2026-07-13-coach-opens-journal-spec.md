# Spec — Coach abre el Diario (PLAY), y el ProSheet deja de gritar el precio

- **Fecha:** 2026-07-13
- **Backlog:** cierra **PLAY #6** ("sin PRO, el diario no debe quedar enterrado — valor
  mínimo visible para free") de `docs/backlog/2026-07-10-backlog-index.md`.
- **Scope:** hub de **PLAY** únicamente. LEARN no se toca.

## El problema

El tile del Coach en el dock de PLAY lleva un badge **PRO** y, al tocarlo, un usuario sin
PRO recibe el **ProSheet** en la cara:

```ts
// play-hub-client.tsx:98
onCoachTap={() => {
  track("play_hub_coach_tap", { pro_active: pro.active });
  if (pro.active) router.push("/coach/history");
  else proSheet.openSheet();
}}
```

Vendemos antes de mostrar. Un jugador que nunca compra PRO **nunca se entera de que el
análisis existe**, y por lo tanto nunca puede desearlo.

**El hallazgo que cambia el tamaño del problema:** `/coach/history` **NO está bloqueado por
PRO**. Renderiza para cualquier wallet conectada y hasta tiene un `AskLuzBanner` que se
muestra *específicamente* cuando `!isPro && credits === 0` (`coach/history/page.tsx:57`). El
diario **ya fue diseñado para el usuario free**. El único que lo esconde es el `if` del dock.

No hay que construir una superficie: hay que **destapar la que ya pagamos**.

## Los dos cambios

### 1. El Coach siempre abre el Diario

`play-hub-client.tsx:98` — el handler pierde la rama:

```ts
onCoachTap={() => {
  track("play_hub_coach_tap", { pro_active: pro.active });
  router.push("/coach/history");
}}
```

El evento **conserva la dimensión `pro_active`**, que ahora vale más que antes: mide cuántos
free entran al diario y cuántos de esos compran adentro. Es la métrica que valida o mata
esta decisión.

`play-hub-scaffold.tsx:203` — se cae el badge del tile:

```ts
badge={<span className="play-hub-action-badge">PRO</span>}   // ← se borra
```

El tile deja de anunciar un muro que ya no existe. La prop `badge` de `HubActionTile`
**se queda** (es API genérica; no es refactor de este spec).

### 2. Se retira `priceSubLabel` del ProSheet

Se borra el render (`pro-sheet.tsx:441`) y la clave de **los dos** catálogos —
`editorial.ts:2117` (`"≈ 6 cents a day"`) y `messages/es.ts:277`
(`"≈ 6 centavos al día"`)—, si no `audit-content-messages` se queja de la asimetría.

Dos razones, y la segunda importa más que la primera:

1. **Sobra.** El precio ya está arriba, en grande.
2. **Es el precio escrito a mano.** Es un derivado de `$1.99 / 30` horneado como texto. Si
   el precio de PRO cambia, la línea miente y **ningún test se pone rojo** — exactamente el
   patrón que nos mordió en el Hub Tour (ver `2026-07-12-hub-tour-part1-handoff.md`, punto 4).

`30 days · no auto-billing` **se queda**: dice algo que el precio no dice.

## Dónde vive la venta ahora

No la borramos: la movemos **detrás del valor**. El recorrido, todo ya construido:

```
dock → diario (ve SUS partidas) → toca una sin analizar
     → /coach/[gameId] → CTA "Ask Coach" (conoce los créditos)
     → ProSheet cuando se le acaban
```

`coach/history/page.tsx:87` ya rutea las partidas sin analizar al visor, y ahí vive el CTA
consciente de créditos. **No agregamos superficie.**

### 3. El Diario sin wallet gana un CTA de conectar (hallazgo del red team, P0)

**El paywall que estamos sacando es también el embudo de conexión.** Hoy, un usuario **sin
wallet** que toca Coach recibe el ProSheet, cuyo CTA primario es literalmente **"Connect
wallet"**. Si lo mandamos al diario sin más, cae en un párrafo y nada más:

```tsx
// coach/history/page.tsx:59-66 — la rama sin wallet HOY
<p className="tj-no-wallet-text">{t("connectWalletForHistory")}</p>
```

Una **frase**, no un botón. Sin este arreglo cambiamos un muro por un **pozo**.

La rama sin wallet suma un CTA real reusando `useConnectWallet` (ya lo usan seis superficies,
entre ellas `trophies-body.tsx`) + `PrincipalButton`, que **el diario ya importa**.

**Encuadre de canal (decisión del founder, 2026-07-13):** en **MiniPay —el canal principal— la
wallet se auto-conecta**, así que este estado casi no existe ahí; vive en la web. Y el **social
login** (backlog, no scopeado) lo disolvería del todo: el usuario siempre llegaría con wallet.
**Lo arreglamos igual** porque son ~10 líneas sobre componentes que ya existen, y porque el
dead-end **ya está vivo hoy** para cualquiera que entre al diario sin wallet — este spec no lo
crea, solo lo pone en el camino de todos.

### 4. El ProSheet gana una dimensión de origen (hallazgo del red team, P2)

La *open question* de este spec dice que la decisión es "reversible si el funnel se desploma".
**No lo es** con lo que medimos hoy: `pro_active` en `play_hub_coach_tap` cuenta **entradas** al
diario, no **compras atribuibles** al diario. Si PRO baja, no podemos distinguir si el diario es
la causa (sacamos el paywall y nadie compra) o la cura (compran más tarde y mejor).

El ProSheet lleva `source` al abrirse y al concretar la compra:
`"coach_dock" | "journal" | "pro_chip" | "pro_tile" | "premium_slot"`.

Sin esto, la tesis del spec **no es falsable** y la red de seguridad que se dio a sí mismo no
existe.

## Estados de UI

| Estado | Qué ve | Salida |
| --- | --- | --- |
| Free, sin partidas | Empty state ya existente: icono + título + cuerpo + CTA (`coach-history.tsx:277`) | `/arena?fresh=1` |
| Free, con partidas | Sus partidas. Las sin analizar rutean al visor | ProSheet cuando gasta sus créditos |
| Free, **sin wallet** | Copy `connectWalletForHistory` + **CTA de conectar (NUEVO, §3)** | Conectar → cae en el estado de arriba |
| PRO activo | Sin cambios respecto de hoy | — |

**Ningún estado queda en blanco ni sin salida.**

### Back del diario — verificado, no se toca

El diario hace `router.push("/")` (`page.tsx:62`), no `router.back()`. Parece un bug ("¿vuelve a
TRAINING?") y **no lo es**: el modo es **build-time**, no una pestaña. En el build de PLAY, `/`
renderiza `PlayHubClient` (`hub-scaffold-client.tsx:15`), así que el back **devuelve al hub de
PLAY**. El toggle TRAINING|PLAY solo existe en **FULL, que es interno**. No se construye nada.

## Tests

- **El test que hoy fija el paywall se INVIERTE** (`play-hub-client.test.tsx`): con
  `pro.active === false`, tocar Coach **rutea a `/coach/history` y NO abre el ProSheet**.
  Ese test es lo que impide que alguien reponga el `if` sin querer.
- El tile del Coach **no lleva badge PRO**.
- **Sin wallet, el diario renderiza un CTA de conectar** — no solo la frase. Este test es el que
  impide que volvamos a shipear el pozo.
- El ProSheet **no renderiza** `priceSubLabel`, y la clave no existe en ningún catálogo.
- El ProSheet **emite `source`** al abrirse desde cada origen.
- **Baseline VR:** el dock cambia de píxeles → hay que regenerar el baseline del play hub.

## Fuera de scope (no re-litigar acá)

- **El hub de LEARN.** Ahí el chip del Coach ni se renderiza en Lite
  (`onCoachTap={CHESSCITO_LITE_MODE ? undefined : ...}` + el scaffold lo pinta solo si la
  prop existe). Sumarle un ítem al hub de LEARN compite con el Daily, que **abre** la sesión.
  Es otra conversación.
- **El mini-tour de PLAY** (PRO / Shop / Coach / Peones). Spec aparte.

## Open questions

- Con el badge PRO fuera del tile, ¿queda alguna señal en el dock de que el análisis es de
  pago? La tesis de este spec es que **no debe haberla** —el precio se descubre adentro, con
  las partidas propias a la vista—. Es reversible si el funnel se desploma, **y la dimensión
  `source` del §4 es lo que nos permitirá verlo**. Sin ella esta pregunta no tiene respuesta
  posible.
- ¿Un free llega a tener créditos de Coach alguna vez? Si la respuesta es "nunca", entonces cada
  partida sin analizar termina en el ProSheet un tap después — lo cual **es** el diseño (la
  venta detrás del valor), pero conviene decirlo en voz alta en vez de insinuar que el free
  puede analizar gratis. No bloquea: el camino es el mismo en ambos casos.
