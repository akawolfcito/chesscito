# Handoff — Release de scores + spec de la ventana weekly

**Fecha:** 2026-07-27 (noche)
**Branch:** `main` (docs locales) · `production` fast-forwardeado a `87e35e35`, sin pushear
**Specs:** `docs/specs/2026-07-27-leaders-weekly-window{,-redteam}.md`
**Sesión previa:** `docs/handoffs/2026-07-27-score-write-path-handoff.md`

---

## 1. Qué se hizo

### El smoke pasó — el write path de scores está validado en device

Firmar una vez, **cerrar MiniPay del todo**, reabrir y hacer un ejercicio → ya no vuelve a
pedir firma. Era exactamente lo contrario de lo que pasaba antes de `87e35e35`. El token
persistido en `localStorage` hace lo que prometía, y el bug del cleanup al desmontar
(ir al Hub y volver costaba una firma) no reapareció.

### Release preparado hasta el paso 4 de 6

Pre-flight completo contra `docs/release/release-process.md` §6:

| Ítem | Estado |
|---|---|
| Commits del cluster en `origin/main` | ✅ los 8, `d7691e31..87e35e35` |
| Árbol limpio | ✅ |
| Suite verde local | ✅ **543 archivos / 6284 tests, EXIT=0** |
| Secretos en el diff | ✅ ninguno (27 archivos: routes, libs, 2 migraciones, docs) |
| Handoff escrito | ✅ el de la sesión previa |
| VR | n/a — el cluster es API/hooks, no toca superficie visual |

Ejecutados los pasos 2, 3, 4 y 6. **El paso 5 (`git push origin production`) es del
founder** y está pendiente.

**Un ajuste deliberado:** el fast-forward se hizo a `87e35e35` (= `origin/main`), **no** al
`main` local, que tenía commits de docs sin pushear. El proceso prohíbe deployar un commit
que no pasó por `origin/main` primero (§4.4), y esos commits no cambian nada del deploy.

### Tres pendientes del handoff previo, cerrados sin código

- **Ignored Build Step**: funcionando, según el founder. No se toca.
- **"Solicitado por: Mini App Test"**: es del **visor de MiniPay** con el que se prueba, no
  del registro de la Mini App ni del repo. **No hay nada que corregir** — y no era un
  pedido del founder. La tarea sale del backlog.

### Spec + red-team de Slice 2 (ventana weekly)

Escritos según el ciclo del proyecto. Decisiones del founder incorporadas al spec:

- **Semana**: lunes 00:00:00 UTC → lunes siguiente, **half-open** (`>= start AND < end`).
  Sin rolling window, sin timezone por jugador. La UI puede localizar la fecha; el cálculo
  y el reset quedan en UTC.
- **Weekly convive con all-time**, selector en la sheet, weekly por defecto.
- **Desempate**: quién llegó primero a ese puntaje, no la dirección de wallet (mata R4).
- **Weekly es off-chain-only** — decisión del founder y la mejor del día: el carril
  off-chain ya exige sesión autenticada y revocable (Slice 0), pero `/api/sign-score` y
  `/api/cache-score` siguen con el defecto R1. Un ranking nuevo no debe nacer con la deuda
  de seguridad que acabamos de sacarnos de encima. La asimetría queda **documentada como
  deliberada y temporal**, no descubierta después.
- **Sin actividad esta semana**: el footer se vuelve CTA, sin rank inventado, conservando
  la altura para que cambiar de tab no salte. Copy EN/ES en el spec.

---

## 2. El hallazgo que cambió el plan (red-team P0-1)

**Verificado en código, no inferido:**

- `api/scores/save/route.ts:191` — `const gameId = String(score)`
- `:192` — `deriveScoreSaveId(wallet, levelId, gameId)`
- `20260609000000_score_saves_init.sql:54` — `save_id text not null unique`
- `lib/scores/save-client.ts:123-127` lo dice explícito: *"re-saving the same score is
  idempotent (`duplicate`), a higher score is a fresh row"*

O sea: **existe una fila por cada `(wallet, level_id, score)` alcanzado alguna vez**, y
`created_at` significa *"la primera vez que lograste ese puntaje exacto en ese nivel"* —
no "jugaste esta semana".

Tres consecuencias que rompen el objetivo del slice:

