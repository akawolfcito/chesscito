# Next session prompt — post 2026-07-12 milestone machine

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** `main` = `60695ab3`. Suite **5003 passing / 420 test files**.
`tsc` limpio, VR **51/51**. Smoke de MiniPay cerrado en device (17/17) — pero **el cluster
de progression NO ha sido ejercitado en device todavía** (ver punto 1).

**Leer primero:**
- `docs/handoffs/2026-07-12-progression-unlocks-celebration-queue-handoff.md` — la última sesión.
- `docs/backlog/2026-07-10-backlog-index.md` — el backlog vigente, auditado contra el código.

**Ya cerrado (2026-07-12):** la **máquina de hitos** (PR #214). Las recompensas de LEARN
ahora disparan cuando se ganan: regalo a 4★ + 2 ejercicios, laberinto a 6★ + 3 ejercicios,
Great Focus Session a 8★ netas o cuota agotada, un solo modal por vez, y el session limit
**nunca antes del reconocimiento**. Spec en
`docs/specs/2026-07-11-progression-unlocks-celebration-queue.md`.

**Modo:** pulido sobre lo que ya existe. Un solo bloque activo a la vez.

---

## Ruta vigente

1. **▶️ Device pass de MiniPay sobre el cluster de progression.** Es lo único del cluster que
   **no** está verificado. Hacerlo con **un perfil real de 12★ y badge de torre minteado** —
   el del founder — porque esa es exactamente la forma que expuso la carrera de seeding
   (`useAccount().status` vs una lectura de contrato deshabilitada). Caminos a recorrer:
   ganar el regalo (4★/2 ejercicios), desbloquear el laberinto, llegar a la Great Focus
   Session, reclamar el badge, y **cancelar** un claim para confirmar que el reconocimiento
   sobrevive. Ningún jugador real ha visto esta máquina todavía.

2. **Hueco de VR.** VR está 51/51 **pero ningún fixture llega a los overlays nuevos, al chip
   NEW del hub, ni al cuarto tile de trofeos** — la suite corre anónima con storage vacío.
   Verde significa "no rompí lo viejo", **no** "lo nuevo está cubierto". Agregar fixtures.

3. **Investigar "Claim 3 Shields"** — sigue abierto. El único pendiente con comportamiento
   *inexplicado*. **Investigación, no código.**

4. **Decoder de custom errors** — `docs/backlog/2026-07-10-custom-errors-decoder.md`. GO,
   no bloquea estabilidad.

---

## Antes de correr cualquier cosa

- **`env | grep NEXT_PUBLIC` debe salir vacío.** **Confirmado sucio otra vez el 2026-07-12**:
  el shell exporta `NEXT_PUBLIC_CHAIN_ID=11142220` y **le gana a `.env.local`**, apuntando a
  Sepolia sin avisar. Para correr limpio sin tocar el shell:
  `env -u NEXT_PUBLIC_CHAIN_ID -u NEXT_PUBLIC_BADGES_ADDRESS -u NEXT_PUBLIC_SCOREBOARD_ADDRESS pnpm -C apps/web <cmd>`
- **`lsof -ti:3000` debe salir vacío** antes de VR o E2E.
- El **play hub** solo se monta con `NEXT_PUBLIC_CHESSCITO_MODE=play` (flag de build).

## Higiene de comandos (evita prompts de permiso)

- **Nunca prefijes con `cd`.** Usá `git -C <ruta>` y `pnpm -C <ruta>`.
- **Un comando por llamada.** Sin pipes, sin `;` encadenados, sin heredocs.
- Typecheck con `pnpm exec tsc --noEmit` pelado.
- Archivos temporales: la tool Write, nunca `>` (zsh tiene `noclobber`).

## Reglas que estas sesiones ganaron a golpes

- **Contar `role="dialog"` en un test deja pasar modales apilados.** `LabyrinthCompleteOverlay`
  usa `role="alert"`. Contar **`[aria-modal="true"]`**. Esto escondió dos diálogos apilados en
  el momento del badge de TODOS los jugadores, con la suite verde.
- **Dos suites aisladas verdes no prueban su composición.** Confirmado a lo grande en #214: con
  4900+ tests en verde se escondían celebración doble, un CTA al producto equivocado, un regalo
  des-reclamándose solo, y una corona de maestría sobre una pieza jamás minteada. Cada
  componente era correcto **solo**.
- **Un componente que cachea storage al montar se pudre.** Pasó con los shields (#213) y otra
  vez con el welcome-package (#214). Si algo nuevo escribe un storage compartido, **todo lector
  necesita un event bus** — escribir y NO notificar es un no-op disfrazado de fix.
- **Persistir ANTES de renderizar.** Mostrar una celebración es consecuencia de haberla
  registrado, nunca al revés.
- **Un test que pasa por el motivo equivocado no es un guard.** Un mock de `useAccount` sin
  `status` hacía que un gate nuevo nunca se evaluara; el test pasaba por otra razón.
- **Una constante duplicada en dos sistemas que deben coincidir es un bug en espera.**
- **Un flujo opcional no puede tener estado terminal de cancelación.** Cancelar es un no-op.
- **El entorno miente antes que el código.** Rojo masivo → sospechar del entorno.
- **La VR no protege la tipografía.** Los fixtures viven bajo `/dev` y nunca cargan
  Rowdies/Fredoka. **Decisión del founder (2026-07-11): dejarlo así.**

## Qué NO tocar todavía

- **No abrir el Belt System** hasta que cierren MiniPay/slides.
- **Nunca construir recovery para el Daily-Streak.** El shield protege el COMBO.
- **No implementar server-verified progress con umbral proporcional evaluado en vivo** — des-
  califica retroactivamente. Bit monótono `qualified(player, piece)`.
- **No tocar el *Try Again* de `timeout`** sin medir: la tx ya se firmó y transmitió.
- **No renombrar `first-focus-day`.** Mide constancia y es correcto; `first-great-session` mide
  profundidad y es un logro aparte. Renombrar revocaría un badge ya ganado.

## Trade-offs aceptados (no re-litigar sin el founder)

- `first-focus-day` y `first-great-session` **comparten el icono** `1day-focus`. Aceptado hasta
  encargar arte.
- En **cadena no soportada** no hay celebraciones hasta volver a la correcta. Nada se pierde.

## Si el usuario dice…

- **"continuemos"** → leer este archivo + el handoff, y arrancar por el punto 1.
- **"qué falta"** → `docs/backlog/2026-07-10-backlog-index.md`.
