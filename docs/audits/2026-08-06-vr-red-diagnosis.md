# Diagnóstico del VR rojo — 2026-08-06

**Corrida completa**: `PORT=3002 BASE_URL=http://localhost:3002 playwright test
e2e/visual-regression.spec.ts --project=minipay` sobre `main` @ `2a6f16c`.
**Resultado: 13 verdes / 49 rojas de 62**, en 3.0 min.

## 1. La cifra que traíamos era falsa

El handoff decía **"VR 🔴 11/62"**. No hay ningún artefacto que respalde ese número:

- `apps/web/e2e-results/report` era un **re-run dirigido de 2 tests** (`stats.total: 2`).
- `test-results/.last-run.json` de la raíz es del **8 de mayo**.

El estado real es **49 rojas**, no 11. Nadie había corrido la suite entera.

## 2. Causa principal: los baselines están obsoletos, no hay regresión

**El último re-baseline fue el 2026-07-27** (`30919b23`). Después entraron, deliberadamente,
al menos nueve commits de arte:

| Commit | Fecha | Qué cambió |
|---|---|---|
| `4ca8f2b4` | 2026-08-02 | **background images for login and play screens** |
| `c7c213f1` · `889af63b` | 2026-08-03 | icono del pase |
| `614b9341` | 2026-07-29 | login artwork |
| `74ce8037` · `3bfe446c` · `5edc296f` | 2026-07-28 | **avatar images** |
| `92a016e8` | 2026-07-26 | **background images for new hub redesign** |

Los baselines fotografían la app **anterior a fondos y avatares nuevos**. Las rojas son la
diferencia esperada entre dos versiones del arte, no un defecto.

### La evidencia que lo cierra: `vr16-arena-rail-you-active`

Es el caso ideal porque el componente medido **no cambió**: el rail está pixel-idéntico en
posición y tamaño. Lo único que difiere:

- **Fondo**: césped verde claro → degradado gris azulado.
- **Avatar**: lobo con corona dorada → lobo con sombrero de mago.

Dos slots de arte distintos, cambiados a la vez, con el componente intacto. Eso es un
cambio de assets, no una regresión de layout.

### Y el reparto de verdes lo confirma

Los **13 verdes son, sin excepción, fixtures de componente aislado** — `vr5` mint pills,
`vr6` toast, `vr7` overlays, `vr8` historial, `vr11` chip de escudos, `vr12` chips PRO.
Ninguno pinta fondo de pantalla. **Todo lo que ocupa pantalla completa está rojo.** Si
fuera una regresión de código, el corte no seguiría exactamente la línea "¿tenés fondo?".

## 3. Causa secundaria confirmada: el puerto (afecta poco, pero es real)

`ProOriginWarning` (`apps/web/src/components/dev/pro-origin-warning.tsx:36`) es
`fixed inset-x-2 top-2 z-[100]` y renderiza sólo con `NODE_ENV === "development"` — que es
lo que levanta el `webServer` de Playwright (`pnpm dev`). El config default es
**`BASE_URL = localhost:3000`**, pero el origin aceptado es **3002**.

**Medido**: `support-page` fallaba en 3000 con el banner encima y **pasó a verde en 3002**.
`terms-page` también verde.

⚠️ **El default del config induce el error.** Cualquiera que corra `pnpm test:e2e:visual`
sin exportar `BASE_URL` fotografía un banner ámbar sobre cada página real.

## 4. La única roja que NO es ninguna de las dos

`hub-shop-sheet-open` falla **antes** de sacar la foto, en una aserción de texto:

```
Locator: .shop-item-tile:not(.welcome-pack-tile) .shop-item-tile-buy-pill--green
Expected substring: "$"
Received string:    "Coming soon"
```

Es la roja conocida por **env sin treasury**, no un problema visual. No la arregla ni el
puerto ni un re-baseline.

## 5. Qué hacer — y qué NO hacer

⛔ **No correr `--update-snapshots` a ciegas.** La cabecera del propio spec
(`visual-regression.spec.ts:6-8`) lo prohíbe: actualizar baselines exige *"an explicit
visual change rationale"* y los PRs que los bumpean en silencio se rechazan en review.
Un re-baseline ciego acá además **congelaría como correcto** cualquier defecto real que esté
escondido entre las 49.

