# Sesión 2026-08-07 — BLOQUE DE PERFORMANCE MiniPay: **CERRADO**

> ⛔ **No se abren frentes nuevos de optimización.** Lo que quedaba eran décimas; el bloque ya
> dio lo suyo. **Siguiente: producto.**

**Estado:** `main` local = `81f2781` · suite **7.471 passing / 607 files** · `tsc --noEmit`
limpio · **VR 62/62 sin re-baselinear** · `bundle:guard` verde.

---

## Resultados finales

| Frente | Resultado |
|---|---|
| **Wallet split** | **−60% de JS** hasta que el hub es usable: 1.048,0 → **420,1 kB** |
| **WalletShell** | **FCP 3.974 → 1.736 ms** (−2.238 ms); la pantalla deja de estar vacía a los ~2 s |
| **CLS** | **0,179 → 0,0000** (5 de 5 corridas, cero shifts) |
| **VR** | **62/62**, sin re-baselinear en ninguno de los tres frentes |
| **MiniPay sin Privy** | **0 requests** con código de Privy (antes: 1) |
| **Critical CSS** | **NO ACTION** por ahora — piso de FCP en ~1.736 ms |
| **Viewport** | **NO ACTION** — dependencia de gesto documentada |
| **Web / Privy** | **fuera de criterio** por decisión de producto |
| **`<main>` anidado** | corregido: un solo landmark por documento |

## Lo que quedó en el repo

| Comando | Qué hace |
|---|---|
| `pnpm -C apps/web bundle:guard` | Falla si código de Privy entra al grafo estático de MiniPay. Exige build fresco por **sello de contenido**, no por `mtime` |
| `pnpm -C apps/web measure:first-load -- --label=X` | Bytes reales + Web Vitals + filmstrip, persona MiniPay, `encodedDataLength`, cortes de producto |
| `pnpm -C apps/web measure:first-load:baseline [commit]` | Lo mismo contra un commit viejo, por worktree temporal |

Informes: `docs/audits/2026-08-07-*` · Specs: `docs/specs/2026-08-07-*`

---

## Las cinco cosas que este bloque enseñó (y que valen más que los números)

1. **⛔ En este repo `next build` NO es árbitro de performance.** Para el mismo cambio reportó
   **−2 kB** donde el browser midió **−628 kB**. El árbitro es una medición de browser con
   persona MiniPay, `encodedDataLength` y milestones de producto.
2. **⚠️ Chromium cuenta RECURSOS de imagen, no pintura.** Mismo bloque, mismos píxeles en
   pantalla: con `linear-gradient` el FCP no se movió; con `data:image/svg+xml` bajó 2,2 s.
3. **⛔ `experimental.optimizeCss` no hace nada en App Router.** Los estilos llegan como
   `<link data-precedence="next">`, inyectados por React durante el streaming; critters
   post-procesa HTML terminado y no tiene sobre qué trabajar. El handoff de junio que la
   listaba como palanca #1 quedó marcado como desactualizado.
4. **⚠️ Un número puede dar verde por la razón equivocada.** El CLS sólo se registra si el
   estado previo llegó a pintarse: el baseline daba 0,0000 en 2 de 5 corridas **con el defecto
   presente**. Por eso la causa determinista manda sobre el outcome.
5. **⚠️ Un instrumento puede mentir con cuatro cifras a la vez.** La primera corrida de Web
   Vitals reportó `FCP n/a · LCP n/a · CLS 0 · 0 long tasks` para una página que había pintado
   a 576 ms — `__name is not defined` mataba el init script. Ahora hay cross-check que **aborta**
   y un listener de `pageerror`.

## Deuda declarada (no agendada)

- **Piso de FCP ~1.736 ms** por el CSS render-blocking de 55,5 kB encoded. Discovery hecho con
  los porcentajes reales (el shell usa 4,7% de la hoja; el hub 10,8%). Retomarlo exige una
  **hipótesis nueva**, no otro intento.
- **`align-self: stretch` del hub**: hoy converge con el comportamiento anterior porque la
  columna (234 px) es menor que el ancho intrínseco del portal (256 px). **Revalidar** si
  cambia `--app-max-width`, la geometría de tracks o el asset. ⛔ `234 × 363,8` no es una
  constante universal.
- **Telemetría del `componentDidCatch`** de la rama de wallet: sigue siendo sólo consola. Si el
  chunk falla en el device de un jugador real, no nos enteramos. Es decisión, no olvido.

## Próximo paso

**Producto.** El backlog canónico vive en `docs/backlog/2026-07-10-backlog-index.md` y la
directriz vigente en `docs/product/2026-07-13-direction-where-we-are.md`.

⚠️ Nada de esto está pusheado: son commits locales sobre `main`.
