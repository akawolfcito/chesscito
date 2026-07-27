# Red Team Review — Focus Days 21-en-30

**Date**: 2026-07-27
**Reviewer mindset**: QA hostil + ingeniero senior que ya vio este número mentir una vez

## Findings

### P0 — Must address before implementation

- ~~**[migración] La salvaguarda del backfill cuenta un `SELECT`, no el `UPDATE`.**~~
  **RESUELTO (revisión 2026-07-27).** El `.sql` ahora hace `UPDATE ... RETURNING` dentro de un CTE
  cuyo resultado alimenta la tabla de rollback, y la salvaguarda cuenta **esa** tabla. Lo que se
  guarda para revertir es, por construcción, exactamente lo que se modificó; y el conteo mide la
  escritura, no una lectura anterior con otro `now()`. Se agregó además la verificación (d):
  cero filas con delta distinto de 9 días.

- ~~**[contrato] El spec le atribuye al typecheck una protección que no puede dar.**~~
  **RESUELTO (revisión 2026-07-27).** La sección de contratos ahora dice explícitamente que el
  borrado de `durationDays` sólo **enumera** los call sites y que distinguirlos es imposible para
  el compilador (ambos `number`). La red real pasó a ser AC2–AC6: un test de discriminación por
  consumidor (`verify-payment`, `status`, `focus-day` ×2, `SeasonChallengeMeta`/tarjeta, oferta),
  con la regla de que **intercambiar los dos valores debe poner rojo al menos un test de cada
  uno** — y esa verificación por mutación es parte del criterio, no una sugerencia.
  Se descartó el branding de tipos: más ceremonia que los tests, y no cubre la copy.
  Nota añadida al spec: si algún día 21 y 30 coincidieran, estos ACs dejan de discriminar.

- ~~**[datos] El spec no verificó si el backfill recontextualiza filas de ledger ya escritas.**~~
  **RESUELTO el 2026-07-27, con dos hallazgos** (consulta read-only sobre producción):
  1. `focus_day_ledger` tiene **0 filas** para las tres wallets. No hay progreso que reinterpretar.
  2. Más importante: **el `windowStart` ni siquiera se mueve.** `(expires+9) − 30 = expires − 21`,
     verificado fila por fila. El hallazgo dio vuelta un **error del spec**, que en Edge cases
     afirmaba que quedaría 9 días antes — eso vale sólo para el transitorio entre deploy y backfill.
  3. Bonus no buscado: una de las tres ya **latcheó** `focus_ledger_init` con 0 filas escritas.
     El latch es único por wallet; si hiciera falta re-inicializarla, se borra esa fila
     (no se arregla con redeploy). El spec lo incorpora.

### P1 — Should address

- ~~**[comportamiento] Ningún caso de `unreachable` toca el borde.**~~ **RESUELTO**: Behavior 5b +
  **AC7** fijan los dos casos pegados (`owed === daysRemaining` ⇒ alcanzable): 12/21 con 9 ⇒ `false`,
  con 8 ⇒ `true`. Cambiar `>` por `>=` ahora pone rojo.

- ~~**[comportamiento] No está definido qué pasa después de completar 21 con acceso restante.**~~
  **RESUELTO, y con decisión de producto explícita**: Behavior 6b + **AC8**. `completed` es terminal
  y **el POST se cierra con él** — los días 22–30 son margen para completar, no días registrables
  después de completar. Un POST posterior responde éxito idempotente sin escribir. Elegido sobre la
  alternativa (dejarlo abierto) porque acumular filas que la tarjeta clampa es progreso invisible,
  exactamente lo que Stage 2 vino a eliminar. AC8 lo verifica **contando filas**, no por status code.

- ~~**[copy] El SKU y el `seasonId` dicen "21" y el spec no verificó si alguna superficie los
  muestra.**~~ **RESUELTO por medición**: `lite_season_pass_21` aparece en un solo componente
  (`season-pass-sheet.tsx:30`) y sólo como clave de lookup y parámetro del rail; `seasonId` no
  llega a ningún componente ni a los bundles de mensajes. Behavior 10 + **AC11** lo fijan con un
  test para que siga siendo cierto.

- ~~**[migración] El spec no dice en qué ORDEN corren deploy y backfill.**~~ **RESUELTO**: el spec
  ahora tabula los dos transitorios y elige deploy → backfill, con la razón (sobreestimar un techo
  no escribe filas de más; subestimarlo puede rechazar una fecha legítima).

- ~~**[operacional] No hay logging ni observabilidad para el cambio.**~~ **RESUELTO**:
  §Observabilidad + **AC12** (log estructurado del status con las dos constantes, `completed`,
  `daysRemaining` y `state`; wallet hasheada) y **AC13** (test de contrato que falla si la
  temporada deja de ser 21/30). Uno responde "¿qué está pasando en prod?"; el otro impide que la
  constante cambie en silencio.

### P2 — Nice to clarify

- **[naming]** `accessDurationDays` vs `challengeGoalDays` son buenos nombres, pero `ProPack`
  conserva `durationDays`. Dos tipos vecinos con convenciones distintas invitan a copiar el
  campo equivocado.
- ~~**[test]** AC9 fija `focusDaysProgress(24, 21)`, que no es el extremo.~~ **RESUELTO**: AC9 pasa
  a `focusDaysProgress(30, 21)` — el máximo real con ventana de 30.
- ~~**[VR]** AC10 depende de `--update-snapshots` con el umbral global.~~ **RESUELTO**: AC14 fija
  `0.002` explícito y exige re-baselinear **borrando el PNG**, con la razón (el 2026-07-27 un
  re-layout completo de una fila entró bajo 0.01 y el baseline viejo quedó en su lugar, en verde).

