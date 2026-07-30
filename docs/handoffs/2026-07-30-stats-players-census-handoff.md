# Handoff — `/stats`: noindex + censo de jugadores

**Fecha:** 2026-07-30
**Estado:** cluster COMPLETO (7/7 etapas), verificado visualmente por el founder.
**Los 15 commits del cluster están en `origin/main`.** Queda local `cc3dd7f` (este handoff +
el sync del backlog), commiteado después del push. El push es del founder.

---

## 1. Qué se cerró

**Dos cosas, y la primera empezó siendo otra.**

### 1.1 `/stats` era indexable — cerrado

El backlog lo registraba como *"métricas de negocio públicas E INDEXADAS"* y la primera
lectura fue "hay que gatear la página". **Esa lectura era falsa** y el founder la corrigió.

**MiniPay exige esa página.** Sus requisitos de listing (§8, snapshot del PDF oficial
*"Build for MiniPay: Developer Requirements"*, 2026-05-13) piden una página de stats
*"public-or-shared"* con DAU, MAU, retention D1/D7/D30 y top countries, publicada como
*"a `/stats` page inside the Mini App, read-only, no wallet required"*, y es ítem con
casilla en el checklist de pre-listing. El código ya lo sabía: `public-aggregator.ts`
comenta el bloque on-chain como *MiniPay Stage-2*.

**El defecto real era la indexación, no la publicación.** Cerrado en `5595722`:
`/stats` fuera de `STATIC_PATHS` y `robots: { index: false, follow: false }` en `apps/web`
**y** `apps/landing`. Primer test sobre `sitemap.ts`.

⛔ **"Mover el grupo de negocio a admin" queda RECHAZADO, no pendiente.** Rompería el
listing. Está escrito así en el backlog para que nadie lo reabra: una sesión entera se fue
clasificando funnels como "internos" a partir de la premisa equivocada.

### 1.2 El censo de jugadores — construido

El hero de Leaders dice **17** al lado de una lista de 10. El label `TOP 10 OF 17`
(`27b61de`) tapaba el hueco de percepción, pero **la lista completa no existía en ninguna
superficie**. Ahora existe, debajo del podio en `/stats`.

---

## 2. Las decisiones que hay que conocer antes de tocarlo

| # | Decisión | Por qué |
|---|---|---|
| 1 | **La tabla es GLOBAL**: ignora `surface`/`container` | Medido en prod: `?window=alltime` es global y da 17; `?window=weekly` es surface-scoped y da 4. Una tabla que respetara los filtros mostraría <17 mientras Leaders dice 17 — el mismo número irreconciliable que vino a cerrar. Su encabezado **lo declara**. |
| 2 | **Se AGREGA, no reemplaza** el podio | Founder. Podio = quién va ganando; censo = cuántos hay. Dos preguntas distintas, dos encabezados distintos. |
| 3 | **`PAGE_SIZE = 10`**, paginador desde el registro 11 | Con 17 jugadores hoy arranca con 2 páginas y el control visible. ⚠️ Coincide en valor con `BOARD_CUT = 10` **por casualidad**: constantes separadas, en archivos separados. |
| 4 | **El censo es HERMANO de `PublicStats`**, no un campo | `getPublicStats` cachea por `(surface, container)`; meterlo adentro guardaría una copia por combinación y dejaría dos vistas con censos de horas distintas. |
| 5 | **Desempate por wallet: deuda técnica documentada**, no semántica | Ver §4. |

---

## 3. Arquitectura — dos hermanos, dos caches

```ts
// app/[locale]/stats/page.tsx
const [stats, census] = await Promise.all([
  loadStats(filters),    // cache por (surface, container)
  loadPlayersCensus(),   // cache por UNA clave global, SIN argumentos
]);
```

⛔ **`loadPlayersCensus()` no recibe argumentos.** Es lo que estructuralmente impide que un
filtro lo alcance. Hay test de que la llamada va vacía.