Orden propuesto:

1. **El founder valida el arte actual** en las superficies afectadas (arena, hubs, victory
   landing). Es su ojo el que decide si el fondo gris azulado y el avatar mago son el look
   buscado. Si lo son → el re-baseline es legítimo y documentado.
2. **Arreglar el default del config**: que `BASE_URL` caiga en 3002, o que el VR falle
   temprano y claro si el origin no está en la lista aceptada. Hoy el default produce 8
   rojas gratis y nadie lo nota mirando el diff.
3. **Re-baselinear** con rationale escrito, ya con el puerto correcto.
4. `hub-shop-sheet-open` se resuelve aparte (env con treasury) o se marca como esperada.

## Addendum — el re-baseline se produjo, pero NO se pudo verificar

El founder confirmó el 2026-08-06 que el arte actual (fondo gris azulado, avatar con
sombrero de mago) es el look buscado. Con eso:

- ✅ **Re-baseline ejecutado**: 48 snapshots re-escritos, **0 creados, 0 borrados** — el mismo
  set, re-fotografiado. La corrida fue real y completa: 62 tests, 61 verdes, 1 roja
  (`hub-shop-sheet-open`, la conocida por env sin treasury, que falla en una aserción de
  texto y por eso ningún `--update-snapshots` la toca).
- ✅ **Config arreglado**: `BASE_URL` por defecto pasa a `http://localhost:3002` y el
  `webServer` recibe `PORT` derivado de `BASE_URL`, para que nadie dependa de acordarse.
- ❌ **La pasada de verificación (sin `--update-snapshots`) nunca se completó.**

⚠️ **Un `--update-snapshots` NO verifica nada.** Cada test sobrescribe su propia referencia,
así que "61 verdes" ahí dentro significa "se escribieron 61 archivos", no "61 coinciden".
La única evidencia que valdría es una corrida limpia posterior, y esa es la que falta.

### Por qué falló la verificación (hasta donde se midió)

Cuatro intentos. Síntomas, en orden de descubrimiento — cada uno tumbó la explicación anterior:

1. Exit 0 con salida vacía. **Hipótesis: `rtk` filtra la salida de comandos sin fallos.**
   Refutada: redirigir a archivo con `rtk proxy` dio 0 bytes igual.
2. El reporte HTML decía `{"total":62,"skipped":62,"ok":true}`. **Hipótesis: algo saltea los
   tests.** Refutada: el spec sólo tiene un `test.skip` por browser (línea 312) y `minipay`
   es chromium; además Step 1 y 2 no tienen skip alguno.
3. **Lo que realmente pasa**: el `index.html` quedó congelado en una hora vieja mientras
   corrían intentos nuevos — o sea **las corridas posteriores no escribieron reporte**. El
   "62 skipped" que se leyó era de un reporte anterior, no del intento en curso.
4. Cada intento deja vivos un `node` + `next-server (v14.2.35)` en 3002 que el siguiente
   reusa. La suite, que tarda **2,2 min**, pasó a no terminar en **9 min**.

**Conclusión honesta: no se sabe la causa.** Lo que sí está medido es que el runner deja de
completar y de reportar, y que el estado se degrada corrida a corrida. Perseguirlo con más
corridas fue improductivo — cuatro intentos, ninguno concluyente.

### Estado en el árbol

Los 48 snapshots y el cambio de `playwright.config.ts` quedaron **sin commitear**, a la
espera de decidir si se aceptan sin la pasada de verificación.

### Lo que hay que hacer antes de confiar en estos baselines

1. Matar todo residuo (`pkill -f "playwright test"`, liberar 3002) **antes** de cada corrida
   — no dejar que la siguiente reuse el server de la anterior.
2. Una corrida limpia **sin** `--update-snapshots` que llegue a escribir reporte. Verificar
   por el **mtime de `e2e-results/report/index.html`**, no por el exit code: exit 0 acá
   demostró no significar nada.
3. Recién con esa corrida en verde, los baselines valen.

## Nota de método

Un VR con 49 rojas **no informa nada** hasta separar "el arte cambió" de "algo se rompió".
Lo que hizo el corte no fue mirar diffs uno por uno, sino **la fecha del último
re-baseline contra el log de arte**: dos comandos que reencuadraron 49 fallos como una sola
decisión pendiente.
