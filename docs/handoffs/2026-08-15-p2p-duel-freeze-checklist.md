# Qué falta para dar el duelo p2p por cerrado y congelarlo

**Fecha:** 2026-08-15
**Spec:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md`
**Spec de UI:** `docs/specs/2026-08-15-duel-arena-ui-states-spec.md`
**Estado:** las cinco etapas construidas · **28 commits sin pushear** · nada deployado

---

## 0. El estado, en una línea

**El código está entero y verde; el producto todavía vive en una sola laptop.**

Suite 685 archivos / 8433 tests, `EXIT=0`. VR 67/67 sin grabar baselines. `tsc` limpio. La
tabla `duels` está aplicada en producción. **Pero `origin/main` no sabe nada de esto.**

---

## 1. ⛔ Lo que BLOQUEA el congelamiento

### 1.1 Nada está deployado

28 commits locales, 24 del duelo. Congelar algo que existe en un solo disco no es congelarlo.
**El push lo hace el founder**, así que esto es una decisión, no una tarea.

### 1.2 Cuatro cosas construidas HOY que nadie vio funcionando

El último playtest fue **antes** de:

| qué | cómo verificarlo |
| --- | --- |
| El **intro** al arrancar la partida | Los dos dispositivos deberían ver el matchup 1.8 s al hacer JOIN |
| La **celebración de fin** | Ganar, perder y hacer tablas: cada lado debe leer SU resultado |
| El **reloj congelado** al tocar | El número ya no debería dar el respingo hacia arriba |
| El **lobby con imágenes** | En `/es/` deberían rotar tus tres; en `/en/` también, ahora que las cargaste |

⚠️ Y el arreglo del lobby fue de un bug que hacía imposible el respaldo al tablero. **Confirmar
que con un slot vacío se ve el tablero** es tan importante como ver la imagen.

### 1.3 Casos del spec que nunca se ejercitaron en vivo

Están probados por unidad, no jugados:

- [ ] **Promoción de peón** — llevar un peón a la última fila, elegir pieza, y probar **cancelar**
- [ ] **Las cuatro tablas** — al menos ahogado y repetición triple
- [ ] **`version-conflict`** — los dos mueven casi a la vez; el perdedor ve el tablero real
- [ ] **Espectador** — un tercer contexto abre el enlace con la partida empezada: sólo lectura
- [ ] **Invitación vencida** — dejar pasar la hora sin que nadie entre → `expired`, sin ganador
- [ ] **`seat-taken`** — dos invitados tocan JOIN a la vez

---

## 2. Deuda ACEPTADA (se documenta, no se arregla)

| qué | por qué se acepta |
| --- | --- |
| **`invitedBy` siempre `null`** | No hay identidad verificable server-side. Tomarla del body sería el defecto de la v2 con otro nombre. El día que se premie a quien invita, primero hay que verificar sesión |
| **`purge_duels` sin llamador** | No urge: no hay volumen, y el default de 7 días es 80× la vida de un duelo |
| **Sin revancha** | Non-goal del spec. La salida al selector deja un duelo nuevo a un toque |
| **El invitado sin allowlist queda en un callejón** | Heredado, y es el camino que este feature estrena. No es del duelo pero lo destapó el duelo |
| **Tablero bloqueado sin señal para lectores de pantalla** | Preexistente, lo tiene también la arena de la IA. Es su propio cambio |
| **Las piezas no se deslizan** | Decisión del v1 |

---

## 3. Lo que hay que saber de operación

⚠️ **El poll es el único costo que escala.** Un duelo de 10 min con los dos jugadores son ~450
requests; mientras se ESPERA el poll baja a 1,2 s, así que una invitación abandonada la hora
entera son ~3.000 requests. Acotado por la expiración, pero es el número a mirar si algún día
hay volumen. La palanca barata: espaciar el poll cuando no es tu turno.

⚠️ **Infra: nada nuevo.** Vercel + Supabase + el Upstash que ya existe. Sin WebSocket, sin cron,
sin cola — la bandera cae al leer, por diseño.

⚠️ **El VR está verde AHORA** (67/67, sin grabar). Cualquier cambio de CSS del duelo obliga a
re-correrlo: `--project=minipay --update-snapshots=none`, con el dev server bajado o en otro
puerto (`BASE_URL=http://localhost:3007`).

---

## 4. El Cluster Closure Protocol (CLAUDE.md), aplicado

Cuando el playtest cierre y se pushee:

1. **GitHub** — cerrar issues del cluster p2p; milestone si corresponde
2. **README** — la sección "What's live" no menciona el duelo
3. **MEMORY.md** — el índice todavía apunta al estado de la Etapa 3
4. **Branches** — nada que limpiar: todo se hizo en `main` local
5. **Handoff final** — reemplaza a `2026-08-15-p2p-duel-stage-5-handoff.md`

⚠️ Y los docs del duelo están desactualizados respecto de los últimos ~10 commits: el plan dice
Etapa 5 cerrada pero no menciona el intro, la celebración, el lobby ni el piso de 3 minutos.

---

## 5. La secuencia que recomiendo

1. **Un playtest más** con la lista de §1.2 y §1.3 — es lo único que no puede hacer la suite
2. Arreglar lo que aparezca
3. **Push + deploy**
4. **Verificarlo en el deploy** (una partida real entre dos teléfonos, sobre el dominio real)
5. Recién ahí: docs, memoria, GitHub, y congelar

⛔ **Congelar antes del paso 4 sería congelar algo que nunca corrió fuera de un túnel.**