1. **El veterano desaparece para siempre.** Con **6 niveles** (`level_id between 1 and 6`,
   no 59 ejercicios), llegar al techo es el estado final esperado de cualquier jugador
   enganchado. Ahí deja de escribir filas: juega toda la semana y no rankea. La tabla
   semanal mostraría casi solo recién llegados.
2. **No es monótona en habilidad.** Repetir tu mejor marca no escribe nada (`duplicate`),
   así que no entra en la ventana. Sacar un puntaje **peor** que nunca hubieras sacado sí
   escribe fila y sí entra. Jugar mejor puede darte cero esa semana; jugar peor te da
   puntos.
3. **R3 sobrevive al fix que lo iba a matar.** La ventana mediría *inventario nuevo* —
   sigue siendo inventario, ahora con penalización estructural por haberlo conseguido antes.

**Por qué era bloqueante y no un detalle**: los 16 acceptance criteria del spec pasarían
en verde con la feature fallando su propósito. Los tests habrían **certificado** el
defecto. Ese es el peor resultado posible de un spec.

**Decisión del founder: Slice 3 (identidad de intento) primero.** Deja de ser el
"siguiente slice" y pasa a ser **precondición** de Slice 2. La auditoría ya lo llamaba
"el único hueco estructural"; este hallazgo dice que además es portante.

El spec de Slice 2 quedó marcado `⛔ BLOCKED` en su header, con la causa y el camino de
salida, para que nadie lo mande a `/tdd` por inercia.

---

## 3. Lo que sobrevive de Slice 2

No hay que tirar el spec. Cuando Slice 3 esté, se revisa sobre él y **sobreviven**: la
definición de semana UTC half-open, la semántica del desempate, la asimetría
off-chain-only, los estados de UI con sus transiciones, y la compatibilidad hacia atrás
del endpoint (las formas legacy quedan byte-idénticas). **Lo único que cambia es la
fuente de filas que leen.**

Los P1 del red-team quedan pendientes para esa revisión: `hasOnchain?` no puede expresar
"no aplica" (hace falta un tipo discriminado por ventana), el fallback de la vista
calcularía su propia semana y divergiría del RPC en el borde, `hasFetched` es un solo ref
para dos tabs, y la fila optimista de `sessionStorage` fabricaría un rank justo para los
jugadores que el CTA quiere atender.

---

## 4. Verificación ejecutada

- Suite completa: **543 archivos / 6284 tests, EXIT=0** (leída de la cola del log, no del
  exit code de un pipe).
- Diff `production..main` auditado archivo por archivo: sin `.env`, sin `private/`, sin
  credenciales.
- Las cuatro afirmaciones del spec sobre el esquema, verificadas contra las migraciones:
  `created_at not null default now()`, `score > 0`, `level_id between 1 and 6`,
  `save_id unique`.
- **No ejecutado**: nada contra la DB de producción. El P0-2 pide medir las 132 filas
  reales (cuántas wallets ya están en su techo) y **está sin medir** — es la primera
  evidencia que pide el spec de Slice 3.

---

## 5. Próximos pasos

1. **`git push origin production`** (founder) — paso 5 de 6.
2. **Spec de Slice 3.** Tres decisiones antes de tocar código: cómo cambia `save_id` sin
   romper el dedup que sostiene el `MAX(score)` del leaderboard; **retención**, porque el
   volumen pasa de acotado a uno por intento; y qué campos entran (`attemptIndex`,
   `hintsUsed`).
3. **Medir P0-2 contra prod** — insumo del spec de Slice 3.
4. Revisar Slice 2 sobre Slice 3.

---

## 6. Gotchas de esta sesión

- **`pnpm -C` no existe en pnpm 8** (ni `--dir` en este workspace): falla con
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL: Command "-C" not found`. La suite se corre con
  `pnpm --filter web test`. CLAUDE.md recomienda `-C` para matchear la allowlist — sirve
  para `git`, no para `pnpm` acá.
- **El script es `test`, no `test:run`.**
- **zsh `noclobber`, otra vez y peor**: `>` sobre un log existente falla **antes** de
  ejecutar el comando, así que el comando ni corre y uno termina leyendo el log de la
  corrida anterior y reportándolo como nuevo. Un nombre de archivo nuevo por corrida.
- **Un exit code 0 puede ser del `tail`, no de la suite.** Correr, redirigir, y leer el
  archivo — nunca confiar en el exit de un pipe.
