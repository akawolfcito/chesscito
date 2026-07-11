# Next session prompt — post 2026-07-11 season-pass celebration

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** `main` = `9672302d`. Suite **4865 passing / 401 test files**.
`tsc` limpio, VR **51/51**. Smoke de MiniPay **cerrado en device (17/17)**, checkpoint firmado.

**Leer primero:**
- `docs/handoffs/2026-07-11-season-pass-celebration-handoff.md` — la última sesión.
- `docs/backlog/2026-07-10-backlog-index.md` — el backlog vigente, auditado contra el código.

**Ya cerrado (2026-07-11):** el Season Pass ahora tiene pantalla de celebración
post-compra (PRs #210/#211/#212). Probe vivo en `/dev/season-pass-celebration`
(`?variant=pending` para el estado de shields no acreditados).

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
- **Una suite verde puede estar cubriendo nada.** La rama de éxito del Season Pass tenía
  **cero tests**: cambiarle la forma entera no rompió un solo caso. Antes de confiar en el
  verde, `grep` el `data-testid` de lo que vas a tocar.
- **Un `/dev` probe existe para validar la pantalla real, no para ser una segunda.** Monta los
  mismos componentes; fakeá solo las *entradas*. Su valor está en los estados que no podés
  provocar a mano — ahí apareció el stat row roto. Gate en `VERCEL_ENV`, **no** `NODE_ENV`
  (los builds de preview son `NODE_ENV=production`).
- **La VR no protege la tipografía.** Los fixtures viven bajo `/dev`, que es su propio root
  layout y nunca carga Rowdies/Fredoka: los 51 baselines están en fuente de sistema.
  **Decisión del founder (2026-07-11): dejarlo así, NO regenerar baselines por esto.**

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
