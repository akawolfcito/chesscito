# Next session prompt — post 2026-07-10 receipt-status cluster

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** `main` = `339e0383`. Suite **4848 passing / 401 test files**.
`tsc` y `lint` limpios. VR 52 passed. E2E minipay 130 passed / 0 failed.

**Leer primero:**
- `docs/handoffs/2026-07-10-receipt-status-and-minipay-probe-handoff.md` — la sesión.
- `docs/testing/2026-07-10-minipay-critical-flow-smoke.md` — la matriz pendiente.

**Modo:** cierre y estabilización. Un solo bloque activo a la vez. Si un hallazgo no
bloquea el bloque, se **difiere**; no se abre.

---

## Ruta vigente

1. **▶️ Smoke del flujo crítico en MiniPay** — bloque activo. **Requiere device.**
   Matriz en `docs/testing/2026-07-10-minipay-critical-flow-smoke.md`, todas las
   filas en ⬜. Necesita un redeploy de preview con `339e0383` o posterior.

   El paso que importa: **cerrar el overlay de éxito y esperar 2 s**. El toast está
   suprimido mientras el overlay está montado, así que un label pegado solo se ve
   después de cerrarlo. Por eso el smoke encontró el bug de #204 y ningún test lo vio.

2. **Checkpoint de estabilidad** — solo con la matriz llena. No firmar un checkpoint
   sobre suite verde: los criterios que más importan son justo los que el código
   nuevo cambió, y ninguno tiene evidencia de device.

3. **Decoder de custom errors** — `docs/backlog/2026-07-10-custom-errors-decoder.md`.
   **GO con evidencia**, y **no bloquea estabilidad**: los reverts ya se interceptan,
   no producen éxito falso, y hay fallback genérico. Mejora la copy, no la corrección.
   El extractor ya está escrito; falta el generador de error-ABIs desde `artifacts/`
   y el mapa nombre → copy.

Después de eso: **Belt System vs server-verified progress**, que es decisión de
producto, no de ingeniería.

---

## Antes de correr cualquier cosa

- **`env | grep NEXT_PUBLIC` debe salir vacío.** Un `NEXT_PUBLIC_CHAIN_ID` exportado
  en el shell gana sobre `.env.local` y apunta el dev server a Sepolia sin avisar.
  Para correr limpio sin tocar el shell:
  `env -u NEXT_PUBLIC_CHAIN_ID -u NEXT_PUBLIC_BADGES_ADDRESS -u NEXT_PUBLIC_SCOREBOARD_ADDRESS pnpm -C apps/web <cmd>`
- **`lsof -ti:3000` debe salir vacío** antes de VR o E2E. Un dev server viejo sirve el
  build anterior y produce fallos fantasma (45 de ellos, 2026-07-10).

---

## Reglas que esta sesión ganó a golpes

- **El entorno miente antes que el código.** Ante un rojo masivo, sospechar del
  entorno antes que del diff. Comparar contra un baseline en el commit anterior.
- **Dos suites aisladas verdes no prueban su composición.** El toast pegado de #204
  vivía exactamente entre dos suites verdes.
- **Si sabés qué es el error, no le preguntes al texto.** Los errores tipados se
  clasifican antes que toda heurística de string, incluida la de cancelación.
- **Un fallo puede esconder otro.** Leer el mensaje de error real antes de creerle al
  handoff sobre la causa.
- **Un instrumento puede tapar lo que vino a medir.** El redactor del probe censuró el
  selector que el probe existía para leer.
- **VR:** refrescar con `--update-snapshots=all`, y después **abrir el PNG**. Un
  baseline hereda el entorno del que lo escribe.

## Qué NO tocar todavía

- **No implementar el decoder** hasta cerrar el smoke y el checkpoint.
- **No abrir el Belt System** hasta que cierren MiniPay/slides. Único item con reloj:
  `BADGE_THRESHOLD` → proporción, mientras haya exactamente un badge minteado.
- **Nunca construir recovery para el Daily-Streak.** El shield protege el COMBO.
- **No implementar server-verified progress con umbral proporcional evaluado en vivo**
  — des-califica retroactivamente. Bit monótono `qualified(player, piece)`.
- **No subir ningún techo a un literal.** Una constante derivada de contenido debe ser
  función del contenido.

## Si el usuario dice…

- **"continuemos"** → leer este archivo + el handoff, y arrancar por el punto 1.
- **"qué falta"** → la matriz del smoke.
- **"ship it"** → redeploy de preview y confirmar la matriz en device antes de nada.
