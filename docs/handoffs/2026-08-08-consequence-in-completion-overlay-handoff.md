# Handoff — el Paso 1 cerró, y el playtest lo corrigió en caliente

**Fecha:** 2026-08-08 · **Rama:** `main` (local, **sin push** — lo hace el founder)
**Base:** `c2e64ab8` → **HEAD `c641a1ee`** · 12 commits

> ⚠️ Este doc **reemplaza** la versión que se escribió a media sesión. Aquella daba el VR
> como "0 failed", que era falso. Ver *"La corrección que más importa"*.

---

## Qué se cerró

El **Paso 1** del brief de visibilidad de progreso: el overlay de completado entrega, además
del **momento**, la **consecuencia** — qué cambió en la pieza por haber hecho esto. Cero taps,
cero pantallas nuevas.

| Slice | Qué | Dónde |
|---|---|---|
| **1A** | El resolver puro | `lib/training/consequence.ts` |
| **1B** | La línea en el overlay de desafío + baseline | `labyrinth-complete-overlay.tsx` |
| **1C** | La línea en el flash de ejercicio + 2 baselines | `PhaseFlash` en `mission-panel-candy.tsx` |
| **+** | Tres arreglos salidos del playtest | ver abajo |

**La escalera final** (cuatro peldaños, no cinco): `mastery` > `challenge_unlocked` >
`badge_progress` (carril de ejercicios, contra el **gate**) / `lane_progress` (carril de
desafíos, contra el **carril**). El piso lo elige el **carril del nodo completado**.

---

## Verificación final — los números reales

| Qué | Resultado |
|---|---|
| Unit completa | **612 archivos / 7544 tests**, `VITEST_EXIT=0`, **0 `Unhandled Errors`** |
| VR (`visual-regression.spec.ts`) | **66 passed**, `PLAYWRIGHT_EXIT=0`, con `--update-snapshots=none` |
| `tsc --noEmit` | limpio |
| Resto del proyecto `minipay` | **82 rojas — PREEXISTENTES, confirmado** |

### La corrección que más importa

⛔ **Durante 1B y 1C reporté "178 passed / 14 skipped / **0 failed**, exit 0". Era falso: había
82 fallas.** Los mensajes de commit `1f4bc4c9` y `b3e7ccf2` llevan ese número mal.

Tres errores encadenados, y los tres se repiten fácil:

1. **Corrí de más.** `--project=minipay` son **274 tests** (smokes, share, surfaces…). El
   baseline documentado del repo —62/62— es del **archivo `visual-regression.spec.ts`**.
   ✅ El comando correcto es:
   `playwright test visual-regression.spec.ts --project=minipay --update-snapshots=none`
2. **Leí de menos.** Miré `tail -6`, que mostraba `14 skipped` / `178 passed`. La línea
   `82 failed` estaba más arriba, y mi grep de fallas no matcheaba su formato.
3. **Cité el exit code equivocado.** El "exit 0" venía del **wrapper de bash**, no de
   Playwright. Con `cmd > log; echo "EXIT=$?"` sí es el de Playwright; con un pipe a `tail`,
   es el de `tail`.

### Cómo se probó que las 82 son preexistentes

No por inferencia — los smokes de torre y alfil manejan **la pantalla de ejercicios**, que se
tocó tres veces hoy, así que estaban dentro del radio de explosión.

| Corrida | Resultado |
|---|---|
| Smokes en base `c2e64ab8` | 15 failed / 4 passed |
| Smokes en HEAD | 17 failed / 2 passed |
| Diff de nombres | 2 tests de torre, sólo en HEAD |
| Esos 2, aislados en HEAD ×3 | **6 passed, exit 0** → flakes |

⚠️ Ese spec falla **15 de 19 en la propia base**. El resto del proyecto `minipay` nunca fue
verde en local, y CLAUDE.md ya dice que **CI no corre Playwright**. Nadie lo había mirado;
ahora hay un número.

---

## Los seis hallazgos que valen más que el código

### 1. ⛔ El AC-5 original era inimplementable

Pedía detectar "todos los nodos en `locked`": estado **imposible** (`path.ts:130`) e
**indistinguible** de un jugador temprano. Reemplazado por el **guard de snapshot rancio** —
un intento completa exactamente **un** nodo jugable; cero o ≥2 → `null`.

### 2. ⛔ La baldosa del hub NO reclama

Sólo hace `router.push('/exercises?piece=…')` (`learn-hub-client.tsx:415`). El botón **Claim
Badge** vive en el drawer de Exercises (`exercise-drawer.tsx:620`).
➡️ **El Paso 2 hereda trabajo no contado**: para que la baldosa ofrezca la acción, hay que
ponérsela.

### 3. ⛔ Una baseline verde de la pantalla EQUIVOCADA