⛔ **`public-aggregator.ts` NO se tocó y no debe tocarse para esto.** Un diff ahí significa
que alguien volvió a meter el censo en la cache filtrada.

**Filas y total se congelan JUNTOS.** La composición ocurre dentro de la función cacheada,
así que nadie puede emparejar filas de un refresco con un total del siguiente. Se acepta
desfase contra el hero en vivo (hasta una hora); **no** se acepta desfase dentro de la tabla.

### 3.1 `asOf` es del censo, no de la página

El censo cachea en su propia entrada, así que envejece en su propio reloj. Usar el
`generatedAt` de la página al lado de su total sería **una hora correcta describiendo otro
snapshot**. ⛔ Con `rowsRead === "unavailable"` **no se muestra hora**: un *"censo a las
10:30"* sobre una lectura fallida afirma un censo que no hubo.

### 3.2 Las cuatro combinaciones internas

Filas y conteo son lecturas independientes y **fallan por separado**:

| filas | conteo | Qué pasa |
|---|---|---|
| hay | hay | normal |
| hay | `null` | tabla **sin** total. ⛔ Nunca `rows.length` |
| `[]` | `0` | board vacío legítimo → mensaje explícito |
| `[]` | hay | total visible, **sin** lista vacía |
| `[]` | `null` | el bloque no renderiza nada |

⚠️ `[]` por población cero y `[]` por error **no son el mismo hecho**. Por eso
`fetchFullLeaderboardFromDb` devuelve `null` para "no disponible" y el censo lo traduce a
`rowsRead`.

---

## 4. ⚠️ Lo que queda abierto

1. **Desempate de all-time por dirección de wallet.** `leaderboard_full_v` ordena
   `... DESC, sub.player ASC`. Los rangos **no** se repiten (la clave de orden es total),
   pero el criterio que separa a dos jugadores con el mismo score **es invisible en
   pantalla** y contradice weekly, donde el desempate es *quién llegó primero*.
   **Investigado:** el timestamp semántico ("cuándo se alcanzó el total actual") **no
   existe**; habría que derivarlo → columna nueva en la vista → **migración**, más una
   decisión de `COALESCE` para el `scores.created_at` **nullable**, más aceptar que cambia
   el `rank` de jugadores vivos. **Diferido a su propio cluster; retomar cuando aparezca el
   primer empate visible.** Hoy no hay ninguno.
2. **Colisión de nicknames al techo.** 6 piezas × 6 estilos × 10000 = **360.000**
   combinaciones → ~29% de probabilidad de dos filas con el mismo nombre visible con 500
   jugadores (~0,04% con 17). Mitigado: filas keyeadas por `rowId`, **nada deduplica por
   nombre**, y **no hay test que fije unicidad de nombres** porque sería fijar algo falso.
   ⚠️ `aggregateTopMinters` **sí** deduplica por `rowId` a propósito — copiar ese patrón acá
   borraría jugadores.
3. **Lectura directa a la vista, sin RPC.** `fetchLeaderboardFromDb` usa RPC con fallback
   porque el schema cache de PostgREST puede estar viejo. No existe `get_full_leaderboard` y
   crearlo sería migración, que este cluster excluyó. **El censo queda expuesto a ese
   escenario** y degrada a lista vacía. Está en el docblock.
4. **Un fallo transitorio esconde la tabla hasta una hora** — el resultado degradado se
   cachea como cualquier otro. **Degradación deliberada**: se prioriza no golpear una
   dependencia ya caída sobre recuperar el bloque de inmediato. Es lo que ya hacen todos los
   bloques de la página.
5. **Confirmar MiniPay §8** en la próxima llamada. La fuente es un snapshot de 2026-05-13.

---

## 5. Aparcado en el mismo movimiento

**Export de `/stats` con x402** — spec escrito y **sin red team**:
`docs/specs/2026-07-30-stats-paid-export-x402.md`. Aparcado sin fecha por el founder.
Decisiones ya tomadas (0.01 USDC, x402 sobre Celo, pago verificado antes de cualquier query
cara, payload = los agregados que ya se ven). ⛔ **Incógnita que puede mover el plan: ¿existe
un facilitator de x402 en Celo?** Un spike corto responde eso antes de comprometer nada.

