# AC8 — `WalletShell` skeleton: resultados

**Fecha:** 2026-08-07 · **Spec:** `2026-08-07-wallet-shell-skeleton.md`
**Perfil:** Slow 4G + CPU 4×, persona MiniPay, build de producción, mismo instrumento.
**Baseline:** 8 corridas sobre el código pre-skeleton.

> 🟢 **PASS en los ocho criterios.** FCP **3.974 → 1.736 ms (−2.238 ms)** y la pantalla deja de
> estar vacía: a los 2 s el jugador ve la silueta del hub en vez de color plano.

---

## 1. Medición (mediana de 3 corridas, como exigía el red team)

| | Baseline | Con skeleton | Δ | Gate |
|---|---|---|---|---|
| **FCP** | 3.974 ms | **1.736 ms** | **−2.238 ms** | < 2.000 ms ✅ |
| FCP por corrida | 3912…4068 | 1748 · 1716 · 1736 | | |
| **T2 (hub usable)** | 4.151 ms | **4.114 ms** | −37 ms | no empeora ✅ |
| **LCP** | 4.422 ms | **4.360 ms** | −62 ms | no empeora ✅ |
| Bytes T2 | 409,3 kB | 409,5 kB | **+0,2 kB** | ≤ +2 kB ✅ |
| Bytes T3 | 420,1 kB | 420,4 kB | +0,3 kB | ✅ |
| Requests | 39 / 42 | **39 / 42** | **0 nuevos** | = 0 ✅ |
| Long tasks | 3–5 | 4 | sin cambio | no aumentan ✅ |

### Filmstrip (AC11)

| Momento | Antes | Con skeleton |
|---|---|---|
| ~170 ms | `#0b1220` plano | `#0b1220` plano |
| **~2.000 ms** | **`#0b1220` plano** | **Silueta: chips del HUD, riel de 3 slots, panel central, riel de 2, dos CTAs** |
| ~4.700 ms | Hub completo | Hub completo |

### CLS (AC14)

**Ningún shift atribuible al skeleton.** El único registrado sigue siendo el conocido —
`section.hub-scaffold-body` + `div.kingdom-anchor-tagline`, 0,179, bimodal— con los mismos
nodos y la misma magnitud que antes del cambio.

⚠️ **La cláusula "ningún shift con `startMs ≤ T2`" de AC14 resultó inútil como estaba
escrita**: ese shift ocurre a milisegundos de T2 y cae de un lado o del otro según la corrida
(4159 vs T2 4163; 4106 vs 4114). Lo que hace el trabajo es la exención por nodo, no el
umbral temporal. Queda anotado para no repetir un criterio que decide por azar.

---

## 2. El bug que encontró la medición, no un test

La primera implementación pasaba la variante **sólo al shell pre-hidratación** y dejaba el
fallback de `Suspense` pelado. Resultado:

- el FCP bajó igual 2,2 s (la silueta pintaba antes de hidratar), y
- **a los 2 s la pantalla estaba plana otra vez**, porque al hidratar la silueta se
  reemplazaba por el hueco vacío durante los ~2 s de espera del chunk — **exactamente la
  ventana que este frente existe para llenar**.

Un informe que mirara sólo el número habría declarado éxito.

### Cómo se aisló

Bisección con píxeles, no con los ojos (`sharp` sobre el screenshot):

| Medición | Resultado |
|---|---|
| Región del panel | `[11, 18, 32]` — idéntica al fondo |
| Control: `body` en rojo | `[255, 0, 0]` — el instrumento funcionaba |
| `data:` URI decodificado | `ok 320x120` — el recurso estaba bien |
| Nodo inyectado dentro del shell | **desaparecía** → React re-renderizaba ese subárbol |

Ese último dato fue el que delató el swap de shell.

**Fijado con un test que retiene el loader en una promesa que nunca resuelve** — la única
forma de clavar esa ventana en la suite.

---

## 3. Regresión

| | |
|---|---|
| Suite completa | **7.468 passing / 606 files** (al abrir el frente: 7.432 / 603) |
| `tsc --noEmit` | limpio |
| **VR** | **62/62 sin re-baselinear** (1,8 min) |
| `bundle:guard` | 75 chunks, 0 rastro de Privy |

⚠️ El VR cubre además un cambio que toca el hub: `.hub-scaffold-body` pasó a leer
`--hub-rail-width` en vez del literal `78px`. Mismo valor, y los 62 baselines lo confirman.

---

## 4. Lo que este frente NO tocó

- CLS 0,179 de `hub-scaffold-body` / `kingdom-anchor-tagline` — **frente siguiente**, ya con
  el nodo identificado.
- `<main>` anidado — commit semántico independiente.
- CSS render-blocking — **el piso de FCP sigue siendo suyo**: la hoja de 55 kB termina a
  1.679 ms y el FCP ocurre 61 ms después. Ése es el techo de esta técnica y el precio
  cuantificado del frente que sigue.
- Viewport / zoom — **NO ACTION**, con dependencia de gesto documentada.
