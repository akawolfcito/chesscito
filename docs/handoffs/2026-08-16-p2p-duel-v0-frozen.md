# P2P DUEL V0 — FROZEN

**Fecha de congelamiento:** 2026-08-16
**Reemplaza a:** `docs/handoffs/2026-08-15-p2p-duel-stage-5-handoff.md`
**Spec:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md`
**Spec de UI:** `docs/specs/2026-08-15-duel-arena-ui-states-spec.md`
**Cierre pedido en:** `docs/handoffs/2026-08-15-p2p-duel-freeze-checklist.md`

> **Qué significa congelado.** P2P deja de estar en desarrollo. No se le agregan features. La
> deuda está escrita con su razón y su disparador. Lo que sigue después está listado al final, y
> **no** es más P2P.

---

## 1. Lo que se envió

Un jugador de PLAY comparte un enlace; otro que ya tiene acceso lo abre, ocupa el asiento libre,
y juegan una partida entera arbitrada por el servidor.

| pieza | qué quedó |
| --- | --- |
| **Entrada** | Cuarta tarjeta *"A friend"* en el selector de rival, **detrás de una puerta** |
| **Reloj** | Escalera de 5 peldaños — **3 · 5 · 10 · 15 · 30 min**, default 10 |
| **Intro** | El matchup de la Arena, 1,8 s, al arrancar la partida — para los dos jugadores |
| **Lobby** | 3 imágenes por idioma que rotan cada 6 s mientras nadie contesta; **sin imagen, el tablero** |
| **Final** | Celebración propia sobre `VictoryPopupShell`, con el resultado del lado de quien lee |
| **Salida** | *"Nuevo duelo"* al selector. **Sin revancha** — non-goal del spec |

### El piso del reloj es 3 minutos, y es una medición

Se subió desde 30 s después del primer playtest. El reloj arranca cuando el segundo jugador se
sienta, pero el que tiene el turno recién se entera en su siguiente lectura y después mira el
intro. A 30 s eso era **un cuarto de la partida**; a 3 min es **menos del 2%**.

⚠️ La tabla sigue aceptando los siete valores originales: ese CHECK rechaza absurdos, no codifica
el gusto del producto de hoy.

---

## 2. La puerta de exposición

`NEXT_PUBLIC_ENABLE_DUEL` — **tapa el descubrimiento, no el feature.**

```
Preview:    true     Production: false (o ausente)
```

- ⛔ **Ausente = cerrado.** Sólo el string exacto `"true"` abre.
- Las cinco rutas y la Arena **no leen la bandera**: un enlace ya repartido sigue funcionando.
- Ningún archivo trackeado la define, así que **promover `main` no puede cambiar lo que
  producción muestra**.

⛔ **Y la regla operativa que hace cierto lo anterior:** producción se despliega **buildeando la
rama `production`**, nunca promoviendo un deployment de preview desde el dashboard. `NEXT_PUBLIC_*`
se hornea en el build, así que promover un artefacto de preview llevaría el `true` adentro.

---

## 3. El poll: trace operativo

Detalle completo en `docs/audits/2026-08-15-duel-poll-trace.md`.

**Un poll es un `select` por clave primaria y nada más:**

```
invocaciones 1 · queries 1 · writes 0 · Redis 0 · analytics 0 · log lines 0
```

| estado | cadencia |
| --- | --- |
| Esperando rival | 1,2 s |
| Partida (cualquier turno) | 3 s |
| Pestaña oculta | 30 s |
| **Terminada / vencida** | **el poll se detiene** |

**Envelope de volumen:** ≈450 requests por duelo de 10 min; ≈3.000 por una invitación abandonada
la hora entera (y eso exige a alguien mirando la pantalla: irse desmonta el componente y detiene
el poll).

**Tamaño de la respuesta:** 553 bytes en una partida nueva, 1.269 a las 120 jugadas. `moves` viaja
entero — es el único componente del costo que no es constante.

### Disparador para volver a mirarlo

> Revisar el poll **sólo si** el tráfico observado de P2P afecta materialmente el costo de
> invocaciones de Vercel, el volumen de lecturas de Supabase, la latencia o la tasa de error.

**Primer candidato barato cuando eso pase:** poll adaptativo / con backoff cuando no es tu turno.
⛔ No se implementó: el trace no probó que hiciera falta.

---

## 4. El P0 que encontró el smoke

⛔ **El Data Cache de Next servía lecturas viejas de Supabase.** El invitado entraba, el tablero
aparecía un par de segundos y volvía a *"JOIN THE GAME"*. Nadie podía mover.

La fila decía `active / version 2`; la ruta contestaba `awaiting-opponent / version 1`, con
`x-vercel-cache: MISS` — la ruta corría y lo viejo venía de abajo.

`getSupabaseServer({ freshReads: true })` en las cinco rutas. Detalle y lo que quedó abierto:
`docs/audits/2026-08-16-supabase-fetch-cache.md`.

⚠️ **La lección, y es la que justifica todo el checklist**: 688 archivos de tests, VR 67/67 y
`tsc` limpio, y el duelo no se podía jugar. `next dev` no aplica ese cache. **Sólo un smoke en
un build real podía encontrarlo.**

---

## 5. Verificación del congelamiento

| | |
| --- | --- |
| Suite | **688 archivos / 8.450 tests**, `EXIT=0`, 0 errores de worker, 143 s |
| `tsc` | limpio |
| VR | **67/67**, `EXIT=0`, **81 baselines antes y después** (no grabó: comparó) |
| Migraciones | **46 archivos = 46 filas** del ledger, cero pendientes en las dos direcciones |
| Smoke de dos dispositivos | ✅ **2026-08-16**, sobre preview |

**Evidencia del smoke, en la base:** duelo `FvH64mdpBN-dpuEQt7oMdA` — 2 plies (los **dos** asientos
movieron, que es la métrica fijada), versión 5, terminado por `timeout`.

---

## 6. Deuda congelada

⛔ **No son pendientes de la próxima iteración. Son deuda con su razón escrita.**

| qué | por qué se acepta | qué la reabre |
| --- | --- | --- |
| `invitedBy` siempre `null` | No hay identidad verificable server-side; tomarla del body sería el defecto de la v2 con otro nombre | El día que se premie a quien invita |
| `purge_duels` sin llamador | No hay volumen, y su default de 7 días es 80× la vida de un duelo | Filas colgadas que molesten |
| Sin revancha | Non-goal del spec | Otro spec |
| Callejón del invitado sin allowlist | Heredado; no es del duelo aunque el duelo lo estrene | El embudo de acceso |
| Tablero bloqueado sin señal para lectores de pantalla | Preexistente, también en la arena con IA | Un cambio propio de accesibilidad |
| Las piezas no se deslizan | Decisión del v1 | — |
| **25 lecturas de Supabase sin `freshReads`** | Fuera del alcance probado de este freeze | ⚠️ Tiene además un ángulo de **privacidad**: el Data Cache es compartido entre requests |

---

## 7. Estado del repo

- `main` = `origin/main`, working tree limpio
- Tabla `duels` en producción, RLS deny-total verificada corriéndola
- 11 filas de prueba en la tabla (5 `awaiting-opponent`, 3 `active` sin jugadas de antes del fix,
  3 `finished`) — ⚠️ la métrica arranca contaminada si no se distinguen

---

## 8. Lo que sigue, y NO es P2P

1. Instrumentación de lectura de pagos/balance
2. Clasificación de errores del mint de victoria
3. Instrumentación de fuente de adquisición
4. Observar
5. Experimento Daily-first
6. Corrección del rail de pagos según evidencia
7. Revisión incremental de eficiencia de infraestructura

---

# P2P DUEL V0 — FROZEN
