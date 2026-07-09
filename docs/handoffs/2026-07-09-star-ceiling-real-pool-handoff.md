# Handoff — Los techos de estrellas leen el pool real (2026-07-09)

**Estado: CERRADO.** PR [#193](https://github.com/akawolfcito/chesscito/pull/193)
mergeado a `main` (`04de19fa`). Suite **4760 passing / 395 files**.
Cierra el follow-up `MAX_STARS` del handoff del deadlock de progresión.

---

## Qué pasaba

Tras mintear el badge de la torre, el modal `Badge Earned` mostró **`12/15`**
con la torre a 12★ y un techo real de 30★. La tarjeta de Share heredaba el
número: lo que se publica en IG o TikTok **subestimaba el score del jugador**.

## Causa raíz

`EXERCISES_PER_PIECE = 5` se marcó `@deprecated` el 2026-06-05, a favor de
`getExerciseCount(piece)`. Su propio comentario nombraba a `result-overlay.tsx`
como el último consumidor, decía *"today every piece returns 5 so this is
behavior-identical"*, y difería el cambio a "Sprint 3".

Sprint 3 nunca llegó. Los pools crecieron de 5 a 10 ejercicios. La constante
siguió devolviendo 5 y **todos** los techos de estrellas se partieron a la mitad,
en silencio.

El comentario era cierto el día que se escribió. Eso es justo lo que lo hacía
peligroso: codificó una *foto* del dato ("hoy cada pieza devuelve 5") como si
fuera una *garantía*, y nada falló cuando el dato se movió.

## Eran cuatro lecturas, no una

El modal era solo la visible. Al borrar la constante, `tsc` encontró las dos que
nadie había reportado.

| Superficie | Antes | Ahora |
| --- | --- | --- |
| `BadgeEarnedPrompt` (fila de estrellas) | `/15` | pool real |
| `ResultOverlay` pill de badge | `/15` | pool real |
| `ResultOverlay` pill de score | `/15` | pool real |
| `PieceCompletePrompt` | `/15` | pool real |
| `getCardUrl` (imagen de share) | clamp 15 | clamp al máximo real + `&max=` |
| `shareUrlForBadge/Score` | clamp 15 | clamp al máximo real + `&max=` |
| `/api/og/exercise` | `maxStars = 15` | parámetro `max` |
| Páginas `/share/{badge,score}` | clamp 15 | parámetro `max` |

## Diseño

`maxStars` es un input explícito, con una sola fuente:
`getMaxPossibleStars(piece, catalog)` — el mismo catálogo mergeado contra el que
se normaliza `totalStars`, así que un ejercicio agregado por overlay nunca puede
producir un "33/30".

- Los links viejos que omiten `max` caen al **pool baseline de 10 ejercicios
  (30★)**, nunca al de 5 que ya no existe.
- `max` está acotado a `[3, 300]`: un pool no puede exceder
  `MAX_EXERCISES_PER_PIECE × 3★`, así que un link fabricado no puede imprimir un
  denominador absurdo en una imagen pública.
- **`EXERCISES_PER_PIECE` está borrada.** No puede volver a mentir.

El medidor de estrellas pasa a ser una barra fija de 5 segmentos que se llena
proporcionalmente. Los pools llegan a 100 ejercicios y una fila de 100 glifos no
es una UI. Con `maxStars=15` se reduce exactamente al histórico
`ceil(totalStars / 3)`, así que una pieza de 5 ejercicios se ve igual que antes.

---

## Dos hallazgos que valen más que el fix

### El guard de score-share probaba texto, no comportamiento

Cortaba 280 caracteres del fuente después de `if (variant === "score")` y les
pasaba una regex. Se rompió apenas uní las dos ramas de `getCardUrl` — y con
razón: **una regex sobre el código fuente no puede ver qué devuelve una
función**. Ahora `getCardUrl` se exporta y se asserta sobre su salida.

### El VR no estaba guardando esos números

Los cuatro baselines de fixture **pasaban en verde** mientras seguían dibujando
las etiquetas viejas. `FIXTURE_OPTS` compara con `maxDiffPixelRatio: 0.01`, y el
1% de un viewport de 390×844 se traga un cambio de dos dígitos.

Dos consecuencias, ya codificadas en memoria:

1. **El VR guarda layout, no texto.** Nunca dejes un número o un string
   custodiado solo por un baseline visual.
2. **`--update-snapshots` a secas no los reescribe**: Playwright 1.58 considera
   "match" lo que cae bajo el umbral y salta la escritura. Hay que usar
   `--update-snapshots=all` y después abrir el PNG para confirmar.

Refresqué 4 baselines y verifiqué que `vr14-result-badge` ahora dice `12/30`.

---

## Verificado

- `pnpm exec tsc --noEmit` limpio; eslint limpio en los archivos tocados.
- **4760 passing (395 files)**, desde 4747. 13 tests nuevos, rojos primero.
- 4 baselines VR refrescados y re-verificados contra el build nuevo.

## Próximos pasos

1. **Redeploy de preview** para ver el `12/30` en el teléfono y confirmar la
   tarjeta de Share.
2. **Decodificar los custom errors** — `BadgeAlreadyClaimed`, `CooldownActive`
   (`0xc1ab61a1`), `DailyLimitReached` (`0xeba8fe8a`). Los tres salen como un
   "Try again" genérico.
3. **Baseline VR `hub-shop-sheet-open`** sigue obsoleto (espera 3 SKUs
   retirados). Deuda previa.
4. **Modal `Piece Unlocked`** fuera del vocabulario visual —
   `docs/backlog/2026-07-09-piece-unlocked-modal-visual-vocabulary.md`.

## Pregunta abierta que no se movió

`/api/sign-badge` firma cualquier `levelId` entre 1 y 10000 sin verificar las
estrellas (`sign-badge/route.ts:23`). El gate de 10★ vive solo en el cliente. El
contrato impide clamar **dos veces**, no clamar **sin merecerlo**. Ya hay un
badge minteado en mainnet que ejercita ese camino. Cierra con server-verified
progress, y hay que cerrarlo antes de que un badge valga dinero.