---

## 6. Verificación

- Suite **6782 passing / 574 files, EXIT=0**, sin `Unhandled Errors`
- `pnpm exec tsc --noEmit` limpio en `web` y `landing`
- `content:audit` exit 0 (160 findings, baseline previo)
- Suite de `landing` 58 / 12
- **Validación visual del founder: OK** (390 px, con los 17 jugadores reales)

**Sin migración, sin contratos, sin cambios de acceso.** Reversible con revert.

---

## 7. Commits (15, sin pushear)

| Commit | Qué |
|---|---|
| `5595722` | noindex + fuera del sitemap (web y landing) |
| `acb5452` | spec del export x402 (reemplaza el spec desviado) |
| `b0ebc9b` | aparca el export, cierra el item de indexación |
| `7b56ff3` · `c20bb87` | spec del censo + correcciones del founder |
| `cf901a8` | red team (NEEDS REVISION, 4 bloqueantes) |
| `26e3ee9` | red team aplicado (F1–F7) |
| `60a0ba0` | etapa 1 — lectura de la relación sin cortar |
| `cff6ec5` · `fd680e6` | etapas 2 y 3 — composición y cache |
| `6116fd7` | spec: el censo es hermano, no campo |
| `78edbb6` | etapas 4 y 5 — tabla, paginador, encabezado local |
| `b9530bf` | etapa 6 — cableado en la ruta |
| `8f16ead` | etapa 7 — delegación al mismo conteo que Leaders |
| `cc3dd7f` | cierre — handoff + sync del backlog (**sin pushear**) |

---

## 8. Cerrado de paso, sin escribir código

**🟢 Leaders Weekly está VIVO en prod** (confirmado por el founder, 2026-07-30). La migración
`20260801000000_leaderboard_weekly.sql` **está aplicada** y
`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED = true` en Preview y Production, en **los dos proyectos**.
El item se cerró comprobándolo, no construyéndolo.

⛔ **Los handoffs anteriores a esta fecha afirman que la migración no está aplicada y que el
flag no existe en ningún entorno. Están viejos.** Medido contra prod:
`GET /api/leaderboard?window=weekly` devuelve 200 con agregación real (4 jugadores en learn
esta semana; board vacío en play con `weekStart`/`weekEnd` correctos).

⚠️ **Las dos ventanas de Leaders NO se comportan igual, y es a propósito**:
all-time es **global** y desempata por **dirección de wallet**; weekly es **surface-scoped**,
desempata por **quién llegó primero** y **falla cerrado (500) sin
`NEXT_PUBLIC_CHESSCITO_MODE`**. No "arreglar" una para que se parezca a la otra sin decisión
de producto: cambiar el desempate de all-time reordena jugadores vivos.

**Privy**: env completo en los dos entornos y los dos proyectos (dos entradas de
`NEXT_PUBLIC_PRIVY_APP_ID`, valores distintos por entorno) y `NEXT_PUBLIC_PRIVY_ENABLED` en
`true` en prod. **Falta cerrar el issue #272**, cuya condición ya se cumple.
⚠️ `vercel env ls production` **oculta las filas de Preview** y hace parecer que falta el
APP_ID — auditar presencia **sin filtro de entorno**.

---

## 9. Próximo paso sugerido

**El Theme Builder** — el frente grande elegido el 2026-07-18 y **todavía sin spec**. Es el
único ítem del tablero que es trabajo de semanas en vez de días, así que si arranca, arranca
por el spec.

Lo demás abierto es chico o está aparcado a propósito: **export x402** (aparcado, con spike de
facilitator pendiente) · **desempate de all-time** (diferido, pide migración) · arte huérfano
del landing · P2 `offerBenefitTrainings` sin traducir en ES.
