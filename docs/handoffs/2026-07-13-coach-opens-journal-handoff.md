# Handoff — El Coach abre el Diario (PLAY)

- **Fecha:** 2026-07-13
- **Spec:** `docs/specs/2026-07-13-coach-opens-journal-spec.md`
- **Red team:** `docs/specs/2026-07-13-coach-opens-journal-redteam.md`
- **Plan:** `docs/superpowers/plans/2026-07-13-coach-opens-journal.md`
- **Cierra:** backlog **PLAY #6**
- **Suite:** **5080 passing / 426 files** (venía de 5073/426). `tsc` limpio.
- **Verificado en navegador real** (modo PLAY, 390×844), no solo en tests.

## Qué cambió

El tile del Coach en el dock de PLAY **abre el Diario** en vez del paywall, y **perdió el badge
PRO**. La venta no se borró: se mudó **detrás del valor** — el jugador ve sus partidas primero,
y el ProSheet aparece cuando toca analizar y no le quedan créditos.

| Archivo | Qué cambió |
| --- | --- |
| `hub/play-hub-client.tsx` | El handler pierde el `if (pro.active)`. Siempre `/coach/history` |
| `hub/play-hub-scaffold.tsx` | Se cae `badge={<span>PRO</span>}` del tile del Coach |
| `coach/history/page.tsx` | La rama **sin wallet** gana un CTA de conectar real |
| `pro/pro-sheet.tsx` | Se retira `priceSubLabel` ("≈ 6 cents a day") |
| `lib/pro/use-pro-sheet-state.ts` | Las compras llevan `source` (la superficie que vendió) |
| `content/editorial.ts` + `messages/es.ts` | `+connectWalletButton`, `−priceSubLabel` |

**El hallazgo que resizeó el trabajo:** `/coach/history` **nunca estuvo bloqueado por PRO**.
Renderiza para cualquier wallet conectada y hasta trae un `AskLuzBanner` escrito para
`!isPro && credits === 0`. La página **ya estaba hecha para el free**; solo la escondía un `if`.

## Lo que el red team encontró (y que el spec afirmaba resuelto)

**El paywall que sacamos era también el embudo de conexión.** Un usuario sin wallet que tocaba
Coach recibía el ProSheet, cuyo CTA primario es literalmente **"Connect wallet"**. Ruteado al
diario sin más, caía en **una frase sin botón**. Cambiábamos un muro por un pozo — y la tabla de
estados del spec decía, falsamente, que ese usuario podía "Conectar".

Se arregló, no se difirió: son ~10 líneas sobre `useConnectWallet` + `PrincipalButton` que la
página ya importaba, y **el dead-end ya existía** para cualquiera que entrara sin wallet. Este
spec no lo creaba: lo ponía en el camino de todos.

*(Encuadre del founder: MiniPay auto-conecta, así que el caso vive casi entero en web, y el
social login lo disolvería. Se arregló igual porque salía más barato que documentarlo.)*

## Dos hallazgos que se cayeron al verificarlos — no re-descubrirlos

1. **"El back del diario tira a TRAINING"** → **FALSO.** El modo es **build-time**. En el build
   de PLAY, `/` renderiza `PlayHubClient` (`hub-scaffold-client.tsx:15`), así que
   `router.push("/")` **devuelve al hub de PLAY**. El toggle TRAINING|PLAY solo existe en
   **FULL, que es interno**. *Lo vi en una captura y no verifiqué de qué build era.*
2. **"Hay que regenerar el baseline VR del dock"** → **No hay baseline que regenerar.** El play
   hub tiene **cero cobertura visual**: no existe ningún snapshot suyo en
   `visual-regression.spec.ts-snapshots/`. Los `hub-*` son del hub de **LEARN**. Confirma el ítem
   de backlog "Cobertura VR del play hub" — **este cambio viaja sin red visual**.

## La desviación del spec §4 — leer antes de tocar telemetría

El spec pedía una taxonomía de CTAs (`"coach_dock" | "journal" | ...`) por `openSheet(source)`.
**No se construyó así.** El ProSheet **ya calculaba** un `source`: el **pathname**, congelado al
abrir (`pro-sheet.tsx:139`), usado solo por `pro_extend_tap`.

El hook ahora toma la misma lectura en `openSheet()` y la adjunta a `pro_purchase_started` y
`pro_purchase_confirmed`. **`openSheet()` no cambió de firma**, así que los ~15 call sites de
arena/exercises/profile/hub quedaron intactos.

**Limitación explícita:** la atribución es por **superficie**, no por **CTA dentro de una
superficie** — el chip PRO y el tile del Coach viven los dos en `/`. El día que haga falta
separarlos, ahí `openSheet` gana un parámetro. Hoy no hace falta.

## Cómo se mide si esto fue buena idea

El funnel quedó legible de punta a punta:

```
play_hub_coach_tap  { pro_active: false }        ← free entrando al diario
pro_purchase_confirmed { source: "/coach/..." }  ← compró DESDE el diario
```

Sin la dimensión `source`, una caída de PRO habría sido ilegible: no habríamos podido distinguir
si el diario era la **causa** (sacamos el paywall y nadie compra) o la **cura** (compran más
tarde y mejor). El spec se llamaba a sí mismo "reversible"; ahora lo es de verdad.

## Fallo preexistente (NO es de este cambio)

La VR `hub-shop-sheet-open` está **roja en `main` también** — verificado corriendo el mismo test
en `main`. No es un diff de píxeles: el tile de PRO de la Shop renderiza **"Coming soon"** en vez
de un precio, porque el SKU no está configurado por env en la corrida local. Coincide con el
registro del backlog ("env contaminado", `28b2f75`).

## Próximos pasos

1. **El smoke del Hub Tour en MiniPay sigue pendiente** — es lo único que separa al Hub Tour de
   estar cerrado. `docs/handoffs/_next-session-prompt.md`. Para resetear la wallet:
   `pnpm -C apps/web exec tsx scripts/reset-wallet.ts 0xWALLET --commit` (dry-run sin `--commit`)
   + `/dev/reset` en el teléfono para el `localStorage`.
2. **Parte 2 del spec del Hub Tour** (cierre del Daily + recordatorios del Challenge).
3. **Cobertura VR del play hub** — subió de prioridad: el dock acaba de cambiar sin red.

## Open questions

- Con el badge PRO fuera del dock, **no queda ninguna señal** de que el análisis es de pago. La
  tesis es que no debe haberla (el precio se descubre adentro, con las partidas propias a la
  vista). **Ahora es falsable:** mirar `pro_purchase_confirmed` con `source` empezando en
  `/coach`. Si el funnel se desploma y el diario no aparece como origen, la tesis estaba mal.
- ¿Un free llega a tener créditos de Coach alguna vez? Si nunca, cada partida sin analizar termina
  en el ProSheet un tap después — que **es** el diseño, pero conviene decirlo en voz alta en vez
  de insinuar que el free puede analizar gratis.
