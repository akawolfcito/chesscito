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

## Nota de método

Un VR con 49 rojas **no informa nada** hasta separar "el arte cambió" de "algo se rompió".
Lo que hizo el corte no fue mirar diffs uno por uno, sino **la fecha del último
re-baseline contra el log de arte**: dos comandos que reencuadraron 49 fallos como una sola
decisión pendiente.
