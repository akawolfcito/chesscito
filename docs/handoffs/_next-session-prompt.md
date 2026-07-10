# Next session prompt — post 2026-07-10 victory-cancel + coach-icon

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** `main` = `827e7cfe`. Suite **4853 passing / 401 test files**.
`tsc` y `lint` limpios. Smoke de MiniPay **cerrado en device (17/17)**, checkpoint firmado.

**Leer primero:**
- `docs/handoffs/2026-07-10-victory-cancel-and-coach-icon-handoff.md` — la sesión.
- `docs/backlog/2026-07-10-backlog-index.md` — el backlog vigente, auditado contra el código.

**Modo:** pulido sobre lo que ya existe. Un solo bloque activo a la vez.

---

## Ruta vigente

1. **▶️ Investigar "Claim 3 Shields"** — el único pendiente con comportamiento *inexplicado*.
   Nadie sabe a qué sistema pertenece, si duplica los 3 shields de onboarding, ni por qué al
   tocarlo lanza el 21-Day Mind Challenge. **Investigación, no código. No cambiar lógica
   hasta entenderlo.**

2. **Decoder de custom errors** — `docs/backlog/2026-07-10-custom-errors-decoder.md`.
   GO, **no bloquea estabilidad**. Mejora la copy, no la corrección. El extractor está
   escrito; falta el generador de error-ABIs desde `artifacts/` y el mapa nombre → copy.

3. **PLAY #8 — quitar la confirmación redundante de LUZ.** Borra una pantalla intermedia.

Después de eso: **Belt System vs server-verified progress**, que es decisión de producto.

---

## Antes de correr cualquier cosa

- **`env | grep NEXT_PUBLIC` debe salir vacío.** Confirmado sucio el 2026-07-10: el shell
  exporta `NEXT_PUBLIC_CHAIN_ID=11142220` y **le gana a `.env.local`**, apuntando el dev
  server a Sepolia sin avisar. Para correr limpio sin tocar el shell:
  `env -u NEXT_PUBLIC_CHAIN_ID -u NEXT_PUBLIC_BADGES_ADDRESS -u NEXT_PUBLIC_SCOREBOARD_ADDRESS pnpm -C apps/web <cmd>`
- **`lsof -ti:3000` debe salir vacío** antes de VR o E2E.
- El **play hub** solo se monta con `NEXT_PUBLIC_CHESSCITO_MODE=play` (flag de build). El
  switch de modo en la UI **no** lo alcanza.

## Higiene de comandos (evita prompts de permiso)

- **Nunca prefijes con `cd`.** Usá `git -C <ruta>` y `pnpm -C <ruta>`.
- **Un comando por llamada.** Sin pipes, sin `;` encadenados, sin heredocs.
- Typecheck con `pnpm exec tsc --noEmit` pelado.
- Archivos temporales: la tool Write, nunca `>` (zsh tiene `noclobber`).

## Reglas que estas sesiones ganaron a golpes

- **Un tipo redeclarado con el mismo nombre desarma al compilador.** `arena-end-state.tsx`
  tenía su propio `ClaimPhase`; borrar un miembro en el hook dio `tsc` verde con la variante
  muerta todavía alcanzable. Importá el tipo de quien lo posee; `grep` el nombre del miembro.
- **Un flujo opcional no puede tener estado terminal de cancelación.** Si se puede hacer
  después, cancelar es un no-op.
- **Una matriz de smoke se escribe por caminos que piden firma, no por pantallas.** El
  dead-end de victory vivía en el único camino de firma sin fila.
- **Verificá pixeles antes de llamar trivial a un cambio de arte.**
- **El entorno miente antes que el código.** Rojo masivo → sospechar del entorno.
- **Dos suites aisladas verdes no prueban su composición.**

## Qué NO tocar todavía

- **No abrir el Belt System** hasta que cierren MiniPay/slides. Único item con reloj:
  `BADGE_THRESHOLD` → proporción, mientras haya exactamente un badge minteado.
- **Nunca construir recovery para el Daily-Streak.** El shield protege el COMBO.
- **No implementar server-verified progress con umbral proporcional evaluado en vivo** — des-
  califica retroactivamente. Bit monótono `qualified(player, piece)`.
- **No subir ningún techo a un literal.** Una constante derivada de contenido debe ser
  función del contenido.
- **No tocar el *Try Again* de `timeout`** sin medir: la tx ya se firmó y transmitió.

## Si el usuario dice…

- **"continuemos"** → leer este archivo + el handoff, y arrancar por el punto 1.
- **"qué falta"** → `docs/backlog/2026-07-10-backlog-index.md`.
