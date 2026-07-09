# Next session prompt — post 2026-07-09 LEARN re-smoke

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** `main` = `daf4de36`. Suite **4760 passing / 395 files**.
El re-smoke de LEARN pasó completo en device; el badge de la torre está minteado
en mainnet.

**Leer primero:**
- `docs/handoffs/2026-07-09-session-close-handoff.md` — resumen de la sesión.
- `docs/backlog/2026-07-09-pending-work-triage.md` — pendientes **auditados contra
  el código**, con costo estimado y orden recomendado.

**Antes de tocar nada:** `preview.chesscito.com` necesita un redeploy con
`04de19fa` o posterior para que el modal muestre `12/30`.
`NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` es build-time.

---

## Camino recomendado (en orden, de barato a caro)

1. **Refrescar el baseline VR `hub-shop-sheet-open`** (~10 min)
   Está **rojo**, verificado. Espera 3 SKUs retirados (`5c8e0f5d`, `6bf6c344`).
   Usar `--update-snapshots=all` (el flag pelado no reescribe lo que cae bajo el
   umbral) y **abrir el PNG** para confirmar que el diff son solo esos SKUs.

2. **Decodificar los custom errors** (~1-2h) — mejor ratio dolor/hora
   Verificado: cero hits de `decodeErrorResult` / `ContractFunctionRevertedError`
   en `apps/web/src`. Hoy `BadgeAlreadyClaimed`, `CooldownActive` (`0xc1ab61a1`) y
   `DailyLimitReached` (`0xeba8fe8a`) salen los tres como "Try again".
   Las ABIs salen de `artifacts/`, **nunca a mano**.

3. **Icono de Coach en el HUB** (~30 min) — backlog PLAY #7
   El asset ya existe en los tres formatos:
   `public/art/new-icons-chesscito/training.{png,webp,avif}`. Es un swap de ruta.
   Toca UI → baseline VR en el mismo PR.

4. **Quitar la confirmación redundante de LUZ** (~1h) — backlog PLAY #8

5. **Investigar "Claim 3 Shields"** — backlog LEARN #1. **Investigación, no
   código.** Nadie sabe a qué sistema pertenece ni por qué lanza el 21-Day Mind
   Challenge. Es el único pendiente con comportamiento inexplicado.

Después de eso la conversación es **Belt System vs server-verified progress**, y
esa es decisión de producto, no de ingeniería.

---

## Reglas que esta sesión ganó a golpes

- **Verde no significa verificado.** Un test que aísla un predicado no prueba la
  composición. Un baseline VR con `maxDiffPixelRatio: 0.01` no guarda texto.
- **Una constante derivada de contenido debe ser función del contenido.** Nunca un
  literal. Si dice `@deprecated ... migración diferida a Sprint N`, bórrala en el
  PR que migra al último consumidor y deja que `tsc` enumere el resto.
- **VR:** refrescar con `--update-snapshots=all`, luego leer el PNG.

## Qué NO tocar todavía

- **No abrir el Belt System** hasta que cierren MiniPay/slides. Único item con
  reloj: `BADGE_THRESHOLD` → proporción, y **la ventana sigue abierta** (hay
  exactamente un badge minteado).
- **Nunca construir recovery para el Daily-Streak.** El shield protege el COMBO,
  no el Daily.
- **No implementar server-verified progress con umbral proporcional evaluado en
  vivo** — des-califica retroactivamente. Ver la decisión de diseño en el
  session-close handoff: bit monótono `qualified(player, piece)`.
- **No subir el `MAX_STARS`** ni ningún techo a un literal otra vez.

## Si el usuario dice…

- **"continuemos"** → leer este archivo + el triage, y arrancar por el punto 1
  salvo que redirija.
- **"qué falta"** → `docs/backlog/2026-07-09-pending-work-triage.md`.
- **"ship it"** → redeploy de preview y confirmar `12/30` en device antes de nada.
