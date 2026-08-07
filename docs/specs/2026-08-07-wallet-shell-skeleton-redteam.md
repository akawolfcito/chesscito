# Red team — AC8 / `WalletShell` skeleton

**Spec:** `2026-08-07-wallet-shell-skeleton.md` · **Pases:** 2 · **Veredicto final: READY con
dos experimentos bloqueantes.**

---

## Pase 1 — hallazgos

### P0-1 — Todo el spec se apoya en una hipótesis que nadie verificó

C3 afirma que `linear-gradient` dispara FCP y `background-color` no. Es lo que dice la
especificación de Paint Timing, **pero este spec no lo midió en este build, en este browser, con
este CSS**. Si la hipótesis es falsa, el resultado es el peor de todos: el jugador ve una
silueta (el criterio de producto se cumple), el FCP sigue en ~4 s, y **la métrica que justificó
el frente no se mueve** — con código nuevo ya mergeado.

⚠️ Agravante: el equipo ya se comió una versión de este error. El frente anterior tenía un AC
(AC18) cuyo umbral medía la vara equivocada, y sólo se descubrió midiendo con otro instrumento.

**Resolución — EXP1, BLOQUEANTE.** Antes de escribir el skeleton: pintar **un solo bloque** con
`linear-gradient` dentro del `WalletShell` actual, compilar, medir con Slow 4G + CPU 4×.

- Si el FCP baja a < 1,5 s → la hipótesis se sostiene y se implementa la silueta completa.
- Si el FCP no se mueve → **se para el frente y se reporta**. La silueta quedaría siendo una
  mejora de percepción sin efecto en la métrica, y eso es una decisión del founder, no mía.

⛔ EXP1 se mide, no se razona. Cuesta un build.

### P0-2 — `usePathname()` puede no existir donde el spec lo necesita

C1 hace que la silueta dependa de `usePathname()` **en el render del servidor**. El hub es una
ruta **estáticamente generada** (`●` en la tabla de `next build`). Si durante el prerender ese
hook no devuelve el path concreto, el servidor emite el shell vacío, el skeleton aparece recién
al hidratar — es decir, **a los ~4 s, que es justo cuando ya no hace falta**. El frente entero
se evapora en silencio y el test unitario (que corre con router de test) pasaría igual.

**Resolución — EXP2, BLOQUEANTE.** Verificar en el **HTML servido** (no en jsdom) que el
skeleton aparece en `/` y no aparece en `/terms`:

```bash
curl -s http://localhost:3002/      | grep -c wallet-shell-skeleton   # espera ≥ 1
curl -s http://localhost:3002/terms | grep -c wallet-shell-skeleton   # espera 0
```

⛔ Un test con `renderToStaticMarkup` **no** satisface esto: ahí el pathname lo inyecta el test.
La evidencia tiene que venir del servidor real.

**Plan B si EXP2 falla:** el boundary recibe la decisión como **prop desde el layout**, o el
skeleton se renderiza en todas las rutas con una silueta neutra. ⛔ Lo que NO se hace es dejarlo
dependiendo de la hidratación: eso es el frente sin su beneficio.

### P1-1 — AC14 no es medible como está escrito

"CLS del tramo shell → hub = 0" es incomprobable con un número global: el 0,179 conocido llega
~10 ms después de T2 y quedaría dentro de cualquier ventana razonable.

**Resolución.** AC14 se reformula sobre los **registros de shift**, que el instrumento ya
captura con sus nodos:

> Ningún `layout-shift` con `startMs ≤ T2` **y** ninguno cuyos `sources` incluyan un nodo con
> clase `wallet-shell-*`. El shift de `hub-scaffold-body` / `kingdom-anchor-tagline` se reporta
> aparte y **no** cuenta contra este AC.

### P1-2 — El spec promete "no empeora" y no dice cómo lo sabría

AC15/AC16 usan tolerancias (+150 ms) contra números que **varían entre corridas**: T2 osciló
4.136–4.199 ms y LCP 4.324–4.568 ms en cinco corridas del mismo build. Una sola corrida
después del cambio puede quedar dentro o fuera de la tolerancia por ruido.

**Resolución.** Antes/después se miden con **3 corridas cada uno** y se compara la **mediana**.
⛔ Una sola corrida no decide nada, en ninguna dirección — tampoco a favor.

### P1-3 — El skeleton engorda exactamente lo que el frente siguiente quiere adelgazar

El CSS del skeleton entra en `globals.css`, que **ya es render-blocking** (58–60 KiB) y es el
candidato #4. Sumarle bytes al recurso que bloquea el render para adelantar el FCP es un
trade real, no gratis.

**Resolución.** Aceptado y acotado: AC12 ya fija tolerancia de +2 kB. Se anota en el spec del
frente de CSS que esos bytes existen y de dónde vienen. ⚠️ Si el skeleton necesitara más de
2 kB de CSS, deja de ser "sin costo" y vuelve a discusión.

### P2-1 — "CLS = 0" no significa "sin salto visual"

Un reemplazo a pantalla completa puede tener CLS 0 y aun así leerse como un corte brusco: CLS
no mide el swap de una capa fija por otro árbol. El spec podría cumplir todos sus AC numéricos
y empeorar la sensación.

**Resolución.** AC11 (filmstrip) es el juez de esto y es cualitativo a propósito. Se agrega que
el filmstrip se mire **también en el frame inmediatamente posterior a T2**, no sólo antes.

### P2-2 — `position: fixed` tiene cicatriz en este repo

`globals.css` documenta que `background-attachment: fixed` rompió el sizing del viewport en iOS
Safari. No es lo mismo que `position: fixed`, pero la zona ya mordió una vez.

**Resolución.** Verificar en 390×844 y en 360×640 (el mínimo del store de MiniPay, que ya tiene
proyecto de Playwright). Anotado como paso de verificación, no como AC.

---

## Pase 2 — lo que se atacó y NO resultó hallazgo

- **"El skeleton podría montar `children`"** → no: el shell no recibe `children` por diseño del
  frente anterior, y AC7 lo guarda.
- **"Podría reintroducir dependencia de wallet"** → no: E4 lo prohíbe explícitamente y AC21
  (`bundle:guard`) lo detecta si alguien importa la rama desde el shell.
- **"El VR se va a poner rojo"** → improbable, y por una razón concreta: los casos del VR
  esperan por elementos de producto, y `hub-clean` fotografía `/exercises`, no el hub. El
  skeleton vive fuera de esa ventana. Igual AC20 lo verifica.
- **"El skeleton podría quedar visible tras un error de rama"** → cubierto por E2/AC6, que
  existe porque el frente anterior ya eliminó el estado ambiguo "cargando + error".

---

## Veredicto

**READY**, con dos condiciones que se ejecutan **antes** de escribir la silueta:

| # | Experimento | Qué decide |
|---|---|---|
| **EXP1** | Un bloque con `linear-gradient` en el shell → medir FCP | Si el frente tiene efecto sobre la métrica o sólo sobre la percepción |
| **EXP2** | `curl` al HTML servido de `/` y `/terms` | Si la silueta llega por SSR o recién al hidratar (y entonces no sirve) |

Si EXP1 falla, **el frente se para y se reporta**; no se compensa con el argumento de que la
silueta "igual se ve mejor". Si EXP2 falla, se aplica el Plan B de P0-2 antes de seguir.

Cambios incorporados al spec: AC14 reformulado (P1-1), medición por mediana de 3 corridas
(P1-2), nota del costo en `globals.css` (P1-3), filmstrip post-T2 (P2-1), verificación en dos
viewports (P2-2).