## Categories audited

### Contract gaps
Sin `any` ni `unknown`. El hueco no es de forma sino de **significado**: dos `number` intercambiables
(P0 #2). Los tipos de error no cambian y no hace falta que cambien: este spec no introduce modos de
falla nuevos, sólo mueve una constante.

### Behavioral ambiguity
El borde de `unreachable` (P1) y el post-`completed` (P1) son los dos huecos. No hay condiciones de
carrera nuevas: el POST y el GET ya se ordenan con el `refreshToken` de Stage 2.

### Hidden assumptions
- **Asume que `21day-mind-challenge-2026-q3` es el único seasonId vivo.** Cierto hoy
  (`rail-config.ts:151`), y el filtro lo nombra explícito, así que la suposición está contenida.
- **Asume que la fecha de compra no existe en `lite_season_passes`.** Verificado: la tabla expone
  `expires_at, season_id, supporter_status, shields_credited` (`read-season-pass-row.ts:12-17`).
  Por eso el `UPDATE` suma 9 días en vez de recalcular. Bien razonado.
- ~~Asume que el ledger no reinterpreta filas viejas~~ — **verificado**: 0 filas, y el `windowStart`
  no se mueve. Ver P0 #3.

### Backward compatibility
Sin compatibilidad legacy por decisión explícita del founder, con la evidencia que la sostiene
(0 compradores reales, verificado read-only). Es la parte más sólida del spec: la decisión se tomó
**después** de medir, no antes.

### Security & data
El backfill no imprime wallets (usa `left(md5(wallet),8)`), no toca credenciales y no borra filas.
El `UPDATE` está en transacción con aborto por conteo. Sin RLS involucrada (service role, server-side).
Nada que objetar salvo P0 #1.

### Test coverage gaps
AC1–AC14 son testeables, y AC2–AC6 traen su propio criterio de validez (la mutación que los pone
rojos). **Hueco que queda**: Behavior 9 (rango de fechas del backfill inicial ensanchado a 30) sigue
sin AC propio. Es P2 hoy porque el ledger de las tres wallets está vacío, así que no hay nada que
el rango pueda sembrar mal — pero deja de ser inofensivo en cuanto alguien complete días.

**Contradicción encontrada en revisión 3 y corregida** (la marcó el founder, no esta revisión):
el Edge case `completed > goal` seguía diciendo que el jugador "puede registrar hasta 30 días" y que
"el ledger sí guarda las 24 filas". Era texto anterior a Behavior 6b/AC8, que cierran el POST al
llegar a 21, y quedó contradiciéndolos. Reescrito: el flujo normal permite **como máximo 21 filas**
por wallet y season, y el clamp de presentación es **defensa** ante datos históricos, fixtures o
concurrencia. Verificado además que el **otro** escritor —el backfill inicial— ya está capado por
`goal` (`Math.min(streak, elapsed, goal)`, `focus-days.ts:188`), así que ningún camino llega a 30
filas. AC4(b) y AC9 pasaron a nombrar sus fixtures como defensivos.

*Lección de proceso*: la contradicción nació de **agregar** comportamiento (6b/AC8) sin releer los
Edge cases escritos antes. Un spec editado por partes necesita una pasada de coherencia al final,
no sólo en las secciones tocadas.

### Operational readiness
Rollback del backfill: tres niveles (transacción, temp table alimentada por el `RETURNING`, valores
transcritos). ~~Rollback del código: no mencionado.~~ **RESUELTO**: §Rollback coordinado tabula los
dos estados mixtos y fija la regla — código y datos se revierten juntos o no se revierten.
Observabilidad: cubierta por AC12/AC13.

## Verdict

**READY for /tdd** — 0 P0 abiertos, 0 P1 abiertos, 1 P2 abierto.

**Revisión 2 (2026-07-27)**: los 3 P0 quedaron cerrados (uno durante la primera revisión, dos en
esta), y los 4 P1 también. Lo único vivo es un P2 de convención de nombres (`ProPack` conserva
`durationDays` mientras `SeasonPass` pasa a dos campos) y el hueco de cobertura de Behavior 9,
anotado arriba: inofensivo hoy porque el ledger de las tres wallets está vacío.

Lo que cambió el diseño no fue el diseño sino **qué se considera prueba**:

- la salvaguarda del backfill pasó de medir una lectura a medir la escritura (`RETURNING`);
- la protección contra confundir los dos números pasó del compilador —que no puede darla— a
  tests de discriminación con su propio criterio de validez (la mutación tiene que ponerlos rojos);
- tres afirmaciones que el spec daba por obvias se verificaron contra producción o contra el
  código, y **una salió al revés** (el `windowStart` no se mueve).

### Condiciones antes de `/tdd`

1. El backfill **no se corre** hasta que el código de 30 días esté desplegado (orden fijado en el
   spec: deploy → backfill, minutos de diferencia).
2. AC2–AC6 se escriben **antes** que la implementación, y se valida la mutación (intercambiar los
   dos valores debe romper al menos un test por consumidor). Si la suite queda verde con los
   valores intercambiados, los ACs no sirven y hay que arreglarlos antes de continuar.

### Nota sobre el proceso

P0 #3 se resolvió con una consulta read-only de dos minutos y **encontró un error en el spec** (el
Edge case del `windowStart` estaba al revés) más un hecho que nadie había pedido (una wallet con el
init ya latcheado y cero filas). Confirma la postura que el founder impuso al principio de esta
ronda: medir antes de asumir, incluso cuando la suposición parece obvia.
