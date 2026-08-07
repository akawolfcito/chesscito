# MiniPay first load — informe del split de la rama de wallet

**Fecha:** 2026-08-07 · **Commit medido:** `c7883e5` · **Baseline:** `cd380e7f`
**Alcance:** MiniPay. La superficie web queda **fuera del criterio** por decisión de producto
(founder, 2026-08-07); si aparece algún dato web es diagnóstico y no bloquea nada.

> ⛔ **El árbitro de este frente es el browser**, contando `encodedDataLength` hasta hitos de
> producto. La tabla de `next build` **no** decide — abajo está por qué, con números.

---

## 1. Arquitectura / bundling

Las dos ramas de wallet pasaron a cargarse con `React.lazy` detrás de `import()` **literales
por rama**. `wagmiConfig` salió del componente a un módulo hoja, **sin re-export**: ese único
import en `lib/claims/sources.ts` arrastraba la rama entera a todo grafo que sólo quería un
objeto de config.

**Guard determinista (`pnpm -C apps/web bundle:guard`):**

```
✅ MiniPay static graph is clean: 75 JS chunks inspected,
   no Privy branch marker and no @privy-io code.
```

- Busca **código vivo**, nunca nombres: `"data-wallet-branch":"privy"` en la forma exacta que
  emite el minificador, y rutas `@privy-io/*` como confirmación cruzada.
- **Frescura por sello de contenido**, no por `mtime`: `next.config.js` estampa un sha256 de
  `src` + config + lockfile y el guard **se niega a auditar** un `.next` de otro árbol.
  Verificado en los dos sentidos (rechazó el build viejo, pasó con el nuevo).
- Deja pasar `wagmi`/`viem` compartidos, que el hub necesita de verdad para claims (AC13).
- Cubre **todas** las entradas `/[locale]`. `/dev/**` queda afuera: rutas propias, ningún
  jugador las alcanza (E6).

## 2. Bytes reales en MiniPay — el número que manda

Instrumento: `pnpm -C apps/web measure:first-load`. Chromium headless, Pixel 5 @ 390×844,
caché deshabilitada por CDP, `window.ethereum.isMiniPay` inyectado, `next start` sobre build de
producción. Hitos de producto, **nunca `networkidle`**. Baseline medido con **el mismo script**
contra un worktree de `cd380e7f` (`measure:first-load:baseline`).

| Hito | Qué es |
|---|---|
| **T1** | `main` en el DOM — primer contenido de producto |
| **T2** | `[data-testid="hub-tile-status"]` — el hub responde; vive dentro del árbol del provider |
| **Tbranch** | `[data-wallet-branch="injected"]` — diagnóstico, sólo build nuevo |
| **T3** | T2 + 2 s — lo que llega **después** de que el hub ya es usable |

### Resultado

| Corte | Baseline `cd380e7f` | Actual `c7883e5` | Δ |
|---|---|---|---|
| **T1** | 410,4 kB · 38 js · 297 ms | 420,1 kB · 42 js · 501 ms | +9,7 kB |
| **T2 — el hub usable** | **1.048,0 kB** · 40 js · 502 ms | **420,1 kB** · 42 js · 519 ms | **−627,9 kB (−60%)** |
| **T3 — settle** | **1.058,8 kB** · 43 js | **420,1 kB** · 42 js | **−638,7 kB (−60%)** |
| **Requests con código de Privy** | **1** | **0** | ✅ |

**No son bytes diferidos: son bytes que no se bajan.** T3 lo prueba — en el build nuevo, el
total a los 2 s de estar usable es idéntico al de T2 (420,1 kB, 42 requests: nada llegó
después). En el baseline, el jugador de MiniPay bajaba **1,05 MB** de JS para llegar al mismo
punto, incluyendo **un chunk con código de Privy que jamás iba a ejecutar**.

### Lo que empeoró, dicho sin maquillaje