`page.tsx` de `/dev/exercises-popups` tenía una **segunda allowlist** que no acompañaba la
unión del fixture, y el render casteaba `as never`. El variant nuevo cayó al default y la
baseline fotografió `PieceCompletePrompt` **en verde**, bajo el nombre del test nuevo.
**Se detectó sólo al abrir el PNG.** Ahora la allowlist está tipada con la unión.

### 4. ⛔ El spec mandaba 1C al archivo equivocado

Decía `result-overlay.tsx`; ese maneja resultados de **transacción**. La superficie real es
**`PhaseFlash`**. Cablearlo donde decía habría puesto la consecuencia en una pantalla que el
jugador ve **después de firmar**.

### 5. ⛔ Las estrellas NUNCA desbloquearon la insignia — y dos textos lo decían

Playtest: cruzó el gate, el modal dijo *"Badge Ready to Claim"*, lo cerró, y el prompt
siguiente dijo *"Keep pushing. More stars unlock your badge!"*. **Dos superficies, un
instante, afirmaciones opuestas.**

El bug de fondo no era el texto: era **la rama**. El subtítulo forkeaba en `hasClaimedBadge`
(**reclamada**), así que "ganada pero sin reclamar" caía en "todavía no llegaste". Ahora hace
las dos preguntas (`hasEarnedBadge`).

### 6. ⛔ `badge_ready` sobraba: ese momento ya tenía su modal, **con botón**

El milestone `piece-badge-eligible` dispara con **la misma condición**
(`milestones.ts:82-96`, sin wallet) y trae el **Claim** de verdad. Mi peldaño anunciaba lo
mismo un instante antes, sin nada que tocar. **Eliminado.**

⚠️ Esto corrige el **argumento** de M8/OQ-1, no su conclusión: se discutió "¿conviene un CTA
de claim?" sobre una premisa falsa — **el botón ya existía**. No hay CTA nuevo, pero la razón
correcta no es "una transacción arruinaría la celebración", es **"esa celebración ya estaba
hecha"**.

> 🎯 **Lección de método:** antes de diseñar el momento de un evento, **buscar quién más
> escucha ese evento**. `milestones.ts` estaba a un grep de distancia.

---

## Lo que queda abierto

### 1. 🔴 **#3 — la X que no cierra: arranca otra pieza** · DECISIÓN DEL FOUNDER

`result-overlay.tsx:758-762`: sin laberinto pendiente, `handleDismiss = onNextPiece`. Cerrar
el prompt del alfil **te deposita en el caballo**, abandonando una insignia que el mismo panel
te acaba de decir que está lista.

El comentario dice que fue para evitar el "stuck on the last level". Las opciones:
cerrar y **quedarse en la pieza**, o cerrar y **volver al hub**. **No se tocó** — es cambio de
navegación, y la decisión es de producto.

### 2. 🔴 Sin wallet, el botón Claim **no hace nada, en silencio**

`handleClaimBadge` (`exercises-screen.tsx:2092`) hace `return false` si no hay `address` /
`isConnected` / `isCorrectChain`. Sin error, sin prompt de conectar. El botón **se renderiza
igual** (`badgeClaimable` no mira la wallet).

⚠️ Era latente; el Paso 1 ahora **manda tráfico ahí**. Preexistente, pero lo empeoramos.

### 3. ⭐ OQ-2 sigue abierta donde ninguna suite llega

`lane_complete` dice *"your badge is waiting in Exercises"* **sin botón**. La prueba es
humana: llevar a alguien al 8º ejercicio, dejarlo tapear, y preguntarle *"¿qué te pasó y qué
harías ahora?"*.

### 4. Minas señaladas, no tocadas

- `editorial.ts:130` `badgeLockedFormat: "Badge at {stars}★"` — **cero consumidores**, misma
  regla falsa que se acaba de arreglar. Esperando a quien lo cablee.
- `wallet-branch-lazy.test.tsx` — **flake** confirmado (aislado 8/8; falló una vez en suite).
- Sally (`absolute -right-2 bottom-12 h-24 w-24`) tapa **los últimos ~88px** de una segunda
  línea en `PieceCompletePrompt`. Anotado junto al string; el copy se acortó para esquivarla.

### 5. El CTA diferido ya existe — falta portarlo

`PhaseFlash` arma el tap **550 ms después** del reveal (`awaitTap` + `tapArmed`) y retiene
600 ms de `entryBeat`. **El overlay de laberinto no tiene ninguna de las dos.** Portar, no
inventar. → `docs/backlog/2026-08-08-overlay-juice-and-claim-wayfinding.md`

---

## Estado del árbol

- `main` local, **12 commits sin pushear**. El push lo hace el founder.
- ⚠️ `apps/web/rook-rails-shots/` sin trackear y **no es de esta sesión**. No se tocó.
- ⛔ **Ningún deploy verificado** — es tarea del founder por regla vigente.
- ⚠️ Durante la sesión se imprimió un `VERCEL_OIDC_TOKEN` en terminal (un `pgrep -fl` vuelca
  el environment). Es de vida corta y rota solo; **usar `pgrep -f`, nunca `-l`**, en este repo.