- **T1 sube 9,7 kB y ~200 ms.** Antes el `main` venía del SSR; ahora no existe hasta que la
  rama monta. La ventana en blanco es real y es la que crea este cambio (E2).
- **⚠️ Estas mediciones son sobre `localhost`, sin latencia.** El chunk de la rama es una ida
  a la red extra; en la red de MiniPay ese salto cuesta más que los 17 ms que se ven acá. El
  ahorro de 628 kB no se mueve, el **tiempo** sí.
- **`WalletShell` sigue siendo un `<div>` vacío** (AC8 abierto): esa ventana hoy es una
  pantalla en blanco, no un esqueleto.

### Nota de método

La primera corrida del baseline reportó T3 a los 47,5 s: el hito opcional `Tbranch` esperaba
45 s por un atributo que ese commit no tiene. **Los bytes siguen siendo válidos** — una ventana
más ancha sólo puede sumar, y sumó 10,8 kB sobre T2 — pero el reloj era irreconciliable. El
script ya limita los hitos opcionales a 5 s. La comparación se hace sobre **T2**, que en las
dos versiones se midió con el mismo criterio.

## 3. Comportamiento funcional

| Qué | Estado |
|---|---|
| Suite completa | ✅ **7.432 passing / 603 files** |
| `tsc --noEmit` (`apps/web`) | ✅ limpio |
| Wallet injected en MiniPay | ✅ `data-wallet-branch="injected"`, hub renderizado, CTA `Connect` presente |
| Rama Privy dentro de MiniPay | ✅ **nunca se solicita** (AC4, unit + browser) |
| Hidratación | ✅ sin mismatch; `children` monta **exactamente una vez** (AC7, contador instrumentado) |
| Splash terminal | ✅ imposible: `WalletBranchErrorBoundary` da mensaje + Retry (AC19/AC21) |
| Retry real | ✅ el test **cuenta invocaciones del loader** (1 → 2), no que el botón exista (AC23) |
| i18n del error | ✅ EN + ES, guard de traducción sin excepciones (AC24) |
| VR | ✅ **62/62**, sin actualizar baselines (ver §4) |

## 4. VR

✅ **62/62 passed (2,6 min), sin `--update-snapshots` y sin tocar un solo baseline.**

Esto era la incógnita seria del cambio: con `ssr: false` el primer paint de toda ruta pasa a
ser `WalletShell`, y estaba previsto que hubiera snapshots distintos. **No cambió ninguno.**
Los casos esperan por elementos de producto, así que fotografían el estado final, que es
idéntico — el shell vive en una ventana que el VR nunca captura.

📌 Que hayan quedado 62/62 sin actualizar nada es la prueba más fuerte de que **el árbol
renderizado final no cambió**: sólo cambió cuándo llega. La política escrita para esta sesión
(inspeccionar snapshot por snapshot, nunca `--update-snapshots` como primera respuesta) no
llegó a ejercerse porque no hizo falta.

## 5. Discrepancia entre `next build` y el browser

| Ruta / medida | `next build` | Browser (T2) |
|---|---|---|
| Baseline | 382 kB | **1.048 kB** |
| Actual | 380 kB | **420 kB** |
| Δ que reporta | **−2 kB** | **−628 kB** |

La tabla de `next build` dijo que este trabajo **no movió nada**. El browser dice que un
jugador de MiniPay baja **60% menos JavaScript** para llegar al mismo punto usable.

La tabla subcuenta: atribuye al "first load" sólo parte de lo que la ruta termina pidiendo. La
prueba cruzada está en el grafo de chunks del layout — 859 kB gz antes, 126 kB gz después, con
`@privy-io` presente en 4 chunks antes y en ninguno ahora.

⛔ **Conclusión de método, para la próxima vez:** en este repo, `next build` no sirve como
árbitro de performance. Sirve el browser, con persona MiniPay y cortes de producto.
